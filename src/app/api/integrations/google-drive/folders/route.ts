import { NextResponse } from "next/server";
import { getDriveProvider } from "@/lib/services/integrations/google-drive";

export async function GET() {
  try {
    const provider = getDriveProvider();
    const data = await provider.listFolders();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load folders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
