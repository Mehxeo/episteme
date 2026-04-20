"use client";

import { LayoutGrid, LogOut, Palette, PanelRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CoWriterPanel } from "@/components/CoWriterPanel";
import { Inspector } from "@/components/Inspector";
import { KnowledgeCanvas } from "@/components/KnowledgeCanvas";
import { StudyPanel } from "@/components/StudyPanel";
import { Uploader } from "@/components/Uploader";
import { useThemeConfig } from "@/context/ThemeContext";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { DbCanvas, GraphDensity } from "@/types/zylum";

const STUDY_MODELS = [
  "openrouter/elephant-alpha",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
] as const;

type RightTab = "sources" | "study" | "notes";

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
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<string>(STUDY_MODELS[4]);
  const [contextHint, setContextHint] = useState<string | undefined>();
  const [titleEdit, setTitleEdit] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);

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
              {STUDY_MODELS.map((m) => (
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

      <main className="panes studio-panes">
        <section className="pane left">
          <Uploader canvasId={canvasId} />
          <p className="uploader-hint small-print">
            Large ZIP archives and layout-aware OCR can plug into the same pipeline from your worker — upload PDFs here
            today.
          </p>
        </section>
        <section className="pane center">
          <KnowledgeCanvas
            canvasId={canvasId}
            graphDensity={graphDensity}
            onSelectNode={setSelectedNodeId}
          />
        </section>
        <section className="pane right studio-right">
          <div className="right-tabs">
            <button
              type="button"
              className={rightTab === "sources" ? "tab active" : "tab"}
              onClick={() => setRightTab("sources")}
            >
              Sources
            </button>
            <button
              type="button"
              className={rightTab === "study" ? "tab active" : "tab"}
              onClick={() => setRightTab("study")}
            >
              Study
            </button>
            <button
              type="button"
              className={rightTab === "notes" ? "tab active" : "tab"}
              onClick={() => setRightTab("notes")}
            >
              Co-writer
            </button>
            <span className="tab-spacer" />
            <span className="tab-meta" title="Selection">
              <PanelRight size={14} /> {selectedNodeId ? "Node selected" : "No selection"}
            </span>
          </div>
          <div className="right-body">
            {rightTab === "sources" && <Inspector nodeId={selectedNodeId} />}
            {rightTab === "study" && (
              <StudyPanel canvasId={canvasId} model={model} contextHint={contextHint} />
            )}
            {rightTab === "notes" && (
              <CoWriterPanel
                canvasId={canvasId}
                model={model}
                draft={draft}
                onDraftChange={setDraft}
                contextHint={contextHint}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
