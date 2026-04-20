import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ReviewResult = "got_it" | "needs_review" | "correct" | "incorrect";

const VALID_RESULTS: ReviewResult[] = [
  "got_it",
  "needs_review",
  "correct",
  "incorrect",
];

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    canvasId?: string;
    deckId?: string;
    flashcardId?: string;
    quizSetId?: string;
    quizQuestionId?: string;
    sessionId?: string;
    result?: ReviewResult;
    confidence?: number;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.canvasId) {
    return NextResponse.json({ error: "canvasId is required" }, { status: 400 });
  }
  if (!body.result || !VALID_RESULTS.includes(body.result)) {
    return NextResponse.json({ error: "result is invalid" }, { status: 400 });
  }
  if (
    body.confidence !== undefined &&
    (!Number.isInteger(body.confidence) || body.confidence < 1 || body.confidence > 5)
  ) {
    return NextResponse.json(
      { error: "confidence must be an integer between 1 and 5" },
      { status: 400 }
    );
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

  const { error: insertErr } = await supabase.from("review_events").insert({
    user_id: user.id,
    canvas_id: body.canvasId,
    deck_id: body.deckId ?? null,
    flashcard_id: body.flashcardId ?? null,
    quiz_set_id: body.quizSetId ?? null,
    quiz_question_id: body.quizQuestionId ?? null,
    session_id: body.sessionId ?? null,
    result: body.result,
    confidence: body.confidence ?? null,
    metadata: body.metadata ?? {},
  });

  if (insertErr) {
    console.error("Failed to insert review event", insertErr);
    return NextResponse.json(
      { error: "Could not save review progress." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
