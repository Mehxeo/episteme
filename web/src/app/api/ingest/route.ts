import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const hfUrl = process.env.HF_INGEST_URL;
  const secret = process.env.INGEST_SECRET;

  if (!hfUrl) {
    return NextResponse.json(
      { error: "HF_INGEST_URL is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Ingest-Secret"] = secret;
  }

  const upstream = await fetch(`${hfUrl.replace(/\/$/, "")}/process`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return NextResponse.json(json, { status: upstream.status });
}
