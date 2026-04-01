import { NextRequest, NextResponse } from "next/server";
import { handleGoogleCallback } from "@/lib/server/google-drive";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?drive_error=${encodeURIComponent(error)}`, request.nextUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?drive_error=missing_code", request.nextUrl.origin));
  }

  try {
    await handleGoogleCallback(code);
    return NextResponse.redirect(new URL("/?drive_connected=1", request.nextUrl.origin));
  } catch (e) {
    console.error("Failed to handle Google callback:", e);
    return NextResponse.redirect(new URL("/?drive_error=internal_error", request.nextUrl.origin));
  }
}
