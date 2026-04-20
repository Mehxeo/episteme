"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { DbCanvas } from "@/types/zylum";

export default function StudioHomePage() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<DbCanvas[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data, error: qErr } = await supabase
      .from("canvases")
      .select("id,user_id,title,settings,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setCanvases([]);
      return;
    }
    setCanvases((data ?? []) as DbCanvas[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCanvas() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data, error: insErr } = await supabase
        .from("canvases")
        .insert({
          user_id: user.id,
          title: "Untitled Study Set",
          settings: { graphDensity: "overview" },
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      router.push(`/studio/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create study set");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell studio-home">
      <header className="topbar">
        <div>
          <h1>Your Study Sets</h1>
          <p className="tagline">Each set has its own flashcards, quizzes, and knowledge graph.</p>
        </div>
        <div className="topbar-actions">
          <Link href="/" className="btn ghost">
            Home
          </Link>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void createCanvas()}>
            {busy ? "Creating…" : "New Study Set"}
          </button>
        </div>
      </header>
      <main className="studio-list">
        {error && <p className="err">{error}</p>}
        {canvases === null && <p className="muted">Loading…</p>}
        {canvases && canvases.length === 0 && !error && (
          <p className="muted">No study sets yet. Create one to start learning.</p>
        )}
        {canvases && canvases.length > 0 && (
          <ul className="canvas-list">
            {canvases.map((c) => (
              <li key={c.id}>
                <Link href={`/studio/${c.id}`} className="canvas-row">
                  <span className="canvas-row-title">{c.title}</span>
                  <span className="canvas-row-date">
                    {new Date(c.updated_at).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
