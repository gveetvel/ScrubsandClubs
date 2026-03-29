import { NextRequest, NextResponse } from "next/server";
import { getDriveProvider } from "@/lib/services/integrations/google-drive";

export async function POST(request: NextRequest) {
  const provider = getDriveProvider();
  const url = await provider.getAuthorizationUrl(request.nextUrl.origin);
  return NextResponse.json({ data: { url } });
}
