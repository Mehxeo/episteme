"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { DbChunk } from "@/types/episteme";

type Props = {
  nodeId: string | null;
};

export function Inspector({ nodeId }: Props) {
  const [chunks, setChunks] = useState<DbChunk[] | null>(null);

  useEffect(() => {
    if (!nodeId) {
      return;
    }
    let cancelled = false;
    const supabase = createBrowserSupabase();
    void supabase
      .from("chunks")
      .select("id,document_id,node_id,content")
      .eq("node_id", nodeId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setChunks([]);
        } else {
          setChunks((data ?? []) as DbChunk[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const visibleChunks = nodeId ? chunks ?? [] : [];
  const loading = Boolean(nodeId) && chunks === null;

  return (
    <aside className="inspector">
      <h2 className="inspector-title">Sources</h2>
      {!nodeId && (
        <p className="muted">Select a node on the canvas to see text chunks that mention it.</p>
      )}
      {nodeId && loading && <p className="muted">Loading…</p>}
      {nodeId && !loading && visibleChunks.length === 0 && (
        <p className="muted">No linked chunks yet. The ingest worker links chunks when the entity name appears in the text.</p>
      )}
      {visibleChunks.map((c) => (
        <article key={c.id} className="chunk-card">
          <div className="chunk-head">
            <BookOpen size={16} />
            <span>Chunk</span>
          </div>
          <pre className="chunk-body">{c.content}</pre>
        </article>
      ))}
    </aside>
  );
}
