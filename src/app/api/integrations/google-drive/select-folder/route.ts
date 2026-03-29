import { NextRequest, NextResponse } from "next/server";
import { getDriveProvider } from "@/lib/services/integrations/google-drive";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { folderId?: string; folderName?: string };
  if (!body.folderId || !body.folderName) {
    return NextResponse.json({ error: "folderId and folderName are required" }, { status: 400 });
  }

  const provider = getDriveProvider();
  await provider.setSelectedFolder(body.folderId, body.folderName);
  return NextResponse.json({ ok: true });
}
