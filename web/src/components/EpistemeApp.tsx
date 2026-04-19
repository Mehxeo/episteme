"use client";

import { useState } from "react";

import { KnowledgeCanvas } from "@/components/KnowledgeCanvas";
import { Inspector } from "@/components/Inspector";
import { Uploader } from "@/components/Uploader";
import { hasBrowserSupabaseConfig } from "@/lib/supabase/client";

export function EpistemeApp() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const configured = hasBrowserSupabaseConfig();

  if (!configured) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Episteme</h1>
          <p className="tagline">Configuration needed</p>
        </header>
        <main className="config-missing">
          <p>
            Add these environment variables in Vercel (Project → Settings → Environment Variables), then{" "}
            <strong>Redeploy</strong> — <code>NEXT_PUBLIC_*</code> values are baked in at build time.
          </p>
          <ul>
            <li>
              <code>NEXT_PUBLIC_SUPABASE_URL</code> — Supabase project URL
            </li>
            <li>
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — publishable / anon key (or{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>)
            </li>
            <li>
              <code>HF_INGEST_URL</code> and <code>INGEST_SECRET</code> — for the ingest API route
            </li>
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Episteme</h1>
        <p className="tagline">PDF → entities → live canvas</p>
      </header>
      <main className="panes">
        <section className="pane left">
          <Uploader />
        </section>
        <section className="pane center">
          <KnowledgeCanvas onSelectNode={setSelectedNodeId} />
        </section>
        <section className="pane right">
          <Inspector key={selectedNodeId ?? "none"} nodeId={selectedNodeId} />
        </section>
      </main>
    </div>
  );
}
