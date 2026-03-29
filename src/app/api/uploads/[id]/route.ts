import { NextRequest, NextResponse } from "next/server";
import { updateLocalUploadLink } from "@/lib/server/local-upload-repository";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { linkedIdeaId?: string | null };
  const updated = await updateLocalUploadLink(id, body.linkedIdeaId ?? null);
  return NextResponse.json({ data: updated });
}
