import { NextRequest, NextResponse } from "next/server";
import { deleteProject, updateProject } from "@/lib/server/project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const patch = (await request.json()) as Record<string, unknown>;
  const updated = await updateProject(id, patch);

  if (!updated) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await deleteProject(id);
  return new Response(null, { status: 204 });
}
