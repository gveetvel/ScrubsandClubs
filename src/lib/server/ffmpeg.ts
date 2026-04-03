import { mkdir } from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import ffmpegStaticPath from "ffmpeg-static";

// Use the platform-aware binary path exported by ffmpeg-static
export const FFMPEG_PATH = ffmpegStaticPath ?? path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
const TEMP_DIR = path.join(process.cwd(), "data", "tmp");

export async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

const FFMPEG_TIMEOUT_MS = 1_800_000; // 30 minutes for complex renders
const MAX_ERROR_BUFFER = 50_000; // Cap stderr collection at ~50KB

export async function runFfmpeg(
  args: string[],
  onProgress?: (time: string) => void,
  signal?: AbortSignal
) {
  await ensureTempDir();

  console.log(`[FFMPEG] Running: ${FFMPEG_PATH} ${args.slice(-1)[0]}`);

  let ffmpegProcess: ReturnType<typeof spawn> | null = null;
  let processExited = false;

  try {
    const ffmpegPromise = new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
      ffmpegProcess = ffmpeg;

      let errorOutput = "";

      ffmpeg.stderr.on("data", (chunk: Buffer) => {
        const output = String(chunk);

        // Cap error buffer to prevent memory growth on long renders
        if (errorOutput.length < MAX_ERROR_BUFFER) {
          errorOutput += output;
        }

        // Real-time debug logging
        process.stderr.write(chunk);

        if (onProgress) {
          const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);
          if (timeMatch) {
            onProgress(timeMatch[1]);
          }
        }
      });

      ffmpeg.on("error", (error) => {
        processExited = true;
        reject(error);
      });

      ffmpeg.on("close", (code) => {
        processExited = true;
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(errorOutput || `ffmpeg exited with code ${code}`));
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS / 1000} seconds`));
      }, FFMPEG_TIMEOUT_MS);

      ffmpegPromise.finally(() => clearTimeout(timeoutId));
    });

    // Only create the abort promise if a signal was actually provided
    const racers: Promise<any>[] = [ffmpegPromise, timeoutPromise];

    if (signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        if (signal.aborted) {
          return reject(new Error("ffmpeg render aborted by user"));
        }
        signal.addEventListener("abort", () => {
          reject(new Error("ffmpeg render aborted by user"));
        }, { once: true });
      });
      racers.push(abortPromise);
    }

    return await Promise.race(racers);
  } finally {
    // Only kill the process if it hasn't already exited
    if (ffmpegProcess && !processExited) {
      console.log(`[FFMPEG] Killing process to clean up...`);
      (ffmpegProcess as ReturnType<typeof spawn>).kill("SIGKILL");
    }
  }
}

export function tempDir() {
  return TEMP_DIR;
}
