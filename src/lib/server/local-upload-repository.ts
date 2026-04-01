import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { MediaAsset, SourceVideo, TranscriptSegment } from "@/lib/types";
import { sanitizeFilename } from "@/lib/format-utils";

interface UploadManifest {
  mediaAssets: MediaAsset[];
  sourceVideos: SourceVideo[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const MANIFEST_PATH = path.join(DATA_DIR, "local-uploads.json");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

async function ensureStorage() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
}

async function readManifest(): Promise<UploadManifest> {
  await ensureStorage();
  try {
    const content = await readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(content) as UploadManifest;
  } catch {
    return { mediaAssets: [], sourceVideos: [] };
  }
}

async function writeManifest(manifest: UploadManifest) {
  await ensureStorage();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function formatDuration(seconds?: number | null) {
  if (!seconds || Number.isNaN(seconds)) {
    return "Unknown";
  }
  const whole = Math.max(Math.round(seconds), 0);
  const minutes = String(Math.floor(whole / 60)).padStart(2, "0");
  const remainder = String(whole % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export async function listLocalUploads() {
  return readManifest();
}

export async function getLocalUploadByVideoId(videoId: string) {
  const manifest = await readManifest();
  const sourceVideo = manifest.sourceVideos.find((video) => video.id === videoId) ?? null;
  if (!sourceVideo) {
    return null;
  }

  const mediaAsset = manifest.mediaAssets.find((asset) => asset.id === sourceVideo.assetId) ?? null;
  return { sourceVideo, mediaAsset };
}

export async function saveUploadedVideos(input: {
  files: Array<{ file: File; linkedIdeaId?: string; durationSeconds?: number | null; projectId?: string }>;
}) {
  await ensureStorage();
  const manifest = await readManifest();
  const createdAssets: MediaAsset[] = [];
  const createdVideos: SourceVideo[] = [];

  for (const entry of input.files) {
    const ext = path.extname(entry.file.name);
    const basename = path.basename(entry.file.name, ext);
    const uniqueName = `${sanitizeFilename(basename)}-${randomUUID().slice(0, 8)}${ext}`;
    const absolutePath = path.join(UPLOADS_DIR, uniqueName);
    const buffer = Buffer.from(await entry.file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    const assetId = `upload-asset-${randomUUID().slice(0, 10)}`;
    const videoId = `upload-video-${randomUUID().slice(0, 10)}`;
    const uploadDate = new Date().toISOString().slice(0, 10);
    const storagePath = `/uploads/${uniqueName}`;

    const asset: MediaAsset = {
      id: assetId,
      filename: entry.file.name,
      duration: formatDuration(entry.durationSeconds),
      uploadDate,
      tags: ["local upload", "source video"],
      sourceFolder: "Local uploads",
      project: "Uploaded videos",
      sourceType: "local_upload",
      mimeType: entry.file.type,
      sizeBytes: entry.file.size,
      storagePath,
      uploadStatus: "uploaded",
      linkedIdeaId: entry.linkedIdeaId,
      projectId: entry.projectId
    };

    const sourceVideo: SourceVideo = {
      id: videoId,
      title: basename,
      description: "Uploaded locally and ready for AI-assisted short generation.",
      duration: formatDuration(entry.durationSeconds),
      transcriptStatus: "not_started",
      analysisStatus: "not_started",
      assetId,
      ideaIds: entry.linkedIdeaId ? [entry.linkedIdeaId] : [],
      shortsExtracted: 0,
      sourceType: "local_upload",
      mimeType: entry.file.type,
      sizeBytes: entry.file.size,
      storagePath,
      uploadStatus: "uploaded",
      linkedIdeaId: entry.linkedIdeaId,
      projectId: entry.projectId
    };

    createdAssets.push(asset);
    createdVideos.push(sourceVideo);
  }

  const nextManifest: UploadManifest = {
    mediaAssets: [...createdAssets, ...manifest.mediaAssets],
    sourceVideos: [...createdVideos, ...manifest.sourceVideos]
  };

  await writeManifest(nextManifest);
  return { mediaAssets: createdAssets, sourceVideos: createdVideos };
}

export async function registerDownloadedVideo(input: {
  fileName: string;
  storagePath: string;
  title: string;
  sourceType?: string;
}) {
  await ensureStorage();
  const manifest = await readManifest();

  const assetId = `upload-asset-${randomUUID().slice(0, 10)}`;
  const videoId = `upload-video-${randomUUID().slice(0, 10)}`;
  const uploadDate = new Date().toISOString().slice(0, 10);

  const asset: MediaAsset = {
    id: assetId,
    filename: input.fileName,
    duration: "Unknown",
    uploadDate,
    tags: ["google drive import", "source video"],
    sourceFolder: "Google Drive",
    project: "Uploaded videos",
    sourceType: (input.sourceType ?? "google_drive") as MediaAsset["sourceType"],
    mimeType: "video/mp4",
    sizeBytes: 0,
    storagePath: input.storagePath,
    uploadStatus: "uploaded"
  };

  const sourceVideo: SourceVideo = {
    id: videoId,
    title: input.title,
    description: "Imported from Google Drive",
    duration: "Unknown",
    transcriptStatus: "not_started",
    analysisStatus: "not_started",
    assetId,
    ideaIds: [],
    shortsExtracted: 0,
    sourceType: "local_upload",
    mimeType: "video/mp4",
    sizeBytes: 0,
    storagePath: input.storagePath,
    uploadStatus: "uploaded"
  };

  const nextManifest: UploadManifest = {
    mediaAssets: [asset, ...manifest.mediaAssets],
    sourceVideos: [sourceVideo, ...manifest.sourceVideos]
  };

  await writeManifest(nextManifest);
  return { asset, sourceVideo };
}

export async function updateLocalUploadLink(videoId: string, linkedIdeaId: string | null) {
  const manifest = await readManifest();
  const nextManifest: UploadManifest = {
    mediaAssets: manifest.mediaAssets.map((asset) =>
      manifest.sourceVideos.some((video) => video.id === videoId && video.assetId === asset.id)
        ? { ...asset, linkedIdeaId: linkedIdeaId ?? undefined }
        : asset
    ),
    sourceVideos: manifest.sourceVideos.map((video) =>
      video.id === videoId
        ? {
            ...video,
            linkedIdeaId: linkedIdeaId ?? undefined,
            ideaIds: linkedIdeaId ? [linkedIdeaId] : []
          }
        : video
    )
  };

  await writeManifest(nextManifest);
  return nextManifest.sourceVideos.find((video) => video.id === videoId) ?? null;
}

export async function assignVideosToProject(videoIds: string[], projectId: string, projectTitle: string) {
  const manifest = await readManifest();
  const nextManifest: UploadManifest = {
    mediaAssets: manifest.mediaAssets.map((asset) =>
      manifest.sourceVideos.some((video) => videoIds.includes(video.id) && video.assetId === asset.id)
        ? { ...asset, projectId, project: projectTitle }
        : asset
    ),
    sourceVideos: manifest.sourceVideos.map((video) =>
      videoIds.includes(video.id)
        ? {
            ...video,
            projectId
          }
        : video
    )
  };

  await writeManifest(nextManifest);
  return nextManifest.sourceVideos.filter((video) => videoIds.includes(video.id));
}

export async function updateVideoAnalysis(
  videoId: string,
  patch: Partial<
    Pick<
      SourceVideo,
      | "transcriptStatus"
      | "analysisStatus"
      | "transcriptSegments"
      | "transcriptPreview"
      | "transcriptSource"
      | "transcriptionProvider"
      | "analysisProvider"
      | "transcriptWarning"
      | "shortsExtracted"
      | "description"
      | "projectId"
    >
  >
) {
  const manifest = await readManifest();
  let nextVideo: SourceVideo | null = null;
  const nextManifest: UploadManifest = {
    mediaAssets: manifest.mediaAssets,
    sourceVideos: manifest.sourceVideos.map((video) => {
      if (video.id !== videoId) {
        return video;
      }

      nextVideo = {
        ...video,
        ...patch
      };

      return nextVideo;
    })
  };

  await writeManifest(nextManifest);
  return nextVideo;
}

export async function replaceVideoTranscripts(
  videoId: string,
  transcriptSegments: TranscriptSegment[],
  patch?: Partial<SourceVideo>
) {
  return updateVideoAnalysis(videoId, {
    transcriptSegments,
    transcriptPreview: transcriptSegments.slice(0, 2).map((item) => item.text).join(" "),
    ...patch
  });
}
