import { mkdir } from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export const FFMPEG_PATH = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe");
const TEMP_DIR = path.join(process.cwd(), "data", "tmp");

export async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

export async function runFfmpeg(args: string[]) {
  await ensureTempDir();

  return new Promise<void>((resolve, reject) => {
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
}

export function tempDir() {
  return TEMP_DIR;
}
