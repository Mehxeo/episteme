"use client";

import { Loader2, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  canvasId: string;
  model: string;
  contextHint?: string;
};

export function StudyPanel({ canvasId, model, contextHint }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Ask me to explain a concept, quiz you with flashcards, or connect ideas from your sources. " +
        (contextHint
          ? ` I can see context from the node you selected on the canvas.`
          : " Select a node on the graph for tighter, source-grounded answers."),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextUser: Msg = { role: "user", content: text };
    setInput("");
    setMessages((m) => [...m, nextUser]);
    setBusy(true);

    const prior: Msg[] = [...messages, nextUser];
    const history: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content:
          "You are a study tutor for qualitative research. Be concise, accurate, and cite ideas as 'from your materials' when using provided excerpts. If unsure, say so.",
      },
    ];
    if (contextHint) {
      history.push({
        role: "system",
        content: `Context from the user's selected graph node and sources:\n${contextHint}`,
      });
    }
    for (let i = 0; i < prior.length; i++) {
      const x = prior[i];
      if (i === 0 && x.role === "assistant") continue;
      history.push({ role: x.role, content: x.content });
    }

    try {
      const res = await fetch("/api/study/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model, canvasId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : res.statusText);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const dec = new TextDecoder();
      let acc = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            last.content = acc;
          }
          return copy;
        });
      }
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [busy, canvasId, contextHint, input, messages, model]);

  return (
    <div className="study-panel">
      <div className="study-messages">
        {messages.map((m, i) => (
          <div key={i} className={`study-msg study-msg-${m.role}`}>
            <span className="study-role">{m.role === "user" ? "You" : "Tutor"}</span>
            <p className="study-bubble">{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="study-msg study-msg-assistant">
            <Loader2 className="spin" size={18} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="study-input-row">
        <textarea
          className="study-input"
          rows={2}
          placeholder="Ask for an explanation, a quiz question, or help comparing concepts…"
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="study-send" disabled={busy || !input.trim()} onClick={() => void send()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
