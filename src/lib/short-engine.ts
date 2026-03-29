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
