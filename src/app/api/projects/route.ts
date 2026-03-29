import { NextResponse } from "next/server";
import { listProjectState } from "@/lib/server/project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await listProjectState();
  return NextResponse.json({ data });
}
