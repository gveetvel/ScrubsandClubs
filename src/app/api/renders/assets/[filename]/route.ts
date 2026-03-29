import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentTypeFor(filename: string) {
  if (filename.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (filename.endsWith(".srt")) {
    return "application/x-subrip";
  }
  if (filename.endsWith(".json")) {
    return "application/json";
  }
  return "text/plain; charset=utf-8";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filePath = path.join(process.cwd(), "public", "rendered-exports", filename);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeFor(filename),
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Rendered asset not found." }, { status: 404 });
  }
}
