import { NextRequest, NextResponse } from "next/server";
import { getDriveProvider } from "@/lib/services/integrations/google-drive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?drive_error=${encodeURIComponent(error)}`, request.nextUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?drive_error=missing_code", request.nextUrl.origin));
  }

  try {
    const provider = getDriveProvider();
    await provider.handleOAuthCallback(request.nextUrl.origin, code, state);
    return NextResponse.redirect(new URL("/settings?drive_connected=1", request.nextUrl.origin));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "callback_failed";
    return NextResponse.redirect(new URL(`/settings?drive_error=${encodeURIComponent(message)}`, request.nextUrl.origin));
  }
}
