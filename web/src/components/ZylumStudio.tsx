"use client";

import { LayoutGrid, LogOut, Palette, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Inspector } from "@/components/Inspector";
import { KnowledgeCanvas } from "@/components/KnowledgeCanvas";
import { StudyPanel } from "@/components/StudyPanel";
import { FlashcardsPanel } from "@/components/FlashcardsPanel";
import { QuizPanel } from "@/components/QuizPanel";
import { Uploader } from "@/components/Uploader";
import { useThemeConfig } from "@/context/ThemeContext";
import { DEFAULT_GEMMA_STUDY_MODEL, GEMMA_STUDY_MODELS } from "@/lib/gemma-models";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { DbCanvas, GraphDensity } from "@/types/zylum";

type RightTab = "sources" | "flashcards" | "quiz" | "chat";

type Props = {
  canvasId: string;
};

export function ZylumStudio({ canvasId }: Props) {
  const router = useRouter();
  const theme = useThemeConfig();
  const [canvas, setCanvas] = useState<DbCanvas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("sources");
  const [model, setModel] = useState<string>(DEFAULT_GEMMA_STUDY_MODEL);
  const [contextHint, setContextHint] = useState<string | undefined>();
  const [titleEdit, setTitleEdit] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const panelOpen = Boolean(selectedNodeId);
  const tabs: Array<{ id: RightTab; label: string }> = [
    { id: "sources", label: "Context" },
    { id: "flashcards", label: "Cards" },
    { id: "quiz", label: "Quiz test" },
    { id: "chat", label: "Kai Tutor" },
  ];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data, error: qErr } = await supabase
        .from("canvases")
        .select("id,user_id,title,settings,created_at,updated_at")
        .eq("id", canvasId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr || !data) {
        setError(qErr?.message ?? "Canvas not found. Apply the Supabase migration and try again.");
        return;
      }
      const row = data as DbCanvas;
      setCanvas(row);
      setTitleEdit(row.title);
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  useEffect(() => {
    if (!selectedNodeId) {
      setContextHint(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data: nodes } = await supabase.from("nodes").select("name,summary").eq("id", selectedNodeId).maybeSingle();
      const { data: chunks } = await supabase
        .from("chunks")
        .select("content")
        .eq("node_id", selectedNodeId)
        .limit(12);
      if (cancelled) return;
      const name = (nodes as { name?: string; summary?: string } | null)?.name ?? "Node";
      const summary = (nodes as { summary?: string } | null)?.summary;
      const parts = [`Selected entity: ${name}`, summary ? `Summary: ${summary}` : null];
      for (const c of chunks ?? []) {
        const content = (c as { content: string }).content;
        if (content) parts.push(`Excerpt: ${content.slice(0, 1200)}`);
      }
      setContextHint(parts.filter(Boolean).join("\n\n"));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  const graphDensity: GraphDensity = canvas?.settings?.graphDensity ?? "overview";

  const persistCanvas = useCallback(
    async (patch: Partial<DbCanvas>) => {
      const supabase = createBrowserSupabase();
      const { data, error: uErr } = await supabase
        .from("canvases")
        .update(patch)
        .eq("id", canvasId)
        .select("id,user_id,title,settings,created_at,updated_at")
        .single();
      if (uErr) {
        console.error(uErr);
        return;
      }
      setCanvas(data as DbCanvas);
    },
    [canvasId]
  );

  const saveTitle = useCallback(async () => {
    const t = titleEdit.trim() || "Untitled canvas";
    await persistCanvas({ title: t });
  }, [persistCanvas, titleEdit]);

  const setDensity = useCallback(
    async (next: GraphDensity) => {
      const settings = { ...(canvas?.settings ?? {}), graphDensity: next };
      await persistCanvas({ settings });
    },
    [canvas, persistCanvas]
  );

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  if (error) {
    return (
      <div className="shell">
        <header className="topbar">
          <h1>ZylumGraph</h1>
          <p className="tagline">Studio</p>
        </header>
        <main className="config-missing">
          <p>{error}</p>
          <p>
            <Link href="/studio">Back to canvases</Link>
          </p>
        </main>
      </div>
    );
  }

  if (!canvas) {
    return (
      <div className="shell studio-loading">
        <p className="muted">Loading canvas…</p>
      </div>
    );
  }

  return (
    <div className="shell studio">
      <header className="topbar studio-topbar">
        <div className="topbar-left">
          <Link href="/studio" className="back-link">
            <LayoutGrid size={18} /> Canvases
          </Link>
          <input
            className="canvas-title-input"
            value={titleEdit}
            onChange={(e) => setTitleEdit(e.target.value)}
            onBlur={() => void saveTitle()}
          />
        </div>
        <div className="topbar-actions">
          <div className="density-toggle" title="How many links to show at once">
            <button
              type="button"
              className={graphDensity === "overview" ? "active" : ""}
              onClick={() => void setDensity("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={graphDensity === "full" ? "active" : ""}
              onClick={() => void setDensity("full")}
            >
              Full graph
            </button>
          </div>
          <label className="model-pick">
            <span className="sr-only">Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {GEMMA_STUDY_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="icon-btn" onClick={() => setThemeOpen((v) => !v)} title="Theme">
            <Palette size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => void signOut()} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {themeOpen && (
        <div className="theme-popover">
          <p className="theme-pop-title">Appearance</p>
          <div className="theme-presets">
            {(Object.keys(theme.presets) as Array<keyof typeof theme.presets>).map((id) => (
              <button
                key={id}
                type="button"
                className={theme.preset === id ? "theme-chip active" : "theme-chip"}
                onClick={() => theme.setPreset(id)}
              >
                {id}
              </button>
            ))}
          </div>
          <label className="accent-label">
            Accent
            <input
              type="color"
              value={theme.accentOverride ?? theme.presets[theme.preset].accent}
              onChange={(e) => theme.setAccentOverride(e.target.value)}
            />
          </label>
          <button type="button" className="text-btn" onClick={() => theme.setAccentOverride(null)}>
            Reset accent
          </button>
        </div>
      )}

      <main className="panes studio-panes studio-panes-layout">
        <section className="pane left studio-left-pane">
          <Uploader canvasId={canvasId} />
          <p className="uploader-hint small-print">
            Upload PDFs, images, or audio files. Episteme&apos;s multimodal AI will map concepts onto the canvas.
          </p>
        </section>
        <section className="pane center studio-center-pane">
          <KnowledgeCanvas
            canvasId={canvasId}
            graphDensity={graphDensity}
            onSelectNode={setSelectedNodeId}
          />
        </section>
        
        {/* Slide-Out Study Panel */}
        <section className={panelOpen ? "glass-panel studio-slide-panel open" : "glass-panel studio-slide-panel"}>
          <div className="right-tabs studio-right-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={rightTab === tab.id ? "studio-tab active" : "studio-tab"}
                onClick={() => setRightTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <span className="tab-spacer" />
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="studio-panel-close"
              title="Close panel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="right-body studio-right-body">
            {rightTab === "sources" && <Inspector nodeId={selectedNodeId} />}
            {rightTab === "flashcards" && (
              <FlashcardsPanel
                canvasId={canvasId}
                model={model}
                contextHint={contextHint}
                nodeId={selectedNodeId}
              />
            )}
            {rightTab === "quiz" && (
              <QuizPanel
                canvasId={canvasId}
                model={model}
                contextHint={contextHint}
                nodeId={selectedNodeId}
              />
            )}
            {rightTab === "chat" && (
              <StudyPanel canvasId={canvasId} model={model} contextHint={contextHint} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
