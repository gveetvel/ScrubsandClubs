"use server";

import { hasValidDriveTokens, findDriveContents, downloadDriveVideo, exportToDrive } from "@/lib/server/google-drive";
import { registerDownloadedVideo } from "@/lib/server/local-upload-repository";
import { revalidatePath } from "next/cache";

export async function checkDriveConnection() {
  return await hasValidDriveTokens();
}

export async function listDriveContents(folderId?: string, search?: string) {
  if (!(await hasValidDriveTokens())) {
    throw new Error("Not connected to Google Drive");
  }
  const files = await findDriveContents(folderId, search);
  return files.map(f => ({
    id: f.id || "",
    name: f.name || "Untitled",
    mimeType: f.mimeType || "",
    thumbnailLink: f.thumbnailLink,
    createdTime: f.createdTime,
    size: f.size
  })).filter(f => f.id);
}

export async function importDriveVideo({ fileId, fileName }: { fileId: string; fileName: string }) {
  if (!(await hasValidDriveTokens())) {
    throw new Error("Not connected to Google Drive");
  }

  // Clean file name to prevent issues and ensure local uniqueness
  const cleanName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const uniqueName = `${Date.now()}-${cleanName}`;

  const localPath = await downloadDriveVideo(fileId, uniqueName);
  const title = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
  const { sourceVideo } = await registerDownloadedVideo({ fileName: uniqueName, storagePath: localPath, title });

  return { localUrl: localPath, fileName: uniqueName, videoId: sourceVideo.id, sourceVideo };
}

export async function exportShortToDrive({ shortName, mp4Path, thumbnailPath, textContent }: { shortName: string; mp4Path: string; thumbnailPath?: string; textContent?: string }) {
  if (!(await hasValidDriveTokens())) {
    throw new Error("Not connected to Google Drive");
  }

  const pathsToExport = [mp4Path];
  if (thumbnailPath) {
    pathsToExport.push(thumbnailPath);
  }

  // Create a tempoary text file if textContent exists
  if (textContent) {
    const fs = require("fs");
    const path = require("path");
    const tempTextPath = path.join(process.cwd(), "public", "uploads", `Social_Media_Kit_${Date.now()}.txt`);
    fs.writeFileSync(tempTextPath, textContent, "utf-8");
    pathsToExport.push(tempTextPath);
  }

  const uploaded = await exportToDrive({ name: shortName, filePaths: pathsToExport });
  return uploaded;
}
