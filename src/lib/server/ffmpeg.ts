import { mkdir } from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export const FFMPEG_PATH = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe");
const TEMP_DIR = path.join(process.cwd(), "data", "tmp");

export async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

const FFMPEG_TIMEOUT_MS = 120_000;

export async function runFfmpeg(args: string[]) {
  await ensureTempDir();

  const ffmpegPromise = new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    let errorOutput = "";

    ffmpeg.stderr.on("data", (chunk) => {
      errorOutput += String(chunk);
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(errorOutput || `ffmpeg exited with code ${code}`));
    });
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("ffmpeg timed out after 120 seconds")), FFMPEG_TIMEOUT_MS)
  );

  return Promise.race([ffmpegPromise, timeoutPromise]);
}

export function tempDir() {
  return TEMP_DIR;
}
