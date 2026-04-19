"use client";

import "reactflow/dist/style.css";

import { useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { createBrowserSupabase } from "@/lib/supabase/client";
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

type Props = {
  onSelectNode: (id: string | null) => void;
};

export function KnowledgeCanvas({ onSelectNode }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);

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

  const loadInitial = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.from("nodes").select("*").order("name", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const rows = (data ?? []) as DbNode[];
    setNodes(rows.map(toFlowNode));
  }, [setNodes]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("nodes-realtime")
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
          if (!row?.id) return;
          mergeDbNode(row);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mergeDbNode, setNodes]);

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
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}
