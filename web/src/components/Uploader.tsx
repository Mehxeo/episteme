"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { createBrowserSupabase } from "@/lib/supabase/client";

type Props = {
  onUploaded?: (documentId: string) => void;
};

export function Uploader({ onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a PDF file.");
        return;
      }
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const supabase = createBrowserSupabase();
        const objectPath = `${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("archives")
          .upload(objectPath, file, { upsert: true, contentType: "application/pdf" });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from("archives").getPublicUrl(objectPath);
        const fileUrl = pub.publicUrl;

        const { data: doc, error: docErr } = await supabase
          .from("documents")
          .insert({ filename: file.name, file_url: fileUrl })
          .select("id")
          .single();
        if (docErr) throw docErr;

        const ingestRes = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: doc.id, file_url: fileUrl }),
        });
        if (!ingestRes.ok) {
          const detail: unknown = await ingestRes.json().catch(() => null);
          let msg = `Ingest failed (${ingestRes.status})`;
          if (detail && typeof detail === "object") {
            if ("error" in detail && typeof (detail as { error: unknown }).error === "string") {
              msg = (detail as { error: string }).error;
            } else if ("detail" in detail) {
              const d = (detail as { detail: unknown }).detail;
              msg = typeof d === "string" ? d : JSON.stringify(d);
            }
          }
          throw new Error(msg);
        }

        setMessage("Upload complete. Processing on the worker…");
        onUploaded?.(doc.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) void runUpload(f);
    },
    [runUpload]
  );

  const onInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void runUpload(f);
      e.target.value = "";
    },
    [runUpload]
  );

  return (
    <div className="uploader">
      <h2 className="uploader-title">Upload</h2>
      <p className="uploader-hint">Drop a PDF or choose a file. It is stored in Supabase and sent to the ingest worker.</p>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {busy ? <Loader2 className="spin" size={28} /> : <FileUp size={28} />}
        <span>{busy ? "Working…" : "Drop PDF here"}</span>
        <input type="file" accept="application/pdf" onChange={onInput} disabled={busy} />
      </label>
      {message && <p className="ok">{message}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
