import { NextRequest, NextResponse } from "next/server";
import { listProjectState, replacePublishingQueue, upsertPublishingItem } from "@/lib/server/project-repository";
import { PublishingItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { publishingQueue } = await listProjectState();
  return NextResponse.json({ data: publishingQueue });
}

export async function POST(request: NextRequest) {
  const item = (await request.json()) as PublishingItem;
  const data = await upsertPublishingItem(item);
  return NextResponse.json({ data });
}

export async function DELETE() {
  const data = await replacePublishingQueue([]);
  return NextResponse.json({ data });
}
