import { NextResponse } from "next/server";
import { edge } from "@/lib/edge";

const ALLOWED = new Set(["save", "photo_new", "photo_done", "photo_caption", "photo_remove"]);

// Browser -> this route -> edge function. Only whitelisted actions are forwarded.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.token !== "string" || !ALLOWED.has(body.action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { action, token, ...rest } = body;
  try {
    const r = await edge(action, token, rest);
    return NextResponse.json(r.data, { status: r.status });
  } catch {
    return NextResponse.json({ error: "Couldn’t reach the server. Please check your connection." }, { status: 502 });
  }
}
