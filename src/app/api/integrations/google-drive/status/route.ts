import { NextRequest, NextResponse } from "next/server";
import { getDriveProvider } from "@/lib/services/integrations/google-drive";

export async function GET(request: NextRequest) {
  const provider = getDriveProvider();
  const origin = request.nextUrl.origin;
  const data = await provider.getConnectionStatus(origin);
  return NextResponse.json({ data });
}
