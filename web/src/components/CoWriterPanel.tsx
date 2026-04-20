"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  canvasId: string;
  model: string;
  draft: string;
  onDraftChange: (s: string) => void;
  contextHint?: string;
};

export function CoWriterPanel({ canvasId, model, draft, onDraftChange, contextHint }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestCitation = useCallback(async () => {
    setBusy(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/study/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          model,
          messages: [
            {
              role: "system",
              content:
                "You help researchers draft prose grounded in their ingested materials. " +
                "Suggest 2–4 short bullet points the writer could add, each tied to 'your archive' without inventing fake quotes. " +
                "If context is thin, say what to look for in the graph instead.",
            },
            {
              role: "user",
              content:
                (contextHint ? `Context from selected node/sources:\n${contextHint}\n\n` : "") +
                `Draft so far:\n${draft || "(empty)"}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : res.statusText);
      }
      const text = await res.text();
      setSuggestion(text);
    } catch (e) {
      setSuggestion(e instanceof Error ? e.message : "Could not reach the model.");
    } finally {
      setBusy(false);
    }
  }, [canvasId, contextHint, draft, model]);

  return (
    <div className="cowriter-panel">
      <p className="muted small-gap">
        Write notes, outlines, or draft paragraphs. Use the button to pull narrative suggestions that stay close to
        your ingested sources when you have a node selected.
      </p>
      <textarea
        className="cowriter-draft"
        placeholder="Your working notes and draft text…"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
      />
      <button type="button" className="cowriter-btn" disabled={busy} onClick={() => void suggestCitation()}>
        {busy ? (
          "Thinking…"
        ) : (
          <>
            <Sparkles size={16} /> Suggest angles from sources
          </>
        )}
      </button>
      {suggestion && (
        <div className="cowriter-suggestion">
          <h3 className="cowriter-sug-title">Suggestions</h3>
          <pre className="cowriter-sug-body">{suggestion}</pre>
        </div>
      )}
    </div>
  );
}
