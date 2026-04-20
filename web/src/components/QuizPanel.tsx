"use client";

import { Loader2, Sparkles, RefreshCw, Trophy, Target, Award, ArrowRight } from "lucide-react";
import { useState } from "react";

type QuizQuestion = {
  id?: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

type QuizResponse = {
  questions?: QuizQuestion[];
  quizSetId?: string | null;
  warning?: string | null;
  error?: string;
};

type Props = {
  canvasId: string;
  model: string;
  contextHint?: string;
  nodeId?: string | null;
};

export function QuizPanel({ canvasId, model, contextHint, nodeId }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quizSetId, setQuizSetId] = useState<string | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  async function logReviewEvent(
    result: "correct" | "incorrect",
    quizQuestionId?: string,
    selected?: number
  ) {
    if (!quizSetId) return;
    try {
      await fetch("/api/study/review-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          quizSetId,
          quizQuestionId,
          result,
          metadata: {
            selectedOption: selected,
            questionIndex: currentIndex,
          },
        }),
      });
    } catch (e) {
      console.error("Could not log quiz review event", e);
    }
  }

  async function generateQuiz() {
    if (!contextHint) {
      setError("Please select a concept on the knowledge canvas first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setQuizSetId(null);
    setQuestions([]);
    setSelectedOption(null);
    setScore(0);
    setCurrentIndex(0);
    try {
      const res = await fetch("/api/study/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextHint, model, canvasId, nodeId: nodeId ?? undefined }),
      });
      const data = (await res.json()) as QuizResponse;
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz");
      const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
      if (nextQuestions.length === 0) {
        throw new Error("No quiz questions were generated. Try another concept.");
      }

      setQuestions(nextQuestions);
      setQuizSetId(typeof data.quizSetId === "string" ? data.quizSetId : null);
      if (data.warning) setNotice(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ position: 'relative' }}>
           <div style={{ position: 'absolute', inset: -20, background: 'rgba(59, 130, 246, 0.3)', filter: 'blur(30px)', borderRadius: '50%' }} />
           <Loader2 className="spin" size={48} color="#3b82f6" style={{ position: 'relative', zIndex: 1 }} />
        </div>
        <p style={{ marginTop: '24px', fontSize: '1.1rem', fontWeight: 500 }}>Drafting Scenario Quiz...</p>
        <p className="muted" style={{ fontSize: '0.9rem', textAlign: 'center' }}>Creating challenging multiple choice questions based on the graph context.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.2)' }}>
          <Target size={32} color="#3b82f6" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Simulated Quizzes</h3>
        <p className="muted" style={{ marginBottom: "32px", fontSize: '0.95rem', lineHeight: 1.5 }}>
          {contextHint ? "Context locked. Ready to generate a structured multiple-choice quiz." : "Select a node on the canvas to evaluate your understanding."}
        </p>
        <button className="btn primary" disabled={!contextHint} onClick={generateQuiz} style={{ padding: '12px 24px', borderRadius: '12px', background: '#3b82f6', color: '#fff', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}>
          Generate Quiz
        </button>
        {notice && <p className="muted" style={{ marginTop: "12px" }}>{notice}</p>}
        {error && <p className="err" style={{ marginTop: "16px" }}>{error}</p>}
      </div>
    );
  }

  if (currentIndex >= questions.length) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ position: 'relative', marginBottom: '24px' }}>
           <div style={{ position: 'absolute', inset: -30, background: percentage > 70 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', filter: 'blur(30px)', borderRadius: '50%' }} />
           {percentage > 70 ? <Trophy size={64} color="var(--ok)" style={{ position: 'relative', zIndex: 1 }} /> : <Award size={64} color="var(--danger)" style={{ position: 'relative', zIndex: 1 }} />}
        </div>
        <h3 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "8px" }}>Quiz Completed</h3>
        <p style={{ fontSize: "1.1rem", marginBottom: "32px", color: "var(--muted)" }}>
          You scored <strong style={{ color: '#fff', fontSize: '1.2rem' }}>{score}</strong> out of {questions.length} ({percentage}%)
        </p>
        <button className="btn ghost" onClick={generateQuiz} style={{ padding: '12px 24px', borderRadius: '12px', gap: '8px', border: '1px solid var(--border)' }}>
           <RefreshCw size={18} />
           Take Another Quiz
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const hasAnswered = selectedOption !== null;
  const progressPercent = ((currentIndex) / questions.length) * 100;

  return (
    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
           <span className="muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
             Q{currentIndex + 1} <span style={{ opacity: 0.5 }}>/ {questions.length}</span>
           </span>
           <div style={{ flex: 1, maxWidth: '150px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
             <div style={{ height: '100%', width: `${progressPercent}%`, background: '#3b82f6', transition: 'width 0.3s ease' }} />
           </div>
        </div>
        <button className="btn ghost" onClick={generateQuiz} title="Regenerate quiz" style={{ padding: '6px' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Question */}
      <h3 style={{ margin: "0 0 24px", fontSize: "1.2rem", lineHeight: "1.5", fontWeight: 500 }}>
        {currentQuestion.question}
      </h3>

      {/* Options */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {currentQuestion.options.map((opt, i) => {
          let bg = 'rgba(255,255,255,0.03)';
          let border = '1px solid var(--border)';
          let dotColor = 'transparent';
          const textColor = 'var(--text)';

          if (hasAnswered) {
             if (i === currentQuestion.answerIndex) {
                 bg = 'rgba(16, 185, 129, 0.1)';
                 border = '1px solid var(--ok)';
                 dotColor = 'var(--ok)';
             } else if (i === selectedOption) {
                 bg = 'rgba(239, 68, 68, 0.1)';
                 border = '1px solid var(--danger)';
                 dotColor = 'var(--danger)';
             }
          }

          return (
            <button 
              key={i} 
              disabled={hasAnswered}
              onClick={() => {
                void logReviewEvent(
                  i === currentQuestion.answerIndex ? "correct" : "incorrect",
                  currentQuestion.id,
                  i
                );
                setSelectedOption(i);
                if (i === currentQuestion.answerIndex) setScore(s => s + 1);
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '16px', borderRadius: '12px',
                background: bg, border, color: textColor, fontSize: '1rem', cursor: hasAnswered ? 'default' : 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px'
              }}
              onMouseOver={(e) => {
                 if (!hasAnswered) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                 }
              }}
              onMouseOut={(e) => {
                 if (!hasAnswered) {
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.borderColor = 'var(--border)';
                 }
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: dotColor !== 'transparent' ? dotColor : 'var(--muted)' }}>
                 {hasAnswered && (i === currentQuestion.answerIndex || i === selectedOption) && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                 )}
              </div>
              <span style={{ flex: 1 }}>{opt}</span>
            </button>
          );
        })}

        {hasAnswered && (
          <div className="glass-panel" style={{ marginTop: "16px", padding: "16px 20px", display: 'flex', gap: '12px', borderLeft: `3px solid ${selectedOption === currentQuestion.answerIndex ? 'var(--ok)' : 'var(--danger)'}`, borderRadius: '0 12px 12px 0' }}>
            <div>
               <Sparkles size={18} color="var(--accent-light)" style={{ marginTop: '2px' }} />
            </div>
            <div>
               <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Explanation</div>
               <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: "1.5" }}>{currentQuestion.explanation}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "right", marginTop: "24px" }}>
        <button 
          disabled={!hasAnswered} 
          onClick={() => {
            setCurrentIndex(c => c + 1);
            setSelectedOption(null);
          }}
          style={{
             padding: '12px 24px', borderRadius: '12px', border: 'none',
             background: hasAnswered ? '#fff' : 'rgba(255,255,255,0.1)', color: hasAnswered ? '#000' : 'var(--muted)',
             fontWeight: 600, fontSize: '1rem', cursor: hasAnswered ? 'pointer' : 'not-allowed',
             display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
