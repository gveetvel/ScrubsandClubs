import { NextRequest, NextResponse } from "next/server";
import { getDriveProvider } from "@/lib/services/integrations/google-drive";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { folderId?: string };
    const provider = getDriveProvider();
    const data = await provider.importFolder(body.folderId);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import Google Drive folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
