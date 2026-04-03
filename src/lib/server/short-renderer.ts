import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { BrandStyleSettings, CapCutHandoffPackage, EditedShort, SubtitleCue } from "@/lib/types";
import { getLocalUploadByVideoId } from "@/lib/server/local-upload-repository";
import { getRenderedExportsDir, upsertRenderedDraft } from "@/lib/server/rendered-short-repository";
import { getShortDraftById, listProjectState, updateShortDraft } from "@/lib/server/project-repository";
import { runFfmpeg } from "@/lib/server/ffmpeg";
import { slugify as sanitize } from "@/lib/format-utils";

// ── Helpers ──────────────────────────────────────────────────────────

function toSrtTimestamp(value: string) {
  const parts = value.split(":");
  const hh = parts.length === 3 ? parts[0] : "00";
  const mm = parts.length === 3 ? parts[1] : parts[0] ?? "00";
  const ss = parts.length === 3 ? parts[2] : parts[1] ?? "00";
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")},000`;
}

function buildSrt(cues: SubtitleCue[]) {
  return cues
    .map((cue, index) => `${index + 1}\n${toSrtTimestamp(cue.start)} --> ${toSrtTimestamp(cue.end)}\n${cue.text.replace(/\r/g, "").trim()}\n`)
    .join("\n");
}

// Helper to wrap text into multiple lines for FFmpeg drawtext
function wrapText(text: string, maxCharsPerLine: number): string {
  if (!text) return "";
  const words = text.split(" ");
  let currentLine = "";
  const lines: string[] = [];

  for (const word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines.join("\n");
}

function subtitleFilterPath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function escapeDrawText(input: string) {
  // Inside a single-quoted string in an FFmpeg filter, we only need to escape 
  // single quotes and backslashes. 
  // BUT: expansion=none must be set for the drawtext filter to avoid % issues.
  return input
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/'/g, "\\'");   // Escape single quotes
}

function hexToFfmpegColor(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return "white";
  }
  return `0x${normalized}`;
}

function timestampToSeconds(ts: string) {
  const parts = ts.split(":");
  const hh = parseFloat(parts[0] || "0");
  const mm = parseFloat(parts[1] || "0");
  const ss = parseFloat(parts[2] || "0");
  return hh * 3600 + mm * 60 + ss;
}

// ── Entry point ──────────────────────────────────────────────────────

export async function renderShortDraftById(
  shortId: string,
  onProgress?: (message: string, percent: number) => void,
  signal?: AbortSignal
) {
  const short = await getShortDraftById(shortId);
  if (!short) {
    throw new Error("Short draft not found.");
  }

  const { settings } = await listProjectState();
  return renderShortDraft(short, settings, onProgress, signal);
}

// ── Step 1: Normalize a single segment ──────────────────────────────

interface SegmentInput {
  sourceAbsolutePath: string;
  startSeconds: number;
  durationSeconds: number;
  purpose: string;
}

const FADE_DURATION = 0.15; // seconds for fade in/out between clips

async function normalizeSegment(
  input: SegmentInput,
  index: number,
  totalSegments: number,
  outputPath: string,
  signal?: AbortSignal
): Promise<void> {
  // Build video filter: scale → pad → pixel format → fade
  const filters: string[] = [
    "scale=720:1280:force_original_aspect_ratio=decrease",
    "pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black",
    "setsar=1",
    "fps=30",
    "format=yuv420p",
  ];

  // Speed ramp for setup/lesson segments
  if (input.purpose === "setup" || input.purpose === "lesson") {
    filters.push("setpts=0.85*PTS");
  }

  // Calculate effective duration for fade placement
  const effectiveDuration =
    input.purpose === "setup" || input.purpose === "lesson"
      ? input.durationSeconds * 0.85
      : input.durationSeconds;

  // Fade in on all segments except the first; fade out on all except the last
  if (index > 0) {
    filters.push(`fade=t=in:st=0:d=${FADE_DURATION}`);
  }
  if (index < totalSegments - 1) {
    const fadeOutStart = Math.max(0, effectiveDuration - FADE_DURATION);
    filters.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${FADE_DURATION}`);
  }

  const videoFilter = filters.join(",");

  // Build audio filter
  const audioFilters: string[] = ["aresample=44100"];
  if (input.purpose === "setup" || input.purpose === "lesson") {
    audioFilters.push("atempo=1.18");
  }
  // Audio fade to match video
  if (index > 0) {
    audioFilters.push(`afade=t=in:st=0:d=${FADE_DURATION}`);
  }
  if (index < totalSegments - 1) {
    const fadeOutStart = Math.max(0, effectiveDuration - FADE_DURATION);
    audioFilters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${FADE_DURATION}`);
  }
  const audioFilter = audioFilters.join(",");

  console.log(`[RENDERER] Normalizing segment ${index}: purpose=${input.purpose}, duration=${input.durationSeconds}s, effective=${effectiveDuration.toFixed(2)}s`);

  await runFfmpeg([
    "-y",
    "-ss", String(input.startSeconds),
    "-t", String(input.durationSeconds),
    "-i", input.sourceAbsolutePath,
    "-vf", videoFilter,
    "-af", audioFilter,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-ar", "44100",
    "-ac", "2",
    "-threads", "0",
    "-movflags", "+faststart",
    outputPath,
  ], undefined, signal);
}

// ── Step 2: Concat normalized segments ──────────────────────────────

async function concatSegments(
  segmentPaths: string[],
  concatListPath: string,
  outputPath: string,
  signal?: AbortSignal
): Promise<void> {
  // Write the concat list file
  const concatContent = segmentPaths
    .map((p) => {
      // On Windows, FFmpeg concat demuxer treats '\' as an escape character. 
      // Using forward slashes is standard and avoids this issue.
      const normalizedPath = p.replace(/\\/g, "/");
      return `file '${normalizedPath.replace(/'/g, "'\\''")}'`;
    })
    .join("\n");
  await writeFile(concatListPath, concatContent, "utf8");

  console.log(`[RENDERER] Concatenating ${segmentPaths.length} segments via concat demuxer`);

  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatListPath,
    "-c", "copy",
    "-movflags", "+faststart",
    outputPath,
  ], undefined, signal);
}

// ── Main render function ────────────────────────────────────────────

export async function renderShortDraft(
  short: EditedShort,
  settings: BrandStyleSettings,
  onProgress?: (message: string, percent: number) => void,
  signal?: AbortSignal
) {
  if (!short.shortPlanSegments?.length) {
    throw new Error("This short draft does not have any stitched segments to render.");
  }

  onProgress?.("Initializing render...", 5);

  const exportsDir = getRenderedExportsDir();
  await mkdir(exportsDir, { recursive: true });

  // ── Gather source inputs ──
  const sourceInputs: SegmentInput[] = [];
  for (const segment of short.shortPlanSegments) {
    const upload = await getLocalUploadByVideoId(segment.sourceVideoId);
    if (!upload?.mediaAsset?.storagePath) {
      throw new Error("Only local uploaded source videos can be rendered in the MVP.");
    }

    const purpose = segment.purpose ?? "montage";

    // Trim dead air from boundaries on clips longer than 4s
    let startSeconds = segment.startSeconds;
    let durationSeconds = Math.max(1, segment.endSeconds - segment.startSeconds);
    if (durationSeconds > 4) {
      startSeconds += 0.2;
      durationSeconds -= 0.4;
      durationSeconds = Math.max(1, durationSeconds);
    }

    sourceInputs.push({
      sourceAbsolutePath: path.join(process.cwd(), "public", upload.mediaAsset.storagePath.replace(/^\//, "")),
      startSeconds,
      durationSeconds,
      purpose,
    });
  }

  const baseName = `${sanitize(short.title)}-${short.id}`;
  const stitchedFile = path.join(exportsDir, `${baseName}-stitched.mp4`);
  const outputFile = path.join(exportsDir, `${baseName}.mp4`);
  const subtitleFile = path.join(exportsDir, `${baseName}.srt`);
  const captionFile = path.join(exportsDir, `${baseName}-caption.txt`);
  const hookFile = path.join(exportsDir, `${baseName}-hook.txt`);
  const briefFile = path.join(exportsDir, `${baseName}-capcut-brief.json`);
  const thumbnailFile = path.join(exportsDir, `${baseName}-thumbnail.jpg`);
  const concatListFile = path.join(exportsDir, `${baseName}-concat.txt`);
  const filterScriptFile = path.join(exportsDir, `${baseName}-filter.txt`);

  // ── Write metadata files ──
  const subtitles = short.subtitleCues ?? [];
  const subtitleContent = buildSrt(subtitles);
  const capcutPackage: CapCutHandoffPackage =
    short.capcutPackage ?? {
      format: "9:16",
      clipTitle: short.title,
      sourceVideoId: short.sourceVideoId,
      start: subtitles[0]?.start ?? "00:00",
      end: subtitles[subtitles.length - 1]?.end ?? "00:15",
      subtitles,
      overlayText: short.overlayText,
      introHook: short.hook,
      caption: short.caption,
      cta: short.cta,
      musicVibe: short.musicVibe,
      editingNotes: [short.notes],
    };

  await writeFile(subtitleFile, subtitleContent, "utf8");
  await writeFile(captionFile, `${wrapText(short.caption, 40)}\n\n${short.hashtags.join(" ")}\n`, "utf8");
  await writeFile(hookFile, wrapText(short.hook, 25), "utf8");
  await writeFile(briefFile, JSON.stringify(capcutPackage, null, 2), "utf8");

  // ── STEP 1: Normalize each segment individually ──
  const segmentTempFiles: string[] = [];

  for (let i = 0; i < sourceInputs.length; i++) {
    const segmentPath = path.join(exportsDir, `${baseName}-seg${i}.mp4`);
    segmentTempFiles.push(segmentPath);

    const pct = 10 + Math.round((i / sourceInputs.length) * 45);
    onProgress?.(`Normalizing segment ${i + 1} of ${sourceInputs.length}...`, pct);

    await normalizeSegment(sourceInputs[i], i, sourceInputs.length, segmentPath, signal);
  }

  // ── STEP 2: Concat all normalized segments ──
  onProgress?.("Joining segments...", 58);
  await concatSegments(segmentTempFiles, concatListFile, stitchedFile, signal);

  // ── Calculate total duration for progress bar ──
  const totalDuration = sourceInputs.reduce((sum, input) => {
    const eff = (input.purpose === "setup" || input.purpose === "lesson")
      ? input.durationSeconds * 0.85
      : input.durationSeconds;
    return sum + eff;
  }, 0);

  // ── STEP 3: Apply overlays and subtitles ──
  const fontPath = "C\\:/Windows/Fonts/arial.ttf";
  const hookPath = subtitleFilterPath(hookFile);
  const subtitlePath = subtitleFilterPath(subtitleFile);
  const brandColor = hexToFfmpegColor(settings.overlayCaptionColor);

  const overlayFilters =
    short.overlayCaptions?.map((caption, captionIndex) => {
      // Wrap overlay captions to 40 characters for safety
      const wrappedText = wrapText(caption.text, 40);
      const text = escapeDrawText(wrappedText);
      const yPos = captionIndex % 2 === 0 ? 200 : 240;
      // Use 'fix_bounds=1' to clamp text within video dimensions
      return `drawtext=fontfile='${fontPath}':text='${text}':expansion=none:fontcolor='${brandColor}':fontsize=34:box=1:boxcolor='black@0.6':boxborderw=18:x=(w-text_w)/2:y=${yPos}:fix_bounds=1:enable=between(t\\,${caption.startSeconds}\\,${caption.endSeconds})`;
    }) ?? [];

  const filter = [
    // Hook filter - specifically escaping the commas in the 'between' function.
    // Increased y spacing slightly to accommodate potential multi-line wrappings.
    `drawtext=fontfile='${fontPath}':textfile='${hookPath}':expansion=none:fontcolor='white':fontsize=56:box=1:boxcolor='black@0.7':boxborderw=22:x=(w-text_w)/2:y=120:fix_bounds=1:enable=between(t\\,0\\,2.2)`,
    ...overlayFilters,
    `subtitles=filename='${subtitlePath}'`,
  ].join(",");


  try {
    onProgress?.("Applying effects and subtitles...", 62);
    // Write the complex filter string to a script file to avoid shell-stripping of quotes on Windows
    await writeFile(filterScriptFile, filter, "utf8");

    await runFfmpeg([
      "-y",
      "-i", stitchedFile,
      "-filter_script:v", filterScriptFile,
      "-pix_fmt", "yuv420p",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-c:a", "aac",
      "-threads", "0",
      "-movflags", "+faststart",
      outputFile,
    ], (time) => {
      const seconds = timestampToSeconds(time);
      const passPercent = Math.min(100, Math.round((seconds / totalDuration) * 100));
      const globalPercent = 62 + (passPercent * 0.33);
      onProgress?.(`Applying effects (${passPercent}%)...`, Math.round(globalPercent));
    }, signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render short draft.";
    const savedFailure = {
      renderStatus: "failed" as const,
      exportStatus: "not_ready" as const,
      previewUrl: undefined,
      renderedFilePath: undefined,
      subtitleFilePath: undefined,
      captionFilePath: undefined,
      briefFilePath: undefined,
      thumbnailUrl: undefined,
      renderError: message,
    };
    await upsertRenderedDraft({ id: short.id, ...savedFailure });
    await updateShortDraft(short.id, savedFailure);
    throw new Error(message);
  }

  // ── STEP 4: Thumbnail ──
  try {
    const rawTitle = short.clickbaitTitle || short.title || "Watch This!";
    const words = rawTitle.split(" ");
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(" ");
    const line2 = words.slice(half).join(" ");
    const titleText = words.length > 4 ? `${line1}\n${line2}` : rawTitle;

    onProgress?.("Generating thumbnail...", 96);
    await runFfmpeg([
      "-y",
      "-ss", "0.5",
      "-i", stitchedFile,
      "-vframes", "1",
      "-vf", `drawtext=fontfile='${fontPath}':text='${escapeDrawText(titleText)}':expansion=none:fontcolor='white':fontsize=80:box=1:boxcolor='black@0.8':boxborderw=32:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-q:v", "2",
      thumbnailFile,
    ], undefined, signal);
    onProgress?.("Finalizing...", 99);
  } catch (error) {
    console.warn("Failed to generate thumbnail, proceeding without it", error);
  }

  // ── Cleanup temp segment files ──
  for (const tempFile of segmentTempFiles) {
    try { await unlink(tempFile); } catch { /* ignore */ }
  }
  try { await unlink(concatListFile); } catch { /* ignore */ }
  try { await unlink(filterScriptFile); } catch { /* ignore */ }

  // ── Save results ──
  const outputUrl = `/api/renders/assets/${path.basename(outputFile)}`;
  const subtitleUrl = `/api/renders/assets/${path.basename(subtitleFile)}`;
  const captionUrl = `/api/renders/assets/${path.basename(captionFile)}`;
  const briefUrl = `/api/renders/assets/${path.basename(briefFile)}`;
  const thumbnailUrl = `/api/renders/assets/${path.basename(thumbnailFile)}`;

  const saved = {
    id: short.id,
    renderStatus: "ready" as const,
    exportStatus: "download_ready" as const,
    previewUrl: outputUrl,
    renderedFilePath: outputUrl,
    subtitleFilePath: subtitleUrl,
    captionFilePath: captionUrl,
    briefFilePath: briefUrl,
    thumbnailUrl,
    renderError: undefined,
  };

  await upsertRenderedDraft(saved);
  await updateShortDraft(short.id, saved);
  return saved;
}
