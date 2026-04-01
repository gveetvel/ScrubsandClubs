import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/server/google-drive";

export async function GET() {
  try {
    const url = await getGoogleAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Failed to generate Google Auth URL:", error);
    return new NextResponse("Internal Error: Could not generate auth URL. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in your .env", { status: 500 });
  }
}
