"use client";

import "reactflow/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { CanvasEdgeRow } from "@/types/zylum";
import type { GraphDensity } from "@/types/zylum";
import type { DbNode } from "@/types/episteme";

function colorForType(t: string): string {
  if (t === "Person") return "#2563eb";
  if (t === "Event") return "#16a34a";
  return "#9333ea";
}

function toFlowNode(n: DbNode): Node {
  return {
    id: n.id,
    position: { x: n.x_pos ?? 0, y: n.y_pos ?? 0 },
    data: {
      label: n.name,
      summary: n.summary,
      type: n.type,
    },
    style: {
      background: colorForType(n.type),
      color: "#fff",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 13,
      border: "1px solid rgba(255,255,255,0.25)",
      maxWidth: 220,
    },
  };
}

function toFlowEdges(rows: CanvasEdgeRow[]): Edge[] {
  return rows.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label ?? undefined,
    style: { stroke: "var(--accent)", strokeWidth: 2 },
  }));
}

type Props = {
  canvasId: string;
  graphDensity: GraphDensity;
  onSelectNode: (id: string | null) => void;
};

export function KnowledgeCanvas({ canvasId, graphDensity, onSelectNode }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [edgeRows, setEdgeRows] = useState<CanvasEdgeRow[]>([]);
  const docIdsRef = useRef<Set<string>>(new Set());

  const mergeDbNode = useCallback(
    (row: DbNode) => {
      setNodes((prev) => {
        const next = [...prev];
        const idx = next.findIndex((x) => x.id === row.id);
        const nf = toFlowNode(row);
        if (idx >= 0) next[idx] = nf;
        else next.push(nf);
        return next;
      });
    },
    [setNodes]
  );

  const loadAll = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data: docs, error: docErr } = await supabase
      .from("documents")
      .select("id")
      .eq("canvas_id", canvasId);
    if (docErr) {
      console.error(docErr);
      return;
    }
    const ids = (docs ?? []).map((d) => d.id as string);
    docIdsRef.current = new Set(ids);

    if (ids.length === 0) {
      setNodes([]);
      setEdgeRows([]);
      setEdges([]);
      return;
    }

    const { data: nodeData, error: nodeErr } = await supabase
      .from("nodes")
      .select("*")
      .in("document_id", ids)
      .order("name", { ascending: true });
    if (nodeErr) {
      console.error(nodeErr);
      return;
    }
    const rows = (nodeData ?? []) as DbNode[];
    setNodes(rows.map(toFlowNode));

    const { data: eData, error: eErr } = await supabase
      .from("canvas_edges")
      .select("id,canvas_id,source_node_id,target_node_id,label,weight")
      .eq("canvas_id", canvasId);
    if (eErr) {
      console.error(eErr);
      setEdgeRows([]);
      setEdges([]);
      return;
    }
    const er = (eData ?? []) as CanvasEdgeRow[];
    setEdgeRows(er);
  }, [canvasId, setEdges, setNodes]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const visibleEdgeRows = useMemo(() => {
    const sorted = [...edgeRows].sort((a, b) => b.weight - a.weight);
    if (graphDensity === "overview") return sorted.slice(0, 48);
    return sorted;
  }, [edgeRows, graphDensity]);

  useEffect(() => {
    setEdges(toFlowEdges(visibleEdgeRows));
  }, [visibleEdgeRows, setEdges]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`nodes-canvas-${canvasId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "documents",
          filter: `canvas_id=eq.${canvasId}`,
        },
        () => {
          void loadAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nodes" },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old && "id" in payload.old) {
            const id = String((payload.old as { id: string }).id);
            setNodes((prev) => prev.filter((n) => n.id !== id));
            return;
          }
          const row = (payload.new ?? payload.old) as DbNode | undefined;
          if (!row?.id || !row.document_id) return;
          if (!docIdsRef.current.has(row.document_id)) return;
          if (payload.eventType === "DELETE") {
            setNodes((prev) => prev.filter((n) => n.id !== row.id));
            return;
          }
          mergeDbNode(row);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvas_edges",
          filter: `canvas_id=eq.${canvasId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old && "id" in payload.old) {
            const id = String((payload.old as { id: string }).id);
            setEdgeRows((prev) => prev.filter((e) => e.id !== id));
            return;
          }
          const row = payload.new as CanvasEdgeRow | undefined;
          if (!row?.id) return;
          setEdgeRows((prev) => {
            const idx = prev.findIndex((e) => e.id === row.id);
            if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== row.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return next;
            }
            return [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canvasId, mergeDbNode, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <MiniMap
          nodeColor={() => "var(--accent)"}
          maskColor="rgba(0,0,0,0.12)"
        />
        <Controls />
      </ReactFlow>
      {graphDensity === "overview" && edgeRows.length > visibleEdgeRows.length && (
        <div className="canvas-hint">
          Overview: showing top {visibleEdgeRows.length} links by weight. Switch to Full graph for
          everything.
        </div>
      )}
    </div>
  );
}
