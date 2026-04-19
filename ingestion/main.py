import json
import os
import re
import uuid
from typing import Any, Optional

import fitz
import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from supabase import Client, create_client

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
CHAT_MODEL = os.environ.get("OPENROUTER_CHAT_MODEL", "meta-llama/llama-3.1-8b-instruct")
EMBED_MODEL_NAME = os.environ.get(
    "EMBED_MODEL_NAME", "sentence-transformers/all-mpnet-base-v2"
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
INGEST_SECRET = os.environ.get("INGEST_SECRET", "")

_embedder: Optional[SentenceTransformer] = None


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL_NAME)
    return _embedder


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase is not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


app = FastAPI(title="Episteme Ingestion")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessBody(BaseModel):
    document_id: uuid.UUID
    file_url: str = Field(..., min_length=4)


def require_ingest_secret(x_ingest_secret: Optional[str] = Header(default=None)) -> None:
    if not INGEST_SECRET:
        return
    if x_ingest_secret != INGEST_SECRET:
        raise HTTPException(status_code=401, detail="Invalid ingest secret")


def download_pdf(url: str) -> bytes:
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.content


def extract_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    parts: list[str] = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    return "\n".join(parts).strip()


def chunk_by_words(text: str, max_words: int = 500) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    for i in range(0, len(words), max_words):
        chunk = " ".join(words[i : i + max_words])
        if chunk:
            chunks.append(chunk)
    return chunks


def extract_entities_llm(full_text: str) -> list[dict[str, Any]]:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not set")

    truncated = full_text[:50000]
    prompt = (
        "Extract all historical figures, events, and notable concepts from the text below. "
        'Respond with ONLY valid JSON: an array of objects with keys '
        '"type" (one of Person, Event, Concept), "name" (short string), '
        '"summary" (one or two sentences, may be empty string).\n\n'
        f"TEXT:\n{truncated}"
    )
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": CHAT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    r = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return parse_entity_json(content)


def parse_entity_json(content: str) -> list[dict[str, Any]]:
    content = content.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if fence:
        content = fence.group(1).strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        start = content.find("[")
        end = content.rfind("]")
        if start >= 0 and end > start:
            parsed = json.loads(content[start : end + 1])
        else:
            raise HTTPException(status_code=502, detail="LLM did not return parseable JSON")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="LLM JSON must be an array")
    out: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        t = str(item.get("type", "Concept")).strip()
        if t not in ("Person", "Event", "Concept"):
            t = "Concept"
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        summary = item.get("summary")
        out.append(
            {
                "type": t,
                "name": name,
                "summary": (str(summary).strip() if summary is not None else ""),
            }
        )
    return out


def link_chunks_to_nodes(
    supabase: Client,
    chunk_rows: list[dict[str, Any]],
    node_ids_by_name: dict[str, str],
) -> None:
    for row in chunk_rows:
        cid = row["id"]
        text_lower = row["content"].lower()
        matched: Optional[str] = None
        for name, nid in node_ids_by_name.items():
            if name.lower() in text_lower:
                matched = nid
                break
        if matched:
            supabase.table("chunks").update({"node_id": matched}).eq("id", cid).execute()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/process")
def process(
    body: ProcessBody,
    x_ingest_secret: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    require_ingest_secret(x_ingest_secret)

    supabase = get_supabase()
    pdf_bytes = download_pdf(body.file_url)
    text = extract_text(pdf_bytes)
    if not text:
        raise HTTPException(status_code=400, detail="No extractable text in PDF")

    chunks = chunk_by_words(text, max_words=500)
    embedder = get_embedder()
    embeddings = embedder.encode(chunks, show_progress_bar=False)
    if embeddings.ndim == 1:
        embeddings = embeddings.reshape(1, -1)

    for i, content in enumerate(chunks):
        emb = embeddings[i].tolist()
        supabase.table("chunks").insert(
            {
                "document_id": str(body.document_id),
                "content": content,
                "embedding": emb,
            }
        ).execute()

    # Re-fetch chunk rows for linking (ids + content)
    chunk_rows = (
        supabase.table("chunks")
        .select("id,content")
        .eq("document_id", str(body.document_id))
        .execute()
    ).data or []

    entities = extract_entities_llm(text)
    node_ids_by_name: dict[str, str] = {}
    for idx, ent in enumerate(entities):
        x_pos = float((idx % 5) * 220)
        y_pos = float((idx // 5) * 140)
        ins = (
            supabase.table("nodes")
            .insert(
                {
                    "document_id": str(body.document_id),
                    "type": ent["type"],
                    "name": ent["name"],
                    "summary": ent.get("summary") or None,
                    "x_pos": x_pos,
                    "y_pos": y_pos,
                }
            )
            .execute()
        )
        if ins.data:
            nid = ins.data[0]["id"]
            node_ids_by_name[ent["name"]] = nid

    link_chunks_to_nodes(supabase, chunk_rows, node_ids_by_name)

    return {
        "document_id": str(body.document_id),
        "chunks": len(chunks),
        "nodes": len(entities),
    }
