import { OpenRouter } from "@openrouter/sdk";
import { OpenRouterError } from "@openrouter/sdk/models/errors";
import { NextResponse } from "next/server";

import {
  DEFAULT_GEMMA_STUDY_MODEL,
  isAllowedGemmaStudyModel,
} from "@/lib/gemma-models";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GeneratedFlashcard = {
  id?: string;
  front: string;
  back: string;
};

function parseJsonArrayContent(content: string): unknown[] {
  let cleanContent = content.trim();
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.slice(7, -3).trim();
  } else if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.slice(3, -3).trim();
  }

  const parsed = JSON.parse(cleanContent) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Model output is not a JSON array.");
  }
  return parsed;
}

function normalizeFlashcards(raw: unknown[]): GeneratedFlashcard[] {
  const cards: GeneratedFlashcard[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const front = typeof obj.front === "string" ? obj.front.trim() : "";
    const back = typeof obj.back === "string" ? obj.back.trim() : "";
    if (!front || !back) continue;
    cards.push({ front, back });
  }
  return cards.slice(0, 32);
}

async function resolveNodeNameForCanvas(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  nodeId: string,
  canvasId: string
): Promise<{ id: string; name: string } | null> {
  const { data: node, error: nodeErr } = await supabase
    .from("nodes")
    .select("id,name,document_id")
    .eq("id", nodeId)
    .maybeSingle();
  if (nodeErr || !node || !node.document_id) return null;

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", node.document_id)
    .eq("canvas_id", canvasId)
    .maybeSingle();
  if (docErr || !doc) return null;

  return { id: node.id as string, name: (node.name as string) ?? "Concept" };
}

function userFacingOpenRouterMessage(err: OpenRouterError): string {
  if (err.statusCode === 429) {
    try {
      const parsed = JSON.parse(err.body) as {
        error?: { metadata?: { raw?: string }; message?: string };
      };
      const raw = parsed.error?.metadata?.raw;
      if (typeof raw === "string" && raw.length > 0) return raw;
    } catch {
      /* ignore */
    }
    return "This Gemma endpoint is temporarily rate-limited upstream.";
  }
  return err.message || "OpenRouter request failed.";
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add OPENROUTER_API_KEY to your environment (e.g. .env.local)." },
      { status: 503 }
    );
  }

  let body: {
    contextHint: string;
    model?: string;
    canvasId?: string;
    nodeId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.canvasId) {
    return NextResponse.json({ error: "canvasId is required" }, { status: 400 });
  }

  if (!body.contextHint || body.contextHint.trim() === "") {
    return NextResponse.json({ error: "contextHint is required" }, { status: 400 });
  }

  const { data: canvas, error: canvasErr } = await supabase
    .from("canvases")
    .select("id")
    .eq("id", body.canvasId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (canvasErr || !canvas) {
    return NextResponse.json({ error: "Study Set not found" }, { status: 404 });
  }

  const raw = body.model ?? process.env.OPENROUTER_MODEL_STUDY;
  const model =
    raw && isAllowedGemmaStudyModel(raw) ? raw : DEFAULT_GEMMA_STUDY_MODEL;

  const openrouter = new OpenRouter({ apiKey });

  try {
    const result = await openrouter.chat.send({
      chatRequest: {
        model,
        messages: [
          {
             role: "system",
             content: "You are an expert tutor. Create 3 to 5 highly effective flashcards based strictly on the provided context. Return exactly a JSON array of objects, where each object has a 'front' and a 'back' property. Ensure the JSON is well-formed. Output ONLY JSON, do not wrap in markdown tags like ```json"
          },
          {
             role: "user",
             content: `Context:\n${body.contextHint}\n\nGenerate flashcards:`
          }
        ],
        stream: false,
      },
    });

    const content = result.choices?.[0]?.message?.content || "[]";
    let generatedCards: GeneratedFlashcard[];
    try {
      generatedCards = normalizeFlashcards(parseJsonArrayContent(content));
    } catch {
      console.error("Failed to parse Gemma output:", content);
      return NextResponse.json(
        { error: "Failed to generate structured flashcards.", rawContent: content },
        { status: 500 }
      );
    }

    if (generatedCards.length === 0) {
      return NextResponse.json(
        { error: "No valid flashcards were generated from the selected context." },
        { status: 422 }
      );
    }

    let deckId: string | null = null;
    let warning: string | null = null;

    try {
      const scopedNode = body.nodeId
        ? await resolveNodeNameForCanvas(supabase, body.nodeId, body.canvasId)
        : null;

      const { data: deckRow, error: deckErr } = await supabase
        .from("study_decks")
        .insert({
          user_id: user.id,
          canvas_id: body.canvasId,
          node_id: scopedNode?.id ?? null,
          title: scopedNode?.name
            ? `${scopedNode.name} Flashcards`
            : "Generated Flashcards",
          source_context: body.contextHint.slice(0, 12000),
          model,
        })
        .select("id")
        .single();

      if (deckErr || !deckRow) {
        throw deckErr ?? new Error("Could not create study deck.");
      }
      deckId = deckRow.id as string;

      const { error: cardInsertErr } = await supabase
        .from("study_flashcards")
        .insert(
          generatedCards.map((card, position) => ({
            deck_id: deckId,
            position,
            front: card.front,
            back: card.back,
          }))
        );
      if (cardInsertErr) throw cardInsertErr;

      const { data: savedRows, error: savedErr } = await supabase
        .from("study_flashcards")
        .select("id,front,back,position")
        .eq("deck_id", deckId)
        .order("position", { ascending: true });
      if (savedErr) throw savedErr;

      generatedCards = (savedRows ?? []).map((row) => ({
        id: row.id as string,
        front: row.front as string,
        back: row.back as string,
      }));
    } catch (persistErr) {
      console.error("Failed to persist flashcards", persistErr);
      warning =
        "Flashcards were generated but could not be saved yet. Review works, but history is not persisted for this run.";
      if (deckId) {
        await supabase.from("study_decks").delete().eq("id", deckId);
        deckId = null;
      }
    }

    return NextResponse.json({
      flashcards: generatedCards,
      deckId,
      persisted: Boolean(deckId),
      warning,
    });

  } catch (e) {
    if (e instanceof OpenRouterError) {
      const status =
        e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 502;
      return NextResponse.json(
        { error: userFacingOpenRouterMessage(e) },
        { status }
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not generate flashcards." },
      { status: 500 }
    );
  }
}
