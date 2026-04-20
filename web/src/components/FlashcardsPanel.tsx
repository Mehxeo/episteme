"use client";

import { Loader2, Sparkles, CheckCircle2, XCircle, RotateCcw, Flame } from "lucide-react";
import { useState } from "react";

type Flashcard = { id?: string; front: string; back: string };

type FlashcardResponse = {
  flashcards?: Flashcard[];
  deckId?: string | null;
  warning?: string | null;
  error?: string;
};

type Props = {
  canvasId: string;
  model: string;
  contextHint?: string;
  nodeId?: string | null;
};

export function FlashcardsPanel({ canvasId, model, contextHint, nodeId }: Props) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function logReviewEvent(result: "got_it" | "needs_review", flashcardId?: string) {
    if (!deckId) return;
    try {
      await fetch("/api/study/review-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          deckId,
          flashcardId,
          result,
        }),
      });
    } catch (e) {
      console.error("Could not log flashcard review event", e);
    }
  }

  async function generateFlashcards() {
    if (!contextHint) {
      setError("Please select a concept on the knowledge canvas first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setDeckId(null);
    setFlashcards([]);
    setCompleted(false);
    try {
      const res = await fetch("/api/study/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextHint, model, canvasId, nodeId: nodeId ?? undefined }),
      });
      const data = (await res.json()) as FlashcardResponse;
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      const nextCards = Array.isArray(data.flashcards) ? data.flashcards : [];
      if (nextCards.length === 0) {
        throw new Error("No flashcards were generated. Try a different concept.");
      }

      setFlashcards(nextCards);
      setDeckId(typeof data.deckId === "string" ? data.deckId : null);
      if (data.warning) setNotice(data.warning);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const handleResponse = (knowIt: boolean) => {
    const active = flashcards[currentIndex];
    void logReviewEvent(knowIt ? "got_it" : "needs_review", active?.id);

    setIsFlipped(false);
    // In a real app we'd trigger a spaced repetition queue API update here.
    setTimeout(() => {
      if (currentIndex === flashcards.length - 1) {
        setCompleted(true);
      } else {
        setCurrentIndex(c => c + 1);
      }
    }, 150); // slight delay for animation
  };

  if (busy) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ position: 'relative' }}>
           <div style={{ position: 'absolute', inset: -20, background: 'var(--accent-glow)', filter: 'blur(30px)', borderRadius: '50%' }} />
           <Loader2 className="spin" size={48} color="var(--accent-light)" style={{ position: 'relative', zIndex: 1 }} />
        </div>
        <p style={{ marginTop: '24px', fontSize: '1.1rem', fontWeight: 500 }}>Generating Smart Cards</p>
        <p className="muted" style={{ fontSize: '0.9rem', textAlign: 'center' }}>Analyzing context and drawing semantic relationships...</p>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
          <Sparkles size={32} color="var(--accent-light)" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Ready to Synthesize</h3>
        <p className="muted" style={{ marginBottom: "32px", fontSize: '0.95rem', lineHeight: 1.5 }}>
          {contextHint ? `Context selected. Our AI will generate spaced-repetition flashcards mapped directly to this concept.` : "Select a node on the knowledge canvas to extract concepts and generate flashcards."}
        </p>
        <button className="btn primary btn-glow" disabled={!contextHint} onClick={generateFlashcards} style={{ padding: '12px 24px', borderRadius: '12px' }}>
          Generate Flashcards
        </button>
        {notice && <p className="muted" style={{ marginTop: "12px" }}>{notice}</p>}
        {error && <p className="err" style={{ marginTop: "16px" }}>{error}</p>}
      </div>
    );
  }

  if (completed) {
     return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ position: 'relative', marginBottom: '24px' }}>
           <div style={{ position: 'absolute', inset: -20, background: 'rgba(16, 185, 129, 0.3)', filter: 'blur(30px)', borderRadius: '50%' }} />
           <Flame size={64} color="var(--ok)" style={{ position: 'relative', zIndex: 1 }} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 600 }}>Review Complete!</h3>
        <p className="muted" style={{ marginBottom: "32px", fontSize: '1.05rem' }}>
          You&apos;ve reviewed all cards for this concept. Your spaced repetition queue has been updated.
        </p>
        <button className="btn ghost" onClick={() => { setCompleted(false); setCurrentIndex(0); }} style={{ padding: '12px 24px', borderRadius: '12px', gap: '8px' }}>
          <RotateCcw size={18} />
          Review Again
        </button>
      </div>
     )
  }

  const currentCard = flashcards[currentIndex];
  // Calculate progress safely to avoid dividing by 0
  const progressPercent = flashcards.length > 0 ? ((currentIndex) / flashcards.length) * 100 : 0;

  return (
    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
           <span className="muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
             {currentIndex + 1} <span style={{ opacity: 0.5 }}>/ {flashcards.length}</span>
           </span>
           <div style={{ flex: 1, maxWidth: '150px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
             <div style={{ height: '100%', width: `${progressPercent}%`, background: 'var(--accent-light)', transition: 'width 0.3s ease' }} />
           </div>
        </div>
        <button className="btn ghost" onClick={generateFlashcards} title="Regenerate context" style={{ padding: '6px' }}>
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Card Area */}
      <div className="flashcard-wrap" onClick={() => setIsFlipped(!isFlipped)} style={{ flex: 1, maxHeight: '400px' }}>
        <div className={`flashcard-inner ${isFlipped ? "flipped" : ""}`}>
          <div className="flashcard-front glass-panel" style={{ cursor: 'pointer' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 500, margin: 0, padding: '20px', textAlign: 'center' }}>{currentCard.front}</p>
            <div style={{ position: 'absolute', bottom: '20px', fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tap to Flip</div>
          </div>
          <div className="flashcard-back glass-panel" style={{ cursor: 'pointer', background: 'rgba(109, 40, 217, 0.1)', borderColor: 'var(--accent)' }}>
            <p style={{ fontSize: '1.2rem', margin: 0, padding: '20px', textAlign: 'center', color: '#fff' }}>{currentCard.back}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "24px", opacity: isFlipped ? 1 : 0.5, transition: 'opacity 0.3s', pointerEvents: isFlipped ? 'auto' : 'none' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); handleResponse(false); }}
          style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.1s' }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <XCircle size={20} />
          Needs Review
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleResponse(true); }}
          style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.1s' }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <CheckCircle2 size={20} />
          Got It
        </button>
      </div>
    </div>
  );
}
