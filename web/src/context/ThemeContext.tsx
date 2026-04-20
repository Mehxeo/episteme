"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ThemePresetId, ThemeVars } from "@/types/zylum";

const STORAGE_KEY = "zylumgraph-theme";

const PRESETS: Record<ThemePresetId, ThemeVars> = {
  midnight: {
    bg: "#0f1115",
    panel: "#161a22",
    border: "#2a3140",
    text: "#e8eaef",
    muted: "#9aa3b5",
    accent: "#6d9cff",
    danger: "#f87171",
    ok: "#4ade80",
    glow: "#1a2140",
  },
  paper: {
    bg: "#f4f1ea",
    panel: "#fffefb",
    border: "#d9d3c6",
    text: "#1c1917",
    muted: "#57534e",
    accent: "#2563eb",
    danger: "#dc2626",
    ok: "#15803d",
    glow: "#e7e2d6",
  },
  sepia: {
    bg: "#1a1410",
    panel: "#241c16",
    border: "#4a3c32",
    text: "#f5e6d3",
    muted: "#b8a99a",
    accent: "#d4a574",
    danger: "#e57373",
    ok: "#81c784",
    glow: "#3d2e22",
  },
  ocean: {
    bg: "#0a1628",
    panel: "#0f2137",
    border: "#1e3a5f",
    text: "#e8f4fc",
    muted: "#8ba3c4",
    accent: "#38bdf8",
    danger: "#fb7185",
    ok: "#34d399",
    glow: "#134e6f",
  },
};

function applyVars(vars: ThemeVars) {
  const root = document.documentElement;
  root.style.setProperty("--bg", vars.bg);
  root.style.setProperty("--panel", vars.panel);
  root.style.setProperty("--border", vars.border);
  root.style.setProperty("--text", vars.text);
  root.style.setProperty("--muted", vars.muted);
  root.style.setProperty("--accent", vars.accent);
  root.style.setProperty("--danger", vars.danger);
  root.style.setProperty("--ok", vars.ok);
  root.style.setProperty("--glow", vars.glow);
}

type ThemeContextValue = {
  preset: ThemePresetId;
  setPreset: (id: ThemePresetId) => void;
  presets: typeof PRESETS;
  accentOverride: string | null;
  setAccentOverride: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<ThemePresetId>("midnight");
  const [accentOverride, setAccentOverride] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { preset?: ThemePresetId; accent?: string | null };
        if (parsed.preset && parsed.preset in PRESETS) setPresetState(parsed.preset);
        if (parsed.accent !== undefined) setAccentOverride(parsed.accent);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const base = PRESETS[preset];
    const vars = {
      ...base,
      ...(accentOverride ? { accent: accentOverride } : {}),
    };
    applyVars(vars);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset, accent: accentOverride })
      );
    } catch {
      /* ignore */
    }
  }, [preset, accentOverride, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("user_preferences")
          .select("theme")
          .eq("user_id", user.id)
          .maybeSingle();
        const t = data?.theme as { preset?: ThemePresetId; accent?: string | null } | undefined;
        if (t?.preset && t.preset in PRESETS) setPresetState(t.preset);
        if (t?.accent !== undefined) setAccentOverride(t.accent);
      } catch {
        /* table may not exist yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const persistRemote = useCallback(
    async (nextPreset: ThemePresetId, accent: string | null) => {
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("user_preferences").upsert(
          {
            user_id: user.id,
            theme: { preset: nextPreset, accent },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      } catch {
        /* optional */
      }
    },
    []
  );

  const setPresetWithSync = useCallback(
    (id: ThemePresetId) => {
      setPresetState(id);
      void persistRemote(id, accentOverride);
    },
    [accentOverride, persistRemote]
  );

  const setAccentOverrideWithSync = useCallback(
    (hex: string | null) => {
      setAccentOverride(hex);
      void persistRemote(preset, hex);
    },
    [preset, persistRemote]
  );

  const value = useMemo(
    () => ({
      preset,
      setPreset: setPresetWithSync,
      presets: PRESETS,
      accentOverride,
      setAccentOverride: setAccentOverrideWithSync,
    }),
    [preset, setPresetWithSync, accentOverride, setAccentOverrideWithSync]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeConfig must be used within ThemeProvider");
  return ctx;
}
