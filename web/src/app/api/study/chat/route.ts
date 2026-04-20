import { OpenRouter } from "@openrouter/sdk";
import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

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

  let body: { messages?: ChatMessage[]; model?: string; canvasId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body.messages;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  if (body.canvasId) {
    const { data: canvas, error } = await supabase
      .from("canvases")
      .select("id")
      .eq("id", body.canvasId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }
  }

  const model =
    body.model ??
    process.env.OPENROUTER_MODEL_STUDY ??
    "openai/gpt-oss-120b:free";

  const openrouter = new OpenRouter({ apiKey });

  const stream = await openrouter.chat.send({
    chatRequest: {
      model,
      messages,
      stream: true,
    },
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e instanceof Error ? e : new Error(String(e)));
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
