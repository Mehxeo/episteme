export type NodeType = "Person" | "Event" | "Concept";

export type DbNode = {
  id: string;
  document_id: string | null;
  type: string;
  name: string;
  summary: string | null;
  x_pos: number | null;
  y_pos: number | null;
};

export type DbChunk = {
  id: string;
  document_id: string | null;
  node_id: string | null;
  content: string;
};
