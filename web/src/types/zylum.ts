export type GraphDensity = "overview" | "full";

export type CanvasSettings = {
  graphDensity?: GraphDensity;
};

export type DbCanvas = {
  id: string;
  user_id: string;
  title: string;
  settings: CanvasSettings | null;
  created_at: string;
  updated_at: string;
};

export type CanvasEdgeRow = {
  id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  weight: number;
};

export type ThemePresetId = "midnight" | "paper" | "sepia" | "ocean";

export type ThemeVars = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
  ok: string;
  glow: string;
};
