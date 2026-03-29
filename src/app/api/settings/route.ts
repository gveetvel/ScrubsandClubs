import { NextRequest, NextResponse } from "next/server";
import { listProjectState, updateBrandSettings } from "@/lib/server/project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { settings } = await listProjectState();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: NextRequest) {
  const patch = (await request.json()) as Record<string, unknown>;
  const settings = await updateBrandSettings({
    overlayCaptionColor: typeof patch.overlayCaptionColor === "string" ? patch.overlayCaptionColor : undefined,
    subtitlePreset: typeof patch.subtitlePreset === "string" ? patch.subtitlePreset : undefined,
    hookStylePreset: typeof patch.hookStylePreset === "string" ? patch.hookStylePreset : undefined,
    tonePreset: typeof patch.tonePreset === "string" ? patch.tonePreset : undefined,
    platformPreset: typeof patch.platformPreset === "string" ? (patch.platformPreset as "YouTube Shorts" | "Instagram Reels" | "TikTok") : undefined
  });

  return NextResponse.json({ data: settings });
}
