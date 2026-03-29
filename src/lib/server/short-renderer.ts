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
  const thumbnailFile = path.join(exportsDir, `${baseName}-thumbnail.jpg`);

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

  // --- Dead-air trimming: shave silence off clip boundaries ---
  const trimmedInputs = sourceInputs.map((input) => {
    const purpose = short.shortPlanSegments?.find(
      (s) => s.sourceVideoId === input.sourceVideoId && s.startSeconds === input.startSeconds
    )?.purpose ?? "montage";

    // Trim 0.2s from boundaries on clips longer than 4s
    let trimmedStart = input.startSeconds;
    let trimmedDuration = input.durationSeconds;
    if (input.durationSeconds > 4) {
      trimmedStart += 0.2;
      trimmedDuration -= 0.4;
    }

    return {
      ...input,
      startSeconds: trimmedStart,
      durationSeconds: Math.max(1, trimmedDuration),
      purpose
    };
  });

  const inputArgs = trimmedInputs.flatMap((input) => [
    "-ss",
    String(input.startSeconds),
    "-t",
    String(input.durationSeconds),
    "-i",
    input.sourceAbsolutePath
  ]);

  // --- Build per-segment video filters with effects ---
  const TRANSITION_DURATION = 0.15;
  const segmentFilters: string[] = [];
  const segmentAudioFilters: string[] = [];

  trimmedInputs.forEach((input, index) => {
    const baseScale = `scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

    if (input.purpose === "hook" || input.purpose === "reaction") {
      // Zoom punch-in: subtle 1.08x zoom, centered
      segmentFilters.push(
        `[${index}:v]${baseScale},zoompan=z='min(zoom+0.001\\,1.08)':d=1:s=720x1280:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30[v${index}]`
      );
    } else if (input.purpose === "setup" || input.purpose === "lesson") {
      // Speed ramp: 1.18x faster to keep pacing tight
      segmentFilters.push(
        `[${index}:v]${baseScale},setpts=0.85*PTS[v${index}]`
      );
      segmentAudioFilters.push(
        `[${index}:a]aresample=44100,atempo=1.18[a${index}]`
      );
    } else {
      segmentFilters.push(
        `[${index}:v]${baseScale}[v${index}]`
      );
    }

    // Default audio filter if not already set by speed ramp
    if (!segmentAudioFilters.some((f) => f.startsWith(`[${index}:a]`))) {
      segmentAudioFilters.push(
        `[${index}:a]aresample=44100[a${index}]`
      );
    }
  });

  // --- Build xfade transition chain ---
  let videoChain = "";
  let audioChain = "";

  if (trimmedInputs.length === 1) {
    // Single segment: no transitions needed
    videoChain = segmentFilters.join(";");
    audioChain = segmentAudioFilters.join(";");
    videoChain += `;[v0]null[v]`;
    audioChain += `;[a0]anull[a]`;
  } else {
    // Multiple segments: chain xfade transitions
    const allFilters = [...segmentFilters, ...segmentAudioFilters];

    // Video xfade chain
    let cumulativeDuration = trimmedInputs[0].durationSeconds;
    let prevVideoLabel = "v0";

    for (let i = 1; i < trimmedInputs.length; i++) {
      const offset = Math.max(0, cumulativeDuration - TRANSITION_DURATION);
      const outLabel = i === trimmedInputs.length - 1 ? "v" : `vt${i}`;
      // Use fadewhite for hook transition, fadeblack for others
      const transition = i === 1 ? "fadewhite" : "fadewhite";
      allFilters.push(
        `[${prevVideoLabel}][v${i}]xfade=transition=${transition}:duration=${TRANSITION_DURATION}:offset=${offset.toFixed(3)}[${outLabel}]`
      );
      cumulativeDuration += trimmedInputs[i].durationSeconds - TRANSITION_DURATION;
      prevVideoLabel = outLabel;
    }

    // Audio crossfade chain
    let prevAudioLabel = "a0";
    let audioCumulativeDuration = trimmedInputs[0].durationSeconds;

    for (let i = 1; i < trimmedInputs.length; i++) {
      const outLabel = i === trimmedInputs.length - 1 ? "a" : `at${i}`;
      allFilters.push(
        `[${prevAudioLabel}][a${i}]acrossfade=d=${TRANSITION_DURATION}:c1=tri:c2=tri[${outLabel}]`
      );
      audioCumulativeDuration += trimmedInputs[i].durationSeconds - TRANSITION_DURATION;
      prevAudioLabel = outLabel;
    }

    videoChain = allFilters.join(";");
    audioChain = "";
  }

  const fullFilterComplex = audioChain ? `${videoChain};${audioChain}` : videoChain;

  await runFfmpeg([
    "-y",
    ...inputArgs,
    "-filter_complex",
    fullFilterComplex,
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
    short.overlayCaptions?.map((caption, captionIndex) => {
      const text = escapeDrawText(caption.text);
      const yPos = captionIndex % 2 === 0 ? 200 : 240;
      return `drawtext=fontfile='${fontPath}':text='${text}':fontcolor=${brandColor}:fontsize=34:box=1:boxcolor=black@0.6:boxborderw=18:x=(w-text_w)/2:y=${yPos}:enable='between(t,${caption.startSeconds},${caption.endSeconds})'`;
    }) ?? [];

  const filter = [
    `drawtext=fontfile='${fontPath}':textfile='${hookPath}':fontcolor=white:fontsize=56:box=1:boxcolor=black@0.7:boxborderw=22:x=(w-text_w)/2:y=80:enable='between(t,0,2.2)'`,
    ...overlayFilters,
    `subtitles='${subtitlePath}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=100'`
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
      thumbnailUrl: undefined,
      renderError: message
    };
    await upsertRenderedDraft({ id: short.id, ...savedFailure });
    await updateShortDraft(short.id, savedFailure);
    throw new Error(message);
  }

  // --- Thumbnail Generation ---
  try {
    const rawTitle = short.clickbaitTitle || short.title || "Watch This!";
    // Split long titles into two lines for better thumbnail fit
    const words = rawTitle.split(" ");
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(" ");
    const line2 = words.slice(half).join(" ");
    const titleText = words.length > 4 ? `${line1}\n${line2}` : rawTitle;

    await runFfmpeg([
      "-y",
      "-ss", "0.5", // grab frame 0.5s into the hook
      "-i", stitchedFile,
      "-vframes", "1",
      "-vf", `drawtext=fontfile='${fontPath}':text='${escapeDrawText(titleText)}':fontcolor=white:fontsize=80:box=1:boxcolor=${brandColor}@0.9:boxborderw=32:x=(w-text_w)/2:y=(h-text_h)/2:align=center`,
      "-q:v", "2", // high quality jpeg
      thumbnailFile
    ]);
  } catch (error) {
    console.warn("Failed to generate thumbnail, proceeding without it", error);
  }

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
    renderError: undefined
  };

  await upsertRenderedDraft(saved);
  await updateShortDraft(short.id, saved);
  return saved;
}
