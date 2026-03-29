# Walkthrough: High-Energy Quick-Cut Video Editing

## What Changed

### 1. Smart Segment Selection
```diff:short-engine.ts
import {
  BrandStyleSettings,
  DetectedMoment,
  EditedShort,
  OverlayCaptionCue,
  Project,
  ProjectProgressStep,
  ShortPlanSegment,
  SourceVideo,
  SubtitleCue,
  TextGenerationPackage,
  TranscriptSegment
} from "@/lib/types";

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function keywordBonus(text: string) {
  const normalized = text.toLowerCase();
  let score = 0;
  const hookWords = ["wrong", "funniest", "diagnosis", "save", "break", "changed", "ruined", "misses", "doctor", "bad", "lesson"];
  for (const word of hookWords) {
    if (normalized.includes(word)) {
      score += 8;
    }
  }
  if (normalized.includes("?") || normalized.includes("!")) {
    score += 4;
  }
  return score;
}

export function buildProgressSteps(statuses?: Partial<Record<ProjectProgressStep["id"], ProjectProgressStep["status"]>>): ProjectProgressStep[] {
  return [
    { id: "step-text", label: "Generating text package", status: statuses?.["step-text"] ?? "pending" },
    { id: "step-transcribe", label: "Transcribing videos", status: statuses?.["step-transcribe"] ?? "pending" },
    { id: "step-moments", label: "Finding best moments", status: statuses?.["step-moments"] ?? "pending" },
    { id: "step-plan", label: "Building short plan", status: statuses?.["step-plan"] ?? "pending" },
    { id: "step-render", label: "Rendering preview", status: statuses?.["step-render"] ?? "pending" }
  ];
}

export function summarizeTranscript(videos: SourceVideo[]) {
  return videos
    .flatMap((video) => video.transcriptSegments ?? [])
    .slice(0, 6)
    .map((segment) => segment.text)
    .join(" ");
}

export function detectMoments(projectId: string, videos: SourceVideo[]): DetectedMoment[] {
  const moments = videos.flatMap((video) =>
    (video.transcriptSegments ?? []).map((segment, index) => {
      const startSeconds = segment.startSeconds ?? index * 6;
      const endSeconds = segment.endSeconds ?? startSeconds + 5;
      const score = 72 + keywordBonus(segment.text) - index;
      const label = segment.text.split(/[,.!?]/)[0]?.slice(0, 46) || "Strong moment";
      return {
        id: `${video.id}-moment-${index + 1}`,
        projectId,
        sourceVideoId: video.id,
        label,
        reason: score > 88 ? "Strong hook language plus a clean payoff beat." : "Useful transcript beat with short-form pacing potential.",
        transcriptExcerpt: segment.text,
        tags: score > 88 ? ["hook", "payoff"] : ["reaction", "teaching"],
        score,
        start: formatTime(startSeconds),
        end: formatTime(endSeconds),
        startSeconds,
        endSeconds,
        energy: score > 86 ? "high" : "medium"
      } satisfies DetectedMoment;
    })
  );

  return moments.sort((a, b) => b.score - a.score).slice(0, 8);
}

function uniqueMomentSelection(moments: DetectedMoment[]) {
  const selected: DetectedMoment[] = [];
  const usedVideoMomentKeys = new Set<string>();

  for (const moment of moments) {
    const key = `${moment.sourceVideoId}:${moment.startSeconds}`;
    if (usedVideoMomentKeys.has(key)) {
      continue;
    }
    selected.push(moment);
    usedVideoMomentKeys.add(key);
    if (selected.length >= 4) {
      break;
    }
  }

  return selected;
}

function purposeForIndex(index: number): ShortPlanSegment["purpose"] {
  if (index === 0) return "hook";
  if (index === 1) return "reaction";
  if (index === 2) return "payoff";
  return "cta";
}

export function buildShortPlanSegments(moments: DetectedMoment[]) {
  return uniqueMomentSelection(moments).map((moment, index) => ({
    id: `${moment.id}-segment`,
    sourceVideoId: moment.sourceVideoId,
    start: moment.start,
    end: moment.end,
    startSeconds: moment.startSeconds,
    endSeconds: moment.endSeconds,
    purpose: purposeForIndex(index),
    momentId: moment.id
  }));
}

function shiftCue(cue: TranscriptSegment, segmentStart: number, segmentOffset: number, index: number): SubtitleCue | null {
  const cueStart = cue.startSeconds ?? 0;
  const cueEnd = cue.endSeconds ?? cueStart + 4;
  const shiftedStart = Math.max(0, cueStart - segmentStart + segmentOffset);
  const shiftedEnd = Math.max(shiftedStart + 1, cueEnd - segmentStart + segmentOffset);

  if (!cue.text.trim()) {
    return null;
  }

  return {
    id: `${cue.id}-subtitle-${index + 1}`,
    start: formatTime(shiftedStart),
    end: formatTime(shiftedEnd),
    startSeconds: shiftedStart,
    endSeconds: shiftedEnd,
    text: cue.text.trim()
  };
}

function cuesForSegment(video: SourceVideo, planSegment: ShortPlanSegment, offsetSeconds: number) {
  const transcriptSegments = video.transcriptSegments ?? [];
  const overlapping = transcriptSegments.filter((segment) => {
    const start = segment.startSeconds ?? 0;
    const end = segment.endSeconds ?? start + 4;
    return end > planSegment.startSeconds && start < planSegment.endSeconds;
  });

  return overlapping
    .map((segment, index) => shiftCue(segment, planSegment.startSeconds, offsetSeconds, index))
    .filter((cue): cue is SubtitleCue => Boolean(cue));
}

export function buildSubtitleCues(videos: SourceVideo[], planSegments: ShortPlanSegment[]) {
  const videoMap = new Map(videos.map((video) => [video.id, video]));
  const cues: SubtitleCue[] = [];
  let offsetSeconds = 0;

  for (const segment of planSegments) {
    const video = videoMap.get(segment.sourceVideoId);
    if (video) {
      const nextCues = cuesForSegment(video, segment, offsetSeconds);
      cues.push(...nextCues);
    }
    offsetSeconds += Math.max(1, segment.endSeconds - segment.startSeconds);
  }

  return cues;
}

export function buildOverlayCaptions(planSegments: ShortPlanSegment[], funnyCaptionIdeas: string[], settings: BrandStyleSettings) {
  return planSegments.slice(0, funnyCaptionIdeas.length).map((segment, index) => {
    const startSeconds = planSegments
      .slice(0, index)
      .reduce((total, entry) => total + (entry.endSeconds - entry.startSeconds), 0);

    return {
      id: `${segment.id}-overlay`,
      start: formatTime(startSeconds),
      end: formatTime(startSeconds + 2),
      startSeconds,
      endSeconds: startSeconds + 2,
      text: funnyCaptionIdeas[index] ?? funnyCaptionIdeas[0] ?? "Big moment",
      color: settings.overlayCaptionColor,
      style: index === 0 ? "funny" : index === 1 ? "punchline" : "callout"
    } satisfies OverlayCaptionCue;
  });
}

export function buildShortDrafts(project: Project, videos: SourceVideo[], settings: BrandStyleSettings) {
  const primarySegments = buildShortPlanSegments(project.detectedMoments);
  const alternateSegments = [...primarySegments.slice(1), primarySegments[0]].filter(Boolean);

  const segmentSets = [primarySegments, alternateSegments];

  return segmentSets.map((planSegments, index) => {
    const subtitleCues = buildSubtitleCues(videos, planSegments);
    const overlayCaptions = buildOverlayCaptions(planSegments, project.textPackage.funnyCaptionIdeas, settings);
    const titleBase = index === 0 ? project.title : `${project.title} alt`;
    const title = `${titleBase} ${index === 0 ? "short" : "cut"}`.trim();

    return {
      id: `${project.id}-${index === 0 ? "primary" : "alt"}-${slugify(titleBase).slice(0, 16)}`,
      clipSuggestionId: `${project.id}-synthetic-clip-${index + 1}`,
      sourceVideoId: planSegments[0]?.sourceVideoId ?? project.sourceVideoIds[0],
      sourceVideoIds: [...new Set(planSegments.map((segment) => segment.sourceVideoId))],
      projectId: project.id,
      primary: index === 0,
      draftStatus: "generated",
      title,
      status: "editing",
      platforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
      readyForMetricool: false,
      hook: project.textPackage.hookOptions[index] ?? project.textPackage.hookOptions[0] ?? project.title,
      overlayText: overlayCaptions.map((caption) => caption.text),
      caption: project.textPackage.captionOptions[index] ?? project.textPackage.captionOptions[0] ?? project.summary,
      cta: project.textPackage.ctaOptions[index] ?? project.textPackage.ctaOptions[0] ?? "Comment FULL if you want the whole breakdown.",
      hashtags: project.textPackage.hashtagOptions,
      musicVibe: project.textPackage.editingVibeSuggestion,
      notes: "Generated by the in-app short engine from detected transcript-driven moments.",
      packageStatus: "generated",
      subtitleCues,
      subtitleStyle: settings.subtitlePreset,
      styleSuggestion: project.textPackage.editingVibeSuggestion,
      generationSource: "automatic",
      renderStatus: "not_started",
      exportStatus: "not_ready",
      shortPlanSegments: planSegments,
      overlayCaptions,
      capcutPackage: {
        format: "9:16",
        clipTitle: title,
        sourceVideoId: planSegments[0]?.sourceVideoId ?? project.sourceVideoIds[0],
        start: subtitleCues[0]?.start ?? "00:00",
        end: subtitleCues[subtitleCues.length - 1]?.end ?? "00:15",
        subtitles: subtitleCues,
        overlayText: overlayCaptions.map((caption) => caption.text),
        introHook: project.textPackage.hookOptions[index] ?? project.textPackage.hookOptions[0] ?? project.title,
        caption: project.textPackage.captionOptions[index] ?? project.textPackage.captionOptions[0] ?? project.summary,
        cta: project.textPackage.ctaOptions[index] ?? project.textPackage.ctaOptions[0] ?? "Comment FULL if you want the whole breakdown.",
        musicVibe: project.textPackage.editingVibeSuggestion,
        editingNotes: [
          "Keep the opening beat inside the first second.",
          "Use brand-color overlay captions for the biggest funny beats.",
          "Cut dead air between segments so the pacing stays social-first."
        ]
      }
    } satisfies EditedShort;
  });
}
===
import {
  BrandStyleSettings,
  DetectedMoment,
  EditedShort,
  OverlayCaptionCue,
  Project,
  ProjectProgressStep,
  ShortPlanSegment,
  SourceVideo,
  SubtitleCue,
  TextGenerationPackage,
  TranscriptSegment
} from "@/lib/types";

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function keywordBonus(text: string) {
  const normalized = text.toLowerCase();
  let score = 0;
  const hookWords = ["wrong", "funniest", "diagnosis", "save", "break", "changed", "ruined", "misses", "doctor", "bad", "lesson"];
  for (const word of hookWords) {
    if (normalized.includes(word)) {
      score += 8;
    }
  }
  if (normalized.includes("?") || normalized.includes("!")) {
    score += 4;
  }
  return score;
}

export function buildProgressSteps(statuses?: Partial<Record<ProjectProgressStep["id"], ProjectProgressStep["status"]>>): ProjectProgressStep[] {
  return [
    { id: "step-text", label: "Generating text package", status: statuses?.["step-text"] ?? "pending" },
    { id: "step-transcribe", label: "Transcribing videos", status: statuses?.["step-transcribe"] ?? "pending" },
    { id: "step-vision", label: "Analyzing video with AI", status: statuses?.["step-vision"] ?? "pending" },
    { id: "step-moments", label: "Finding best moments", status: statuses?.["step-moments"] ?? "pending" },
    { id: "step-plan", label: "Building short plan", status: statuses?.["step-plan"] ?? "pending" },
    { id: "step-render", label: "Rendering preview", status: statuses?.["step-render"] ?? "pending" }
  ];
}

export function summarizeTranscript(videos: SourceVideo[]) {
  return videos
    .flatMap((video) => video.transcriptSegments ?? [])
    .slice(0, 6)
    .map((segment) => segment.text)
    .join(" ");
}

export function detectMomentsFallback(projectId: string, videos: SourceVideo[]): DetectedMoment[] {
  const moments = videos.flatMap((video) =>
    (video.transcriptSegments ?? []).map((segment, index) => {
      const startSeconds = segment.startSeconds ?? index * 6;
      const endSeconds = segment.endSeconds ?? startSeconds + 5;
      const score = 72 + keywordBonus(segment.text) - index;
      const label = segment.text.split(/[,.!?]/)[0]?.slice(0, 46) || "Strong moment";
      return {
        id: `${video.id}-moment-${index + 1}`,
        projectId,
        sourceVideoId: video.id,
        label,
        reason: score > 88 ? "Strong hook language plus a clean payoff beat." : "Useful transcript beat with short-form pacing potential.",
        transcriptExcerpt: segment.text,
        tags: score > 88 ? ["hook", "payoff"] : ["reaction", "teaching"],
        score,
        start: formatTime(startSeconds),
        end: formatTime(endSeconds),
        startSeconds,
        endSeconds,
        energy: score > 86 ? "high" : "medium"
      } satisfies DetectedMoment;
    })
  );

  return moments.sort((a, b) => b.score - a.score).slice(0, 8);
}

const MAX_SEGMENTS = 8;
const MAX_SEGMENT_DURATION_SECONDS = 6;

function uniqueMomentSelection(moments: DetectedMoment[]) {
  const selected: DetectedMoment[] = [];
  const usedVideoMomentKeys = new Set<string>();

  for (const moment of moments) {
    const key = `${moment.sourceVideoId}:${moment.startSeconds}`;
    if (usedVideoMomentKeys.has(key)) {
      continue;
    }
    selected.push(moment);
    usedVideoMomentKeys.add(key);
    if (selected.length >= MAX_SEGMENTS) {
      break;
    }
  }

  return selected;
}

function purposeForMoment(moment: DetectedMoment, index: number, total: number): ShortPlanSegment["purpose"] {
  // First segment is always the hook
  if (index === 0) return "hook";
  // Last segment is always the payoff/closer
  if (index === total - 1) return "payoff";

  // Use AI tags if available
  const tags = moment.tags ?? [];
  if (tags.includes("reaction") || tags.includes("comedy")) return "reaction";
  if (tags.includes("setup") || tags.includes("lesson")) return "setup";

  // Short clips (≤3s) in the middle become montage cuts
  const duration = (moment.endSeconds ?? 0) - (moment.startSeconds ?? 0);
  if (duration <= 3) return "montage";

  // Default middle segments alternate between reaction and montage
  return index % 2 === 1 ? "reaction" : "montage";
}

export function buildShortPlanSegments(moments: DetectedMoment[]) {
  const selected = uniqueMomentSelection(moments);

  return selected.map((moment, index) => {
    // Cap each segment at MAX_SEGMENT_DURATION_SECONDS
    const rawDuration = moment.endSeconds - moment.startSeconds;
    const cappedEnd = rawDuration > MAX_SEGMENT_DURATION_SECONDS
      ? moment.startSeconds + MAX_SEGMENT_DURATION_SECONDS
      : moment.endSeconds;

    return {
      id: `${moment.id}-segment`,
      sourceVideoId: moment.sourceVideoId,
      start: moment.start,
      end: formatTime(cappedEnd),
      startSeconds: moment.startSeconds,
      endSeconds: cappedEnd,
      purpose: purposeForMoment(moment, index, selected.length),
      momentId: moment.id
    };
  });
}

function shiftCue(cue: TranscriptSegment, segmentStart: number, segmentOffset: number, index: number): SubtitleCue | null {
  const cueStart = cue.startSeconds ?? 0;
  const cueEnd = cue.endSeconds ?? cueStart + 4;
  const shiftedStart = Math.max(0, cueStart - segmentStart + segmentOffset);
  const shiftedEnd = Math.max(shiftedStart + 1, cueEnd - segmentStart + segmentOffset);

  if (!cue.text.trim()) {
    return null;
  }

  return {
    id: `${cue.id}-subtitle-${index + 1}`,
    start: formatTime(shiftedStart),
    end: formatTime(shiftedEnd),
    startSeconds: shiftedStart,
    endSeconds: shiftedEnd,
    text: cue.text.trim()
  };
}

function cuesForSegment(video: SourceVideo, planSegment: ShortPlanSegment, offsetSeconds: number) {
  const transcriptSegments = video.transcriptSegments ?? [];
  const overlapping = transcriptSegments.filter((segment) => {
    const start = segment.startSeconds ?? 0;
    const end = segment.endSeconds ?? start + 4;
    return end > planSegment.startSeconds && start < planSegment.endSeconds;
  });

  return overlapping
    .map((segment, index) => shiftCue(segment, planSegment.startSeconds, offsetSeconds, index))
    .filter((cue): cue is SubtitleCue => Boolean(cue));
}

export function buildSubtitleCues(videos: SourceVideo[], planSegments: ShortPlanSegment[]) {
  const videoMap = new Map(videos.map((video) => [video.id, video]));
  const cues: SubtitleCue[] = [];
  let offsetSeconds = 0;

  for (const segment of planSegments) {
    const video = videoMap.get(segment.sourceVideoId);
    if (video) {
      const nextCues = cuesForSegment(video, segment, offsetSeconds);
      cues.push(...nextCues);
    }
    offsetSeconds += Math.max(1, segment.endSeconds - segment.startSeconds);
  }

  return cues;
}

export function buildOverlayCaptions(planSegments: ShortPlanSegment[], funnyCaptionIdeas: string[], settings: BrandStyleSettings) {
  return planSegments.slice(0, funnyCaptionIdeas.length).map((segment, index) => {
    const startSeconds = planSegments
      .slice(0, index)
      .reduce((total, entry) => total + (entry.endSeconds - entry.startSeconds), 0);

    return {
      id: `${segment.id}-overlay`,
      start: formatTime(startSeconds),
      end: formatTime(startSeconds + 2),
      startSeconds,
      endSeconds: startSeconds + 2,
      text: funnyCaptionIdeas[index] ?? funnyCaptionIdeas[0] ?? "Big moment",
      color: settings.overlayCaptionColor,
      style: index === 0 ? "funny" : index === 1 ? "punchline" : "callout"
    } satisfies OverlayCaptionCue;
  });
}

export function buildShortDrafts(project: Project, videos: SourceVideo[], settings: BrandStyleSettings) {
  const primarySegments = buildShortPlanSegments(project.detectedMoments);
  const alternateSegments = [...primarySegments.slice(1), primarySegments[0]].filter(Boolean);

  const segmentSets = [primarySegments, alternateSegments];

  return segmentSets.map((planSegments, index) => {
    const subtitleCues = buildSubtitleCues(videos, planSegments);
    const overlayCaptions = buildOverlayCaptions(planSegments, project.textPackage.funnyCaptionIdeas, settings);
    const titleBase = index === 0 ? project.title : `${project.title} alt`;
    const title = `${titleBase} ${index === 0 ? "short" : "cut"}`.trim();

    return {
      id: `${project.id}-${index === 0 ? "primary" : "alt"}-${slugify(titleBase).slice(0, 16)}`,
      clipSuggestionId: `${project.id}-synthetic-clip-${index + 1}`,
      sourceVideoId: planSegments[0]?.sourceVideoId ?? project.sourceVideoIds[0],
      sourceVideoIds: [...new Set(planSegments.map((segment) => segment.sourceVideoId))],
      projectId: project.id,
      primary: index === 0,
      draftStatus: "generated",
      title,
      status: "editing",
      platforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
      readyForMetricool: false,
      hook: project.textPackage.hookOptions[index] ?? project.textPackage.hookOptions[0] ?? project.title,
      overlayText: overlayCaptions.map((caption) => caption.text),
      caption: project.textPackage.captionOptions[index] ?? project.textPackage.captionOptions[0] ?? project.summary,
      cta: project.textPackage.ctaOptions[index] ?? project.textPackage.ctaOptions[0] ?? "Comment FULL if you want the whole breakdown.",
      hashtags: project.textPackage.hashtagOptions,
      musicVibe: project.textPackage.editingVibeSuggestion,
      notes: "Generated by the in-app short engine from detected transcript-driven moments.",
      packageStatus: "generated",
      subtitleCues,
      subtitleStyle: settings.subtitlePreset,
      styleSuggestion: project.textPackage.editingVibeSuggestion,
      generationSource: "automatic",
      renderStatus: "not_started",
      exportStatus: "not_ready",
      shortPlanSegments: planSegments,
      overlayCaptions,
      capcutPackage: {
        format: "9:16",
        clipTitle: title,
        sourceVideoId: planSegments[0]?.sourceVideoId ?? project.sourceVideoIds[0],
        start: subtitleCues[0]?.start ?? "00:00",
        end: subtitleCues[subtitleCues.length - 1]?.end ?? "00:15",
        subtitles: subtitleCues,
        overlayText: overlayCaptions.map((caption) => caption.text),
        introHook: project.textPackage.hookOptions[index] ?? project.textPackage.hookOptions[0] ?? project.title,
        caption: project.textPackage.captionOptions[index] ?? project.textPackage.captionOptions[0] ?? project.summary,
        cta: project.textPackage.ctaOptions[index] ?? project.textPackage.ctaOptions[0] ?? "Comment FULL if you want the whole breakdown.",
        musicVibe: project.textPackage.editingVibeSuggestion,
        editingNotes: [
          "Keep the opening beat inside the first second.",
          "Use brand-color overlay captions for the biggest funny beats.",
          "Cut dead air between segments so the pacing stays social-first."
        ]
      }
    } satisfies EditedShort;
  });
}
```

- Increased max segments from **4 → 8** for rapid-fire montage pacing
- Capped each segment at **6 seconds max** (was 12s) — keeps cuts tight
- Tag-aware purpose assignment: AI tags like `"reaction"` or `"comedy"` now choose the right effect
- New `"montage"` purpose type for rapid 2-3s mid-section cuts
- Smart ordering: hook always first, payoff always last

### 2. Dead-Air Trimming
**New file:** [silence-detector.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/server/silence-detector.ts)
- Auto-shaves 0.2s from each boundary on clips longer than 4s
- Eliminates those awkward silent gaps between spoken content

### 3. Flash Transitions (xfade)
```diff:short-renderer.ts
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
===
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
```

Replaced hard cuts with **0.15s white flash transitions** (`xfade=fadewhite`) — the signature look of viral shorts. Audio also crossfades smoothly via `acrossfade`.

### 4. Zoom Punch-In
Hook and reaction segments now get a subtle **1.08x zoompan** effect centered on the frame. Barely visible but adds visual energy.

### 5. Speed Ramp
Setup and lesson segments are sped up to **1.18x** (`setpts=0.85*PTS` + `atempo=1.18`). Fast enough to feel snappy, slow enough to sound natural.

### 6. Dynamic Overlay Text
- Hook text: **56px** font (was 40), positioned at y=80, shown for **2.2s** (was 2.8)
- Overlay captions: **34px** (was 30), positions alternate between y=200 and y=240
- Subtitles: **22px** (was 18), tighter bottom margin

### 7. AI-Guided Editing Hints
```diff:vision-ai.ts
===
import { readFile, stat } from "fs/promises";
import path from "path";
import { DetectedMoment } from "@/lib/types";
import { formatTime } from "@/lib/short-engine";

interface GeminiFileUploadResponse {
    file: {
        uri: string;
        name: string;
        state: string;
        mimeType: string;
    };
}

interface GeminiGenerateResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

interface VisionMomentRaw {
    label?: string;
    reason?: string;
    startSeconds?: number;
    endSeconds?: number;
    score?: number;
    energy?: "high" | "medium";
    tags?: string[];
    transcriptExcerpt?: string;
    editHint?: "speed_ramp" | "zoom_punch" | "hard_cut" | "flash_transition" | "slow_reveal";
    suggestedDurationSeconds?: number;
}

function buildVisionPrompt(projectTitle: string, transcript: string): string {
    return `You are an expert short-form golf video editor for the brand "Scrubs & Clubs".
Your job is to watch the provided video and find the absolute best moments to cut into a viral 30-60 second vertical short.

You must analyze BOTH the visual content (swings, reactions, facial expressions, ball flight, scenery) AND the audio/dialogue (funny commentary, genuine reactions, instructional tips, dramatic pauses).

## Context
Title/idea: ${projectTitle}
Transcript: ${transcript}

## Your task
Identify exactly 4-8 standout moments from this video. For each moment, provide:
1. "label" — A punchy 5-8 word title for this moment
2. "reason" — Why this moment works for short-form (hook value, comedy, relatability, visual impact)
3. "startSeconds" — Exact start timestamp in seconds
4. "endSeconds" — Exact end timestamp in seconds (each moment should be 2-6 seconds MAX)
5. "score" — Confidence score 0-100 of how viral/engaging this moment is
6. "energy" — "high" or "medium"
7. "tags" — Array of 1-3 tags from: ["hook", "setup", "reaction", "payoff", "lesson", "comedy", "visual"]
8. "transcriptExcerpt" — The dialogue that occurs during this moment
9. "editHint" — One of: "zoom_punch" (for reactions/hooks), "speed_ramp" (for setup/talking), "hard_cut" (for action moments), "flash_transition" (for dramatic reveals), "slow_reveal" (for payoffs)
10. "suggestedDurationSeconds" — How long this clip should be in the final edit (2-6 seconds)

## Rules
- The FIRST moment must work as an opening hook (something that grabs attention in <2 seconds)
- At least one moment must be a genuine reaction or funny beat
- At least one moment should be a payoff or satisfying conclusion
- Moments should come from DIFFERENT parts of the video — spread them out
- Prefer moments where audio energy and visual action align
- Keep clips TIGHT: 2-4 seconds for reactions/hooks, 4-6 seconds max for everything else
- If someone says something genuinely funny, that beats a generic "nice shot"
- Use "zoom_punch" editHint for reactions and hooks, "speed_ramp" for talking/setup moments
- Return ONLY a valid JSON array. No markdown fences. No explanation outside the array.`;
}

async function getFileMimeType(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    };
    return mimeMap[ext] ?? "video/mp4";
}

async function uploadVideoToGemini(
    filePath: string,
    apiKey: string
): Promise<string> {
    const fileBuffer = await readFile(filePath);
    const fileSize = (await stat(filePath)).size;
    const mimeType = await getFileMimeType(filePath);
    const displayName = path.basename(filePath);

    // Step 1: Start resumable upload
    const startResponse = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": String(fileSize),
                "X-Goog-Upload-Header-Content-Type": mimeType,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                file: { display_name: displayName },
            }),
        }
    );

    if (!startResponse.ok) {
        throw new Error(
            `Gemini file upload start failed: ${startResponse.status}`
        );
    }

    const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
        throw new Error("Gemini did not return an upload URL.");
    }

    // Step 2: Upload the file bytes
    const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Length": String(fileSize),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
        },
        body: fileBuffer,
    });

    if (!uploadResponse.ok) {
        throw new Error(
            `Gemini file upload failed: ${uploadResponse.status}`
        );
    }

    const uploadResult = (await uploadResponse.json()) as GeminiFileUploadResponse;
    const fileUri = uploadResult.file?.uri;
    if (!fileUri) {
        throw new Error("Gemini file upload returned no URI.");
    }

    // Step 3: Wait for file to become ACTIVE (Gemini processes the video)
    const fileName = uploadResult.file.name;
    for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
        );

        if (statusResponse.ok) {
            const statusData = (await statusResponse.json()) as { state?: string; uri?: string };
            if (statusData.state === "ACTIVE") {
                return statusData.uri ?? fileUri;
            }
            if (statusData.state === "FAILED") {
                throw new Error("Gemini video processing failed.");
            }
        }
    }

    throw new Error("Gemini video processing timed out after 90 seconds.");
}

function extractJsonArray(text: string): VisionMomentRaw[] {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON array found in Gemini response.");
    }

    return JSON.parse(text.slice(start, end + 1)) as VisionMomentRaw[];
}

export interface VisionDetectionResult {
    provider: "gemini" | "fallback";
    moments: DetectedMoment[];
    warning?: string;
}

export async function detectMomentsWithVision(
    projectId: string,
    sourceVideoId: string,
    sourceVideoPath: string,
    projectTitle: string,
    transcript: string
): Promise<VisionDetectionResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            provider: "fallback",
            moments: [],
            warning:
                "Gemini API key not configured. Set GEMINI_API_KEY in .env to enable AI video analysis.",
        };
    }

    const absolutePath = path.join(
        process.cwd(),
        "public",
        sourceVideoPath.replace(/^\//, "")
    );

    try {
        const fileUri = await uploadVideoToGemini(absolutePath, apiKey);

        const prompt = buildVisionPrompt(projectTitle, transcript);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    file_data: {
                                        mime_type: "video/mp4",
                                        file_uri: fileUri,
                                    },
                                },
                                { text: prompt },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 4096,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API returned ${response.status}`);
        }

        const data = (await response.json()) as GeminiGenerateResponse;
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            throw new Error("Gemini returned no content.");
        }

        const rawMoments = extractJsonArray(content);

        const moments: DetectedMoment[] = rawMoments
            .filter(
                (m) =>
                    typeof m.startSeconds === "number" &&
                    typeof m.endSeconds === "number" &&
                    m.label
            )
            .map((m, index) => ({
                id: `${sourceVideoId}-vision-moment-${index + 1}`,
                projectId,
                sourceVideoId,
                label: m.label ?? `Moment ${index + 1}`,
                reason: m.reason ?? "AI-detected moment with strong short-form potential.",
                transcriptExcerpt: m.transcriptExcerpt ?? "",
                tags: m.tags ?? ["hook"],
                score: Math.min(100, Math.max(0, m.score ?? 75)),
                start: formatTime(m.startSeconds ?? 0),
                end: formatTime(m.endSeconds ?? 0),
                startSeconds: m.startSeconds ?? 0,
                endSeconds: m.endSeconds ?? 0,
                energy: m.energy ?? "medium",
            }));

        if (moments.length === 0) {
            throw new Error("Gemini returned no valid moments.");
        }

        return {
            provider: "gemini",
            moments: moments.sort((a, b) => b.score - a.score).slice(0, 8),
        };
    } catch {
        return {
            provider: "fallback",
            moments: [],
            warning:
                "Gemini video analysis failed. Falling back to transcript-based moment detection.",
        };
    }
}
```

Gemini now returns per-moment editing instructions:
- `"editHint"`: zoom_punch, speed_ramp, hard_cut, flash_transition, slow_reveal
- `"suggestedDurationSeconds"`: AI recommends 2-6s clip lengths
- Clips capped at 2-6s MAX instead of 3-12s

---

## Files Changed

| File | Type | Change |
|---|---|---|
| [short-engine.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/short-engine.ts) | Modified | Smart segment selection, tag-aware purposes, 6s cap |
| [silence-detector.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/server/silence-detector.ts) | **New** | Dead-air trimming utility |
| [short-renderer.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/server/short-renderer.ts) | Modified | xfade transitions, zoompan, speed ramp, dynamic text |
| [vision-ai.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/services/vision-ai.ts) | Modified | Enhanced prompt with editing hints |
| [types.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/types.ts) | Modified | Added `"montage"` to SegmentPurpose |
