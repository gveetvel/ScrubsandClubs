import { NextRequest, NextResponse } from "next/server";
import { listRenderedDrafts } from "@/lib/server/rendered-short-repository";
import { renderShortDraftById } from "@/lib/server/short-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const data = await listRenderedDrafts();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { shortId?: string };

  if (!body.shortId) {
    return NextResponse.json({ error: "A shortId is required." }, { status: 400 });
  }

  try {
    const data = await renderShortDraftById(body.shortId);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render short draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
