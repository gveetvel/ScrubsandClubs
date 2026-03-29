import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { BrandStyleSettings, CapCutHandoffPackage, EditedShort, SubtitleCue } from "@/lib/types";
import { getLocalUploadByVideoId } from "@/lib/server/local-upload-repository";
import { getRenderedExportsDir, upsertRenderedDraft } from "@/lib/server/rendered-short-repository";
import { getShortDraftById, listProjectState, updateShortDraft } from "@/lib/server/project-repository";
import { runFfmpeg } from "@/lib/server/ffmpeg";

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

function sanitize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function subtitleFilterPath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function escapeDrawText(input: string) {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function hexToFfmpegColor(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return "white";
  }
  return `0x${normalized}`;
}

export async function renderShortDraftById(shortId: string) {
  const short = await getShortDraftById(shortId);
  if (!short) {
    throw new Error("Short draft not found.");
  }

  const { settings } = await listProjectState();
  return renderShortDraft(short, settings);
}

export async function renderShortDraft(short: EditedShort, settings: BrandStyleSettings) {
  if (!short.shortPlanSegments?.length) {
    throw new Error("This short draft does not have any stitched segments to render.");
  }

  const exportsDir = getRenderedExportsDir();
  await mkdir(exportsDir, { recursive: true });

  const sourceInputs = [];
  for (const segment of short.shortPlanSegments) {
    const upload = await getLocalUploadByVideoId(segment.sourceVideoId);
    if (!upload?.mediaAsset?.storagePath) {
      throw new Error("Only local uploaded source videos can be rendered in the MVP.");
    }

    sourceInputs.push({
      sourceVideoId: segment.sourceVideoId,
      sourceAbsolutePath: path.join(process.cwd(), "public", upload.mediaAsset.storagePath.replace(/^\//, "")),
      startSeconds: segment.startSeconds,
      durationSeconds: Math.max(1, segment.endSeconds - segment.startSeconds)
    });
  }

  const baseName = `${sanitize(short.title)}-${short.id}`;
  const stitchedFile = path.join(exportsDir, `${baseName}-stitched.mp4`);
  const outputFile = path.join(exportsDir, `${baseName}.mp4`);
  const subtitleFile = path.join(exportsDir, `${baseName}.srt`);
  const captionFile = path.join(exportsDir, `${baseName}-caption.txt`);
  const hookFile = path.join(exportsDir, `${baseName}-hook.txt`);
  const briefFile = path.join(exportsDir, `${baseName}-capcut-brief.json`);

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
      editingNotes: [short.notes]
    };

  await writeFile(subtitleFile, subtitleContent, "utf8");
  await writeFile(captionFile, `${short.caption}\n\n${short.hashtags.join(" ")}\n`, "utf8");
  await writeFile(hookFile, short.hook, "utf8");
  await writeFile(briefFile, JSON.stringify(capcutPackage, null, 2), "utf8");

  const inputArgs = sourceInputs.flatMap((input) => [
    "-ss",
    String(input.startSeconds),
    "-t",
    String(input.durationSeconds),
    "-i",
    input.sourceAbsolutePath
  ]);

  const concatFilter = sourceInputs
    .map((_, index) => {
      return [
        `[${index}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v${index}]`,
        `[${index}:a]aresample=44100[a${index}]`
      ].join(";");
    })
    .concat(`${sourceInputs.map((_, index) => `[v${index}][a${index}]`).join("")}concat=n=${sourceInputs.length}:v=1:a=1[v][a]`)
    .join(";");

  await runFfmpeg([
    "-y",
    ...inputArgs,
    "-filter_complex",
    concatFilter,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    stitchedFile
  ]);

  const fontPath = "C\\:/Windows/Fonts/arial.ttf";
  const hookPath = subtitleFilterPath(hookFile);
  const subtitlePath = subtitleFilterPath(subtitleFile);
  const brandColor = hexToFfmpegColor(settings.overlayCaptionColor);

  const overlayFilters =
    short.overlayCaptions?.map((caption) => {
      const text = escapeDrawText(caption.text);
      return `drawtext=fontfile='${fontPath}':text='${text}':fontcolor=${brandColor}:fontsize=30:box=1:boxcolor=black@0.55:boxborderw=16:x=(w-text_w)/2:y=210:enable='between(t,${caption.startSeconds},${caption.endSeconds})'`;
    }) ?? [];

  const filter = [
    `drawtext=fontfile='${fontPath}':textfile='${hookPath}':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.65:boxborderw=20:x=(w-text_w)/2:y=90:enable='between(t,0,2.8)'`,
    ...overlayFilters,
    `subtitles='${subtitlePath}':force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=110'`
  ].join(",");

  try {
    await runFfmpeg([
      "-y",
      "-i",
      stitchedFile,
      "-vf",
      filter,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputFile
    ]);
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
      renderError: message
    };
    await upsertRenderedDraft({ id: short.id, ...savedFailure });
    await updateShortDraft(short.id, savedFailure);
    throw new Error(message);
  }

  const outputUrl = `/api/renders/assets/${path.basename(outputFile)}`;
  const subtitleUrl = `/api/renders/assets/${path.basename(subtitleFile)}`;
  const captionUrl = `/api/renders/assets/${path.basename(captionFile)}`;
  const briefUrl = `/api/renders/assets/${path.basename(briefFile)}`;

  const saved = {
    id: short.id,
    renderStatus: "ready" as const,
    exportStatus: "download_ready" as const,
    previewUrl: outputUrl,
    renderedFilePath: outputUrl,
    subtitleFilePath: subtitleUrl,
    captionFilePath: captionUrl,
    briefFilePath: briefUrl,
    renderError: undefined
  };

  await upsertRenderedDraft(saved);
  await updateShortDraft(short.id, saved);
  return saved;
}
