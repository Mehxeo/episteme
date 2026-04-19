"use client";

import { useState } from "react";

import { KnowledgeCanvas } from "@/components/KnowledgeCanvas";
import { Inspector } from "@/components/Inspector";
import { Uploader } from "@/components/Uploader";

export function EpistemeApp() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Episteme</h1>
        <p className="tagline">PDF → entities → live canvas</p>
      </header>
      <main className="panes">
        <section className="pane left">
          <Uploader />
        </section>
        <section className="pane center">
          <KnowledgeCanvas onSelectNode={setSelectedNodeId} />
        </section>
        <section className="pane right">
          <Inspector key={selectedNodeId ?? "none"} nodeId={selectedNodeId} />
        </section>
      </main>
    </div>
  );
}
