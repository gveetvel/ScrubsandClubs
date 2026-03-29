import { NextRequest, NextResponse } from "next/server";
import { listLocalUploads, saveUploadedVideos } from "@/lib/server/local-upload-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACCEPTED_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_UPLOAD_SIZE_MB = Number(process.env.LOCAL_UPLOAD_MAX_MB ?? "1024");
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
const MIN_UPLOAD_SIZE_BYTES = 1024;

export async function GET() {
  const data = await listLocalUploads();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const linkedIdeaId = formData.get("linkedIdeaId");
  const durations = formData.getAll("durationSeconds");

  if (files.length === 0) {
    return NextResponse.json({ error: "At least one video file is required." }, { status: 400 });
  }

  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
    }

    if (file.size < MIN_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is too small to be a valid video file. Please upload the original MP4 or MOV export.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: `${file.name} exceeds the ${MAX_UPLOAD_SIZE_MB} MB upload limit.` }, { status: 400 });
    }
  }

  const payload = files.map((file, index) => ({
    file,
    linkedIdeaId: typeof linkedIdeaId === "string" && linkedIdeaId.length > 0 ? linkedIdeaId : undefined,
    durationSeconds: Number(durations[index] ?? "0") || null
  }));

  const data = await saveUploadedVideos({ files: payload });
  return NextResponse.json({ data });
}
