"use client";

import Link from "next/link";

import { hasBrowserSupabaseConfig } from "@/lib/supabase/browser";

export function LandingPage() {
  if (!hasBrowserSupabaseConfig()) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>Episteme Study</h1>
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
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — publishable / anon key
            </li>
            <li>
              <code>HF_INGEST_URL</code> and <code>INGEST_SECRET</code> — for the ingest API route
            </li>
            <li>
              <code>OPENROUTER_API_KEY</code> — optional, for Study, Flashcard and Quiz features
            </li>
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="shell landing">
      <header className="topbar landing-header animate-fade-in-up">
        <div>
          <h1 style={{ fontFamily: "var(--font-geist-mono)" }}>
            Episteme Study
          </h1>
          <p className="tagline">The ultimate AI-native study workspace.</p>
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
      <div className="landing-glow" />
      <main className="landing-main">
        <section className="landing-hero landing-hero-centered animate-fade-in-up delay-1">
          <h1 className="landing-hero-title">
            Acing exams just got <span className="accent-text">easier.</span>
          </h1>
          <p className="landing-hero-copy">
            Upload your lectures, PDFs, or notes. We build a visual Knowledge Graph of the concepts, and Gemma automatically generates highly effective space-repetition <strong>Flashcards</strong> and digital <strong>Quizzes</strong>.
          </p>
          <div className="landing-cta landing-cta-centered">
            <Link href="/signup" className="btn primary large landing-cta-btn">
              Start Studying Free
            </Link>
            <Link href="/login" className="btn ghost large landing-cta-btn">
              Log in
            </Link>
          </div>
        </section>

        <section className="landing-steps animate-fade-in-up delay-2">
          <div className="step-card">
            <div className="step-number">Step 01 &mdash; Upload</div>
            <h3 className="step-title">Feed the Engine</h3>
            <p className="step-desc">
              Drop in your dense lectures, slide decks, or scattered notes. Our ingestion pipeline instantly pre-processes the material structure.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">Step 02 &mdash; Analyze</div>
            <h3 className="step-title">Knowledge Graph</h3>
            <p className="step-desc">
              We extract key entities and relationships, building an interconnected visual canvas so you actually see how concepts link.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">Step 03 &mdash; Master</div>
            <h3 className="step-title">Active Recall</h3>
            <p className="step-desc">
              Master the material seamlessly with automatically generated smart flashcards and personalized simulated quizzes.
            </p>
          </div>
        </section>
        
        <section className="landing-grid landing-grid-spacious animate-fade-in-up delay-3">
          <article className="landing-card landing-card-feature">
            <div className="landing-card-icon icon-flashcards">✦</div>
            <h3 className="landing-card-title accent">Smart Flashcards</h3>
            <p>Don&apos;t waste time typing. Our AI reads your material and generates thousands of flashcards in seconds, focusing on exactly what you need to know.</p>
          </article>
          <article className="landing-card landing-card-feature">
            <div className="landing-card-icon icon-quizzes">✧</div>
            <h3 className="landing-card-title success">Simulated Quizzes</h3>
            <p>Test your knowledge before the exam. Take auto-generated multiple choice quizzes that identify your weak spots with detailed explanations.</p>
          </article>
          <article className="landing-card landing-card-feature">
            <div className="landing-card-icon icon-canvas">⟡</div>
            <h3 className="landing-card-title info">Knowledge Canvas</h3>
            <p>Connect the dots visually. See how concepts link together with our nodes system, proving exactly where the AI pulled your flashcards from.</p>
          </article>
        </section>

        <section className="landing-final-cta animate-fade-in-up delay-4">
          <h2 className="final-cta-title">Ready to ace your next exam?</h2>
          <p className="final-cta-desc">Join students using Episteme to study 10x faster and retain 100x more.</p>
          <Link href="/signup" className="btn primary large landing-cta-btn">
            Get Started — It&apos;s Free
          </Link>
        </section>
      </main>
    </div>
  );
}
