"use client";

import Link from "next/link";

import { hasBrowserSupabaseConfig } from "@/lib/supabase/browser";

export function LandingPage() {
  if (!hasBrowserSupabaseConfig()) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>ZylumGraph</h1>
          <p className="tagline">Configuration needed</p>
        </header>
        <main className="config-missing">
          <p>
            Add these environment variables in <code>.env.local</code> (and in Vercel for production), then restart the
            dev server — <code>NEXT_PUBLIC_*</code> values are baked in at build time.
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
            <li>
              <code>OPENROUTER_API_KEY</code> — optional, for Study and Co-writer features
            </li>
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="shell landing">
      <header className="topbar landing-header">
        <div>
          <h1>ZylumGraph</h1>
          <p className="tagline">AI-native workspace for qualitative research &amp; serious study</p>
        </div>
        <nav className="landing-nav">
          <Link href="/login" className="btn ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn primary">
            Create account
          </Link>
        </nav>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <h2>From unreadable archives to a living knowledge graph</h2>
          <p>
            Drop PDFs (and soon, whole ZIP corpora). Background agents extract entities, timelines, and relationships.
            You get a Figma-style canvas, source-backed proof panes, study tutoring, and a co-writer that stays tied to
            your materials — not generic chat.
          </p>
          <div className="landing-cta">
            <Link href="/signup" className="btn primary large">
              Get started
            </Link>
            <Link href="/login" className="btn ghost large">
              I already have an account
            </Link>
          </div>
        </section>
        <section className="landing-grid">
          <article className="landing-card">
            <h3>Deep ingestion</h3>
            <p>Pipeline-ready for layout-aware OCR and worker-side extraction; your Supabase project stores files per account.</p>
          </article>
          <article className="landing-card">
            <h3>Proof, not vibes</h3>
            <p>Click any node or edge to open the exact text chunks that justified it — yellow-highlighter energy for primary sources.</p>
          </article>
          <article className="landing-card">
            <h3>Study &amp; write</h3>
            <p>Models like Gemma, Nemotron, and GPT-OSS power explanations, drills, and draft suggestions grounded in your graph.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
