import { OpenRouter } from "@openrouter/sdk";
import { OpenRouterError } from "@openrouter/sdk/models/errors";
import { NextResponse } from "next/server";

import {
  DEFAULT_GEMMA_STUDY_MODEL,
  isAllowedGemmaStudyModel,
} from "@/lib/gemma-models";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GeneratedQuizQuestion = {
  id?: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
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

function normalizeQuestions(raw: unknown[]): GeneratedQuizQuestion[] {
  const questions: GeneratedQuizQuestion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const question = typeof obj.question === "string" ? obj.question.trim() : "";
    const explanation =
      typeof obj.explanation === "string" ? obj.explanation.trim() : "";
    const rawOptions = obj.options;
    const options = Array.isArray(rawOptions)
      ? rawOptions
          .map((option) => (typeof option === "string" ? option.trim() : ""))
          .filter((option) => option.length > 0)
          .slice(0, 4)
      : [];
    const answerIndex =
      Number.isInteger(obj.answerIndex)
        ? Number(obj.answerIndex)
        : -1;

    if (!question || options.length !== 4) continue;
    if (answerIndex < 0 || answerIndex >= options.length) continue;

    questions.push({
      question,
      options,
      answerIndex,
      explanation,
    });
  }
  return questions.slice(0, 32);
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
             content: "You are an expert testing coordinator. Based exclusively on the provided context, generate a 3-question multiple choice quiz. Return ONLY a JSON array of objects. Each object must have: 'question' (string), 'options' (an array of 4 string options), 'answerIndex' (0-3 representing the correct option), and 'explanation' (string explaining the answer). Do NOT include markdown blocks like ```json."
          },
          {
             role: "user",
             content: `Context:\n${body.contextHint}\n\nGenerate quiz:`
          }
        ],
        stream: false,
      },
    });

    const content = result.choices?.[0]?.message?.content || "[]";
    let generatedQuestions: GeneratedQuizQuestion[];
    try {
      generatedQuestions = normalizeQuestions(parseJsonArrayContent(content));
    } catch {
      console.error("Failed to parse Gemma output:", content);
      return NextResponse.json(
        { error: "Failed to generate structured quiz.", rawContent: content },
        { status: 500 }
      );
    }

    if (generatedQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid quiz questions were generated from the selected context." },
        { status: 422 }
      );
    }

    let quizSetId: string | null = null;
    let warning: string | null = null;

    try {
      const scopedNode = body.nodeId
        ? await resolveNodeNameForCanvas(supabase, body.nodeId, body.canvasId)
        : null;

      const { data: setRow, error: setErr } = await supabase
        .from("quiz_sets")
        .insert({
          user_id: user.id,
          canvas_id: body.canvasId,
          node_id: scopedNode?.id ?? null,
          title: scopedNode?.name ? `${scopedNode.name} Quiz` : "Generated Quiz",
          source_context: body.contextHint.slice(0, 12000),
          model,
        })
        .select("id")
        .single();

      if (setErr || !setRow) {
        throw setErr ?? new Error("Could not create quiz set.");
      }
      quizSetId = setRow.id as string;

      const { error: questionInsertErr } = await supabase
        .from("quiz_questions")
        .insert(
          generatedQuestions.map((question, position) => ({
            quiz_set_id: quizSetId,
            position,
            question: question.question,
            options: question.options,
            answer_index: question.answerIndex,
            explanation: question.explanation,
          }))
        );
      if (questionInsertErr) throw questionInsertErr;

      const { data: savedRows, error: savedErr } = await supabase
        .from("quiz_questions")
        .select("id,question,options,answer_index,explanation,position")
        .eq("quiz_set_id", quizSetId)
        .order("position", { ascending: true });
      if (savedErr) throw savedErr;

      generatedQuestions = (savedRows ?? []).map((row) => ({
        id: row.id as string,
        question: row.question as string,
        options: Array.isArray(row.options)
          ? row.options.filter((option): option is string => typeof option === "string")
          : [],
        answerIndex: row.answer_index as number,
        explanation: (row.explanation as string | null) ?? "",
      }));
    } catch (persistErr) {
      console.error("Failed to persist quiz", persistErr);
      warning =
        "Quiz was generated but could not be saved yet. You can still complete this run, but history is not persisted.";
      if (quizSetId) {
        await supabase.from("quiz_sets").delete().eq("id", quizSetId);
        quizSetId = null;
      }
    }

    return NextResponse.json({
      questions: generatedQuestions,
      quizSetId,
      persisted: Boolean(quizSetId),
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
      { error: "Could not generate quiz." },
      { status: 500 }
    );
  }
}
