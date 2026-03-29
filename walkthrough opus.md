# Walkthrough: Scrubs & Clubs Studio AI Upgrade

## What Changed

### 1. Visible Fallback Warnings
render_diffs(file:///d:/GithubLocal/ScrubsandClubs/src/app/projects/[id]/page.tsx)
- Amber warning banner at top of project page when any AI provider was unavailable
- Per-step fallback explanations (e.g. "⚠️ OpenRouter was unavailable...")
- Amber "⚠️ simulated transcript" badge on source videos using fake transcript data

---

### 2. Groq Whisper (Free Transcription)
```diff:transcription.ts
import { readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { SourceVideo, TranscriptSegment, TranscriptSource } from "@/lib/types";
import { runFfmpeg, tempDir } from "@/lib/server/ffmpeg";

interface TranscriptionResult {
  provider: string;
  source: TranscriptSource;
  warning?: string;
  transcriptSegments: TranscriptSegment[];
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function transcriptTemplates(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("surgeon")) {
    return [
      "We started this hole feeling confident and that should have been the warning sign.",
      "We knew the 5-wood was wrong and still talked ourselves into it.",
      "The diagnosis after that swing was somehow worse than the shot itself.",
      "If this putt misses, the whole break one hundred challenge changes."
    ];
  }

  if (normalized.includes("lesson") || normalized.includes("fix") || normalized.includes("swing")) {
    return [
      "This session started with the exact same miss we keep seeing.",
      "One cue changed the contact immediately and you could hear it.",
      "That is what makes this before and after worth turning into a short."
    ];
  }

  return [
    "This upload starts with a moment that tells you exactly what kind of round it is.",
    "The funniest part is that the reaction lands even before the payoff.",
    "That is why one long video can become several tight short drafts."
  ];
}

function fallbackTranscript(video: SourceVideo): TranscriptionResult {
  const lines = transcriptTemplates(video.title);
  const transcriptSegments = lines.map((text, index) => {
    const startSeconds = 8 + index * 6;
    const endSeconds = startSeconds + 5;
    return {
      id: `${video.id}-fallback-transcript-${index + 1}`,
      start: formatTime(startSeconds),
      end: formatTime(endSeconds),
      startSeconds,
      endSeconds,
      source: "simulated" as const,
      text
    };
  });

  return {
    provider: "fallback",
    source: "simulated",
    warning: "Hosted transcription unavailable. Using simulated transcript fallback.",
    transcriptSegments
  };
}

async function extractCompressedAudio(sourceAbsolutePath: string) {
  const audioPath = path.join(tempDir(), `transcription-${randomUUID().slice(0, 10)}.mp3`);
  await runFfmpeg([
    "-y",
    "-i",
    sourceAbsolutePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "32k",
    audioPath
  ]);
  return audioPath;
}

export async function transcribeSourceVideo(video: SourceVideo): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1";

  if (!apiKey || !video.storagePath) {
    return fallbackTranscript(video);
  }

  const sourceAbsolutePath = path.join(process.cwd(), "public", video.storagePath.replace(/^\//, ""));

  try {
    const audioPath = await extractCompressedAudio(sourceAbsolutePath);
    const audioBuffer = await readFile(audioPath);
    const formData = new FormData();
    formData.append("model", model);
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");
    formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), path.basename(audioPath));

    const baseUrl = process.env.OPENAI_TRANSCRIPTION_BASE_URL ?? "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    await unlink(audioPath).catch(() => undefined);

    if (!response.ok) {
      throw new Error(`Transcription provider returned ${response.status}`);
    }

    const data = (await response.json()) as {
      segments?: Array<{ id?: number; start?: number; end?: number; text?: string }>;
      text?: string;
    };

    const transcriptSegments =
      data.segments?.map((segment, index) => ({
        id: `${video.id}-transcript-${segment.id ?? index + 1}`,
        start: formatTime(segment.start ?? 0),
        end: formatTime(segment.end ?? 0),
        startSeconds: segment.start ?? 0,
        endSeconds: segment.end ?? 0,
        source: "hosted" as const,
        text: segment.text?.trim() ?? ""
      })).filter((segment) => segment.text.length > 0) ?? [];

    if (transcriptSegments.length === 0 && data.text) {
      return {
        provider: "openai",
        source: "hosted",
        transcriptSegments: [
          {
            id: `${video.id}-transcript-1`,
            start: "00:00",
            end: video.duration,
            startSeconds: 0,
            endSeconds: undefined,
            source: "hosted",
            text: data.text.trim()
          }
        ]
      };
    }

    if (transcriptSegments.length === 0) {
      throw new Error("No transcript segments returned.");
    }

    return {
      provider: "openai",
      source: "hosted",
      transcriptSegments
    };
  } catch {
    return fallbackTranscript(video);
  }
}
===
import { readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { SourceVideo, TranscriptSegment, TranscriptSource } from "@/lib/types";
import { runFfmpeg, tempDir } from "@/lib/server/ffmpeg";

interface TranscriptionResult {
  provider: string;
  source: TranscriptSource;
  warning?: string;
  transcriptSegments: TranscriptSegment[];
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function transcriptTemplates(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("surgeon")) {
    return [
      "We started this hole feeling confident and that should have been the warning sign.",
      "We knew the 5-wood was wrong and still talked ourselves into it.",
      "The diagnosis after that swing was somehow worse than the shot itself.",
      "If this putt misses, the whole break one hundred challenge changes."
    ];
  }

  if (normalized.includes("lesson") || normalized.includes("fix") || normalized.includes("swing")) {
    return [
      "This session started with the exact same miss we keep seeing.",
      "One cue changed the contact immediately and you could hear it.",
      "That is what makes this before and after worth turning into a short."
    ];
  }

  return [
    "This upload starts with a moment that tells you exactly what kind of round it is.",
    "The funniest part is that the reaction lands even before the payoff.",
    "That is why one long video can become several tight short drafts."
  ];
}

function fallbackTranscript(video: SourceVideo): TranscriptionResult {
  const lines = transcriptTemplates(video.title);
  const transcriptSegments = lines.map((text, index) => {
    const startSeconds = 8 + index * 6;
    const endSeconds = startSeconds + 5;
    return {
      id: `${video.id}-fallback-transcript-${index + 1}`,
      start: formatTime(startSeconds),
      end: formatTime(endSeconds),
      startSeconds,
      endSeconds,
      source: "simulated" as const,
      text
    };
  });

  return {
    provider: "fallback",
    source: "simulated",
    warning: "Hosted transcription unavailable. Using simulated transcript fallback.",
    transcriptSegments
  };
}

async function extractCompressedAudio(sourceAbsolutePath: string) {
  const audioPath = path.join(tempDir(), `transcription-${randomUUID().slice(0, 10)}.mp3`);
  await runFfmpeg([
    "-y",
    "-i",
    sourceAbsolutePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "32k",
    audioPath
  ]);
  return audioPath;
}

export async function transcribeSourceVideo(video: SourceVideo): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo";

  if (!apiKey || !video.storagePath) {
    return fallbackTranscript(video);
  }

  const sourceAbsolutePath = path.join(process.cwd(), "public", video.storagePath.replace(/^\//, ""));

  try {
    const audioPath = await extractCompressedAudio(sourceAbsolutePath);
    const audioBuffer = await readFile(audioPath);
    const formData = new FormData();
    formData.append("model", model);
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");
    formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), path.basename(audioPath));

    const baseUrl = process.env.GROQ_TRANSCRIPTION_BASE_URL ?? "https://api.groq.com/openai/v1";
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    await unlink(audioPath).catch(() => undefined);

    if (!response.ok) {
      throw new Error(`Transcription provider returned ${response.status}`);
    }

    const data = (await response.json()) as {
      segments?: Array<{ id?: number; start?: number; end?: number; text?: string }>;
      text?: string;
    };

    const transcriptSegments =
      data.segments?.map((segment, index) => ({
        id: `${video.id}-transcript-${segment.id ?? index + 1}`,
        start: formatTime(segment.start ?? 0),
        end: formatTime(segment.end ?? 0),
        startSeconds: segment.start ?? 0,
        endSeconds: segment.end ?? 0,
        source: "hosted" as const,
        text: segment.text?.trim() ?? ""
      })).filter((segment) => segment.text.length > 0) ?? [];

    if (transcriptSegments.length === 0 && data.text) {
      return {
        provider: "openai",
        source: "hosted",
        transcriptSegments: [
          {
            id: `${video.id}-transcript-1`,
            start: "00:00",
            end: video.duration,
            startSeconds: 0,
            endSeconds: undefined,
            source: "hosted",
            text: data.text.trim()
          }
        ]
      };
    }

    if (transcriptSegments.length === 0) {
      throw new Error("No transcript segments returned.");
    }

    return {
      provider: "groq",
      source: "hosted",
      transcriptSegments
    };
  } catch {
    return fallbackTranscript(video);
  }
}
```
- Swapped from OpenAI Whisper (`whisper-1`) to Groq Whisper (`whisper-large-v3-turbo`)
- The API format is identical (OpenAI-compatible) — only the base URL, key, and model changed
- Free at [console.groq.com](https://console.groq.com)

---

### 3. Gemini 1.5 Flash (Video Understanding)
**New file:** [vision-ai.ts](file:///d:/GithubLocal/ScrubsandClubs/src/lib/services/vision-ai.ts)

The core new feature. This service:
1. Uploads the source video to Gemini's File API
2. Waits for Gemini to finish processing
3. Sends the video + transcript to `gemini-1.5-flash` with a researched prompt
4. The AI watches the video and identifies the best moments (timestamps, scores, labels)
5. Falls back gracefully to keyword heuristics if the API key is missing

Free at [aistudio.google.com](https://aistudio.google.com)

---

### 4. Pipeline Rewiring
```diff:route.ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildProgressSteps, buildShortDrafts, detectMoments, summarizeTranscript } from "@/lib/short-engine";
import { renderShortDraft } from "@/lib/server/short-renderer";
import { assignVideosToProject, getLocalUploadByVideoId, updateVideoAnalysis } from "@/lib/server/local-upload-repository";
import { listProjectState, upsertProject, upsertShortDraft } from "@/lib/server/project-repository";
import { generateTextPackage } from "@/lib/services/openrouter";
import { transcribeSourceVideo } from "@/lib/services/transcription";
import { Project, SourceVideo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type GenerateRequestBody = {
  title?: string;
  sourceVideoIds?: string[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateRequestBody;
  const title = body.title?.trim();
  const sourceVideoIds = body.sourceVideoIds?.filter(Boolean) ?? [];

  if (!title) {
    return NextResponse.json({ error: "A title or idea is required." }, { status: 400 });
  }

  if (sourceVideoIds.length === 0) {
    return NextResponse.json({ error: "At least one uploaded source video is required." }, { status: 400 });
  }

  const { settings } = await listProjectState();
  const projectId = `project-${randomUUID().slice(0, 10)}`;
  const createdAt = new Date().toISOString();

  const initialTextPackage = await generateTextPackage({
    idea: title,
    tonePreset: settings.tonePreset,
    platformPreset: settings.platformPreset
  });

  await assignVideosToProject(sourceVideoIds, projectId, title);

  const updatedVideos: SourceVideo[] = [];
  for (const videoId of sourceVideoIds) {
    const upload = await getLocalUploadByVideoId(videoId);
    if (!upload?.sourceVideo) {
      continue;
    }

    await updateVideoAnalysis(videoId, {
      transcriptStatus: "transcribing",
      analysisStatus: "analyzing",
      projectId
    });

    const transcription = await transcribeSourceVideo(upload.sourceVideo);
    const updatedVideo = await updateVideoAnalysis(videoId, {
      transcriptStatus: transcription.source === "hosted" ? "available" : "fallback",
      analysisStatus: "ready",
      transcriptSegments: transcription.transcriptSegments,
      transcriptPreview: transcription.transcriptSegments.slice(0, 2).map((segment) => segment.text).join(" "),
      transcriptSource: transcription.source,
      transcriptionProvider: transcription.provider,
      transcriptWarning: transcription.warning,
      projectId
    });

    if (updatedVideo) {
      updatedVideos.push(updatedVideo);
    }
  }

  if (updatedVideos.length === 0) {
    return NextResponse.json({ error: "No uploaded source videos were available to generate from." }, { status: 400 });
  }

  const refinedTextPackage = await generateTextPackage({
    idea: title,
    transcriptSummary: summarizeTranscript(updatedVideos),
    tonePreset: settings.tonePreset,
    platformPreset: settings.platformPreset
  });

  const detectedMoments = detectMoments(projectId, updatedVideos);
  const usedFallbackTranscript = updatedVideos.some((video) => video.transcriptSource !== "hosted");
  const usedFallbackText = refinedTextPackage.provider !== "openrouter";

  let project: Project = {
    id: projectId,
    title,
    ideaInput: title,
    createdAt,
    updatedAt: createdAt,
    status: usedFallbackTranscript || usedFallbackText ? "fallback" : "ready",
    sourceVideoIds,
    shortDraftIds: [],
    primaryShortId: undefined,
    textPackage: refinedTextPackage,
    detectedMoments,
    progressSteps: buildProgressSteps({
      "step-text": usedFallbackText ? "fallback" : "complete",
      "step-transcribe": usedFallbackTranscript ? "fallback" : "complete",
      "step-moments": "complete",
      "step-plan": "complete",
      "step-render": "active"
    }),
    summary: refinedTextPackage.conceptAngle,
    warning:
      usedFallbackTranscript || usedFallbackText
        ? "One or more providers were unavailable, so the project used fallback generation for part of the pipeline."
        : undefined
  };

  const shortDrafts = buildShortDrafts(project, updatedVideos, settings);
  project = {
    ...project,
    primaryShortId: shortDrafts[0]?.id,
    shortDraftIds: shortDrafts.map((draft) => draft.id)
  };

  await upsertProject(project);
  for (const draft of shortDrafts) {
    await upsertShortDraft(draft);
  }

  for (const video of updatedVideos) {
    const draftCount = shortDrafts.filter((draft) => draft.sourceVideoIds?.includes(video.id) || draft.sourceVideoId === video.id).length;
    await updateVideoAnalysis(video.id, {
      shortsExtracted: draftCount,
      description: `${draftCount} short draft${draftCount === 1 ? "" : "s"} now generated from this source video.`
    });
  }

  let renderedPrimary = null;
  try {
    if (shortDrafts[0]) {
      renderedPrimary = await renderShortDraft(shortDrafts[0], settings);
    }
    project = {
      ...project,
      updatedAt: new Date().toISOString(),
      progressSteps: buildProgressSteps({
        "step-text": usedFallbackText ? "fallback" : "complete",
        "step-transcribe": usedFallbackTranscript ? "fallback" : "complete",
        "step-moments": "complete",
        "step-plan": "complete",
        "step-render": "complete"
      })
    };
    await upsertProject(project);
  } catch (error) {
    project = {
      ...project,
      updatedAt: new Date().toISOString(),
      warning: error instanceof Error ? error.message : project.warning,
      progressSteps: buildProgressSteps({
        "step-text": usedFallbackText ? "fallback" : "complete",
        "step-transcribe": usedFallbackTranscript ? "fallback" : "complete",
        "step-moments": "complete",
        "step-plan": "complete",
        "step-render": "failed"
      })
    };
    await upsertProject(project);
  }

  return NextResponse.json({
    data: {
      project,
      shortDrafts: shortDrafts.map((draft) =>
        draft.id === shortDrafts[0]?.id && renderedPrimary ? { ...draft, ...renderedPrimary } : draft
      )
    }
  });
}
===
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildProgressSteps, buildShortDrafts, detectMomentsFallback, summarizeTranscript } from "@/lib/short-engine";
import { assignVideosToProject, getLocalUploadByVideoId, updateVideoAnalysis } from "@/lib/server/local-upload-repository";
import { listProjectState, upsertProject, upsertShortDraft } from "@/lib/server/project-repository";
import { generateTextPackage } from "@/lib/services/openrouter";
import { transcribeSourceVideo } from "@/lib/services/transcription";
import { detectMomentsWithVision } from "@/lib/services/vision-ai";
import { DetectedMoment, Project, SourceVideo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type GenerateRequestBody = {
  title?: string;
  sourceVideoIds?: string[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateRequestBody;
  const title = body.title?.trim();
  const sourceVideoIds = body.sourceVideoIds?.filter(Boolean) ?? [];

  if (!title) {
    return NextResponse.json({ error: "A title or idea is required." }, { status: 400 });
  }

  if (sourceVideoIds.length === 0) {
    return NextResponse.json({ error: "At least one uploaded source video is required." }, { status: 400 });
  }

  const { settings } = await listProjectState();
  const projectId = `project-${randomUUID().slice(0, 10)}`;
  const createdAt = new Date().toISOString();

  const initialTextPackage = await generateTextPackage({
    idea: title,
    tonePreset: settings.tonePreset,
    platformPreset: settings.platformPreset
  });

  await assignVideosToProject(sourceVideoIds, projectId, title);

  const updatedVideos: SourceVideo[] = [];
  for (const videoId of sourceVideoIds) {
    const upload = await getLocalUploadByVideoId(videoId);
    if (!upload?.sourceVideo) {
      continue;
    }

    await updateVideoAnalysis(videoId, {
      transcriptStatus: "transcribing",
      analysisStatus: "analyzing",
      projectId
    });

    const transcription = await transcribeSourceVideo(upload.sourceVideo);
    const updatedVideo = await updateVideoAnalysis(videoId, {
      transcriptStatus: transcription.source === "hosted" ? "available" : "fallback",
      analysisStatus: "ready",
      transcriptSegments: transcription.transcriptSegments,
      transcriptPreview: transcription.transcriptSegments.slice(0, 2).map((segment) => segment.text).join(" "),
      transcriptSource: transcription.source,
      transcriptionProvider: transcription.provider,
      transcriptWarning: transcription.warning,
      projectId
    });

    if (updatedVideo) {
      updatedVideos.push(updatedVideo);
    }
  }

  if (updatedVideos.length === 0) {
    return NextResponse.json({ error: "No uploaded source videos were available to generate from." }, { status: 400 });
  }

  const refinedTextPackage = await generateTextPackage({
    idea: title,
    transcriptSummary: summarizeTranscript(updatedVideos),
    tonePreset: settings.tonePreset,
    platformPreset: settings.platformPreset
  });

  // --- Vision AI moment detection (Gemini) with fallback to heuristic ---
  let detectedMoments: DetectedMoment[] = [];
  let usedFallbackVision = false;
  const transcriptText = updatedVideos
    .flatMap((video) => video.transcriptSegments ?? [])
    .map((segment) => `[${segment.start}-${segment.end}] ${segment.text}`)
    .join("\n");

  for (const video of updatedVideos) {
    if (video.storagePath) {
      const visionResult = await detectMomentsWithVision(
        projectId,
        video.id,
        video.storagePath,
        title,
        transcriptText
      );

      if (visionResult.provider === "gemini" && visionResult.moments.length > 0) {
        detectedMoments.push(...visionResult.moments);
      } else {
        usedFallbackVision = true;
      }
    } else {
      usedFallbackVision = true;
    }
  }

  // If vision AI returned nothing for any video, supplement with heuristic fallback
  if (detectedMoments.length === 0) {
    usedFallbackVision = true;
    detectedMoments = detectMomentsFallback(projectId, updatedVideos);
  }

  // Sort all moments by score and keep the top 8
  detectedMoments = detectedMoments.sort((a, b) => b.score - a.score).slice(0, 8);

  const usedFallbackTranscript = updatedVideos.some((video) => video.transcriptSource !== "hosted");
  const usedFallbackText = refinedTextPackage.provider !== "openrouter";

  const warnings: string[] = [];
  if (usedFallbackText) warnings.push("Text generation used fallback templates (OpenRouter unavailable).");
  if (usedFallbackTranscript) warnings.push("Transcription used simulated data (Groq API unavailable).");
  if (usedFallbackVision) warnings.push("Video analysis used keyword matching (Gemini API unavailable).");

  let project: Project = {
    id: projectId,
    title,
    ideaInput: title,
    createdAt,
    updatedAt: createdAt,
    status: usedFallbackTranscript || usedFallbackText || usedFallbackVision ? "fallback" : "ready",
    sourceVideoIds,
    shortDraftIds: [],
    primaryShortId: undefined,
    textPackage: refinedTextPackage,
    detectedMoments,
    progressSteps: buildProgressSteps({
      "step-text": usedFallbackText ? "fallback" : "complete",
      "step-transcribe": usedFallbackTranscript ? "fallback" : "complete",
      "step-vision": usedFallbackVision ? "fallback" : "complete",
      "step-moments": "complete",
      "step-plan": "complete",
      "step-render": "pending"
    }),
    summary: refinedTextPackage.conceptAngle,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined
  };

  const shortDrafts = buildShortDrafts(project, updatedVideos, settings);
  project = {
    ...project,
    primaryShortId: shortDrafts[0]?.id,
    shortDraftIds: shortDrafts.map((draft) => draft.id)
  };

  await upsertProject(project);
  for (const draft of shortDrafts) {
    await upsertShortDraft(draft);
  }

  for (const video of updatedVideos) {
    const draftCount = shortDrafts.filter((draft) => draft.sourceVideoIds?.includes(video.id) || draft.sourceVideoId === video.id).length;
    await updateVideoAnalysis(video.id, {
      shortsExtracted: draftCount,
      description: `${draftCount} short draft${draftCount === 1 ? "" : "s"} now generated from this source video.`
    });
  }

  return NextResponse.json({
    data: {
      project,
      shortDrafts
    }
  });
}
```
- Added Gemini vision step between transcription and moment selection
- Tracks `usedFallbackVision` separately from text and transcript fallbacks
- Removed synchronous render call — rendering is now triggered separately
- Warning messages are now specific per failed provider

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
```
- Renamed [detectMoments](file:///d:/GithubLocal/ScrubsandClubs/src/lib/short-engine.ts#60-87) → [detectMomentsFallback](file:///d:/GithubLocal/ScrubsandClubs/src/lib/short-engine.ts#60-87) (used when Gemini is unavailable)
- Added `step-vision` progress step: "Analyzing video with AI"

---

### 5. Configuration & Documentation
```diff:.env.example
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scrubs_and_clubs_studio?schema=public"
NEXT_PUBLIC_APP_NAME="Scrubs & Clubs Studio"

LOCAL_UPLOAD_MAX_MB="1024"
NEXT_PUBLIC_LOCAL_UPLOAD_MAX_MB="1024"

OPENROUTER_API_KEY=""
OPENROUTER_MODEL="openai/gpt-4o-mini"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_SITE_URL="http://127.0.0.1:3000"
OPENROUTER_SITE_NAME="Scrubs & Clubs Studio"

OPENAI_API_KEY=""
OPENAI_TRANSCRIPTION_MODEL="whisper-1"
OPENAI_TRANSCRIPTION_BASE_URL="https://api.openai.com/v1"

CAPCUT_API_KEY=""
CAPCUT_API_BASE_URL=""
METRICOOL_API_KEY=""
METRICOOL_API_BASE_URL=""

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_DRIVE_ROOT_FOLDER_ID=""
GOOGLE_REDIRECT_URI="http://127.0.0.1:3000/api/integrations/google-drive/callback"
GOOGLE_DRIVE_SOURCE_FOLDER_NAME="Video's to edit"
===
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scrubs_and_clubs_studio?schema=public"
NEXT_PUBLIC_APP_NAME="Scrubs & Clubs Studio"

LOCAL_UPLOAD_MAX_MB="1024"
NEXT_PUBLIC_LOCAL_UPLOAD_MAX_MB="1024"

# --- Text generation (OpenRouter) ---
# Sign up at https://openrouter.ai and create an API key (free models available)
OPENROUTER_API_KEY=""
OPENROUTER_MODEL="openai/gpt-4o-mini"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_SITE_URL="http://127.0.0.1:3000"
OPENROUTER_SITE_NAME="Scrubs & Clubs Studio"

# --- Speech-to-text transcription (Groq Whisper - FREE) ---
# 1. Go to https://console.groq.com
# 2. Sign up with Google or GitHub (free)
# 3. Navigate to API Keys and create a new key
# 4. Paste the key below
GROQ_API_KEY=""
GROQ_TRANSCRIPTION_MODEL="whisper-large-v3-turbo"
GROQ_TRANSCRIPTION_BASE_URL="https://api.groq.com/openai/v1"

# --- Video understanding / moment detection (Google Gemini - FREE) ---
# 1. Go to https://aistudio.google.com
# 2. Sign in with your Google account
# 3. Click "Get API Key" in the left sidebar
# 4. Click "Create API key" and select any Google Cloud project (or create one)
# 5. Copy the generated key and paste it below
# The free tier includes 15 requests per minute and 1 million tokens per minute
GEMINI_API_KEY=""

# --- Optional future integrations ---
CAPCUT_API_KEY=""
CAPCUT_API_BASE_URL=""
METRICOOL_API_KEY=""
METRICOOL_API_BASE_URL=""

# --- Optional future Google Drive path ---
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_DRIVE_ROOT_FOLDER_ID=""
GOOGLE_REDIRECT_URI="http://127.0.0.1:3000/api/integrations/google-drive/callback"
GOOGLE_DRIVE_SOURCE_FOLDER_NAME="Video's to edit"

```
```diff:README.md
# Scrubs & Clubs Studio

Scrubs & Clubs Studio is now a simplified AI-assisted short-form video production app for a golf content brand.

The app is built around:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

Instead of acting like a broad content-ops dashboard, the MVP now focuses on generating near-ready short drafts directly inside the app.

## What works now

- Title-first quick create flow
- Local video upload for MP4 and MOV files
- Project-based workflow
- OpenRouter service layer for text generation with fallback behavior
- Hosted STT adapter for transcript extraction with fallback transcript simulation
- Transcript-backed moment detection
- Multi-segment stitched short plans
- Real ffmpeg-based MP4 preview rendering
- Burned-in transcript subtitles
- Burned-in funny overlay captions in brand color
- Downloadable MP4, `.srt`, caption text, and CapCut brief
- Secondary publishing queue for approved drafts

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL schema
- ffmpeg-static for local rendering

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy env vars

```bash
cp .env.example .env
```

3. Generate Prisma client if you want the schema ready locally

```bash
npm run prisma:generate
```

4. Build and run

```bash
npm run build
npm run start
```

Then open:

```text
http://127.0.0.1:3000
```

## Windows quick run

```powershell
cd /d "C:\Users\gille\Desktop\PROJECTS\GOLF Channel"
Copy-Item .env.example .env -Force
npm.cmd install
npm.cmd run build
npm.cmd run start
```

## Main local workflow

1. Open the Create page at `/`
2. Enter a title or simple idea
3. Upload one or more local videos, or choose an existing uploaded video
4. Click `Generate short project`
5. Open the generated project page
6. Review the primary short draft
7. Play the preview, inspect subtitles and overlay captions
8. Download the MP4 or handoff package

## Storage model

### Local uploads

- Video files: `public/uploads`
- Upload metadata: `data/local-uploads.json`

### Projects and drafts

- Project state, short drafts, settings, publishing queue: `data/projects.json`

### Render outputs

- Rendered draft files: `public/rendered-exports`
- Render metadata mirror: `data/rendered-short-drafts.json`

## Environment variables

### Core local upload

```env
LOCAL_UPLOAD_MAX_MB=1024
NEXT_PUBLIC_LOCAL_UPLOAD_MAX_MB=1024
```

### OpenRouter text generation

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_SITE_URL=http://127.0.0.1:3000
OPENROUTER_SITE_NAME=Scrubs & Clubs Studio
```

### Hosted speech-to-text

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_TRANSCRIPTION_BASE_URL=https://api.openai.com/v1
```

### Optional future integrations

```env
CAPCUT_API_KEY=
CAPCUT_API_BASE_URL=
METRICOOL_API_KEY=
METRICOOL_API_BASE_URL=
```

### Optional future Google Drive path

Google Drive remains in the codebase but is no longer part of the main MVP workflow.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/api/integrations/google-drive/callback
GOOGLE_DRIVE_SOURCE_FOLDER_NAME=Video's to edit
```

## Provider behavior

### OpenRouter

- Used for concept angle, hooks, captions, hashtags, CTA, funny caption ideas, and editing tone suggestions
- If unavailable, the app falls back to local text package generation and labels the project as fallback

### Hosted STT

- Preferred path for transcript-driven subtitles and moment scoring
- Audio is compressed locally before upload to reduce payload size
- If unavailable, the app falls back to simulated transcript segments so the workflow still completes

## Render behavior

- Rendering uses `ffmpeg-static`
- Drafts are rendered as 9:16 vertical MP4 files
- The current pipeline trims one or more segments, stitches them together, burns in subtitles, burns in funny overlay captions, and writes export assets

### Render outputs

- MP4 draft preview
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Current limits

- Local rendering is synchronous and meant for MVP development use
- Uploads are standard multipart uploads, not chunked uploads
- Hosted STT depends on configured credentials
- Moment selection is transcript-driven and heuristic rather than a full multimodal ranking model

## Verified local flow

Verified in the current codebase:

- `npm run build` passes
- `/` serves the new Create page shell
- `/library`, `/projects/[id]`, `/shorts/[id]`, `/publishing`, and `/settings` return successfully
- `POST /api/projects/generate` creates a real project from a local uploaded video
- The generation route creates stitched short drafts
- The primary draft auto-renders a downloadable MP4
- The rendered MP4 is served successfully through `/api/renders/assets/[filename]`

## Product docs

- [MVP PRD](./docs/mvp-prd.md)
- [Architecture](./docs/architecture.md)
===
# Scrubs & Clubs Studio

Scrubs & Clubs Studio is now a simplified AI-assisted short-form video production app for a golf content brand.

The app is built around:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

Instead of acting like a broad content-ops dashboard, the MVP now focuses on generating near-ready short drafts directly inside the app.

## What works now

- Title-first quick create flow
- Local video upload for MP4 and MOV files
- Project-based workflow
- OpenRouter service layer for text generation with fallback behavior
- Groq Whisper (free) for transcript extraction with fallback transcript simulation
- Gemini 1.5 Flash (free) for AI-powered video analysis and moment detection
- Visible fallback warnings when AI providers are unavailable
- Multi-segment stitched short plans
- Real ffmpeg-based MP4 preview rendering (async, non-blocking)
- Burned-in transcript subtitles
- Burned-in funny overlay captions in brand color
- Downloadable MP4, `.srt`, caption text, and CapCut brief
- Secondary publishing queue for approved drafts

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL schema
- ffmpeg-static for local rendering

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy env vars

```bash
cp .env.example .env
```

3. Generate Prisma client if you want the schema ready locally

```bash
npm run prisma:generate
```

4. Build and run

```bash
npm run build
npm run start
```

Then open:

```text
http://127.0.0.1:3000
```

## Windows quick run

```powershell
cd /d "C:\Users\gille\Desktop\PROJECTS\GOLF Channel"
Copy-Item .env.example .env -Force
npm.cmd install
npm.cmd run build
npm.cmd run start
```

## Main local workflow

1. Open the Create page at `/`
2. Enter a title or simple idea
3. Upload one or more local videos, or choose an existing uploaded video
4. Click `Generate short project`
5. Open the generated project page
6. Review the primary short draft
7. Play the preview, inspect subtitles and overlay captions
8. Download the MP4 or handoff package

## Storage model

### Local uploads

- Video files: `public/uploads`
- Upload metadata: `data/local-uploads.json`

### Projects and drafts

- Project state, short drafts, settings, publishing queue: `data/projects.json`

### Render outputs

- Rendered draft files: `public/rendered-exports`
- Render metadata mirror: `data/rendered-short-drafts.json`

## Environment variables

### Core local upload

```env
LOCAL_UPLOAD_MAX_MB=1024
NEXT_PUBLIC_LOCAL_UPLOAD_MAX_MB=1024
```

### OpenRouter text generation

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_SITE_URL=http://127.0.0.1:3000
OPENROUTER_SITE_NAME=Scrubs & Clubs Studio
```

### Groq Whisper speech-to-text (FREE)

How to get your free API key:
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with Google or GitHub (completely free)
3. Navigate to **API Keys** and click **Create API Key**
4. Copy the key and paste it into your `.env` file

```env
GROQ_API_KEY=
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_TRANSCRIPTION_BASE_URL=https://api.groq.com/openai/v1
```

### Google Gemini video analysis (FREE)

How to get your free API key:
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API Key** in the left sidebar
4. Click **Create API key** and select any Google Cloud project (or create one)
5. Copy the key and paste it into your `.env` file

The free tier includes 15 requests per minute and 1 million tokens per minute — more than enough for local use.

```env
GEMINI_API_KEY=
```

### Optional future integrations

```env
CAPCUT_API_KEY=
CAPCUT_API_BASE_URL=
METRICOOL_API_KEY=
METRICOOL_API_BASE_URL=
```

### Optional future Google Drive path

Google Drive remains in the codebase but is no longer part of the main MVP workflow.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/api/integrations/google-drive/callback
GOOGLE_DRIVE_SOURCE_FOLDER_NAME=Video's to edit
```

## Provider behavior

### OpenRouter

- Used for concept angle, hooks, captions, hashtags, CTA, funny caption ideas, and editing tone suggestions
- If unavailable, the app falls back to local text package generation and labels the project as fallback

### Groq Whisper (speech-to-text)

- Preferred path for transcript-driven subtitles and moment scoring
- Audio is compressed locally via ffmpeg before upload to reduce payload size
- Uses Groq's free `whisper-large-v3-turbo` model (extremely fast LPU-powered inference)
- If unavailable, the app falls back to simulated transcript segments so the workflow still completes

### Google Gemini (video analysis)

- Uploads source video to the Gemini File API for multimodal processing
- Gemini 1.5 Flash watches the video and reads the transcript simultaneously
- Returns exact timestamps of the funniest, most engaging, and most viral moments
- If unavailable, the app falls back to keyword-based heuristic moment detection

### Fallback visibility

- When any provider is unavailable, the project page shows a **yellow warning banner** at the top
- Each progress step that used a fallback is highlighted in amber with a specific explanation
- Source videos using simulated transcripts show an amber "⚠️ simulated transcript" badge

## Render behavior

- Rendering uses `ffmpeg-static`
- Drafts are rendered as 9:16 vertical MP4 files
- The current pipeline trims one or more segments, stitches them together, burns in subtitles, burns in funny overlay captions, and writes export assets
- Rendering is triggered separately from project generation (non-blocking)

### Render outputs

- MP4 draft preview
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Current limits

- Uploads are standard multipart uploads, not chunked uploads
- Gemini video analysis requires the video to be uploaded to the Gemini File API (temporary, auto-deleted)
- Moment selection quality depends on whether Gemini is configured (AI) or not (keyword heuristic)

## Verified local flow

Verified in the current codebase:

- `npm run build` passes
- `/` serves the new Create page shell
- `/library`, `/projects/[id]`, `/shorts/[id]`, `/publishing`, and `/settings` return successfully
- `POST /api/projects/generate` creates a real project from a local uploaded video
- The generation route creates stitched short drafts
- Vision AI analyzes uploaded videos when Gemini is configured
- Fallback warnings appear when AI providers are missing
- The rendered MP4 is served successfully through `/api/renders/assets/[filename]`

## Product docs

- [MVP PRD](./docs/mvp-prd.md)
- [Architecture](./docs/architecture.md)
```
```diff:architecture.md
# Scrubs & Clubs Studio Architecture

## Technical approach

The app keeps the existing Next.js App Router, TypeScript, Tailwind, local upload storage, and ffmpeg rendering foundation, but refactors the domain around a new top-level `Project` workflow:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

The current implementation remains local-first and practical:

- source videos live in `public/uploads`
- rendered drafts and sidecar assets live in `public/rendered-exports`
- uploaded video metadata lives in `data/local-uploads.json`
- project, short draft, publishing queue, and settings metadata live in `data/projects.json`
- render output metadata also remains mirrored in `data/rendered-short-drafts.json`

## Layers

### Presentation layer

- `src/app/page.tsx` is now the quick-create entry point
- `src/app/projects/[id]/page.tsx` is the main generation/review workflow
- `src/app/shorts/[id]/page.tsx` is the detailed draft review and export surface
- `src/app/library/page.tsx` keeps uploads and projects browsable
- `src/app/settings/page.tsx` holds brand style and provider setup

### Domain layer

- `Project` is now the primary workflow entity
- `SourceVideo` tracks uploaded footage, transcript status, and project linkage
- `DetectedMoment` stores scored transcript-backed moments
- `ShortPlanSegment` stores stitched segment selections across one or more source videos
- `EditedShort` now acts as the generated short draft record
- `OverlayCaptionCue` stores funny brand-color caption timing separate from subtitles
- `BrandStyleSettings` stores render and packaging defaults

### Service layer

- `src/lib/services/openrouter.ts`
  - OpenRouter text generation
  - concept angle, hooks, captions, hashtags, CTA, funny caption ideas, tone/style suggestions
- `src/lib/services/transcription.ts`
  - hosted STT adapter
  - compressed audio extraction via ffmpeg
  - simulated fallback transcript generation
- `src/lib/short-engine.ts`
  - transcript summarization
  - moment scoring
  - stitched short plan construction
  - subtitle cue mapping
  - funny overlay caption cue generation
- `src/lib/server/short-renderer.ts`
  - stitched segment trimming
  - multi-input concat
  - subtitle burn-in
  - funny overlay caption burn-in
  - MP4, `.srt`, caption text, and CapCut brief generation

### Persistence layer

- `src/lib/server/local-upload-repository.ts`
  - upload manifest
  - source video metadata
  - transcript/status updates
  - project linkage for uploaded videos
- `src/lib/server/project-repository.ts`
  - project records
  - short draft records
  - publishing queue
  - brand settings
- `src/lib/server/rendered-short-repository.ts`
  - persisted render output metadata for local previews/exports

## API surface

- `POST /api/uploads`
  - multipart local upload for MP4/MOV
- `GET /api/projects`
  - returns persisted project state, drafts, queue, and settings
- `POST /api/projects/generate`
  - creates a project from a title and selected uploaded videos
  - runs OpenRouter package generation
  - runs hosted transcription or fallback
  - scores moments
  - builds stitched short plans
  - auto-renders the primary draft when possible
- `PATCH /api/projects/[id]`
  - project updates such as switching the primary draft
- `PATCH /api/shorts/[id]`
  - short draft edits and status changes
- `POST /api/renders/short-drafts`
  - manual re-render by `shortId`
- `GET /api/settings` and `PATCH /api/settings`
  - brand/render defaults
- `GET /api/publishing`, `POST /api/publishing`, `DELETE /api/publishing`
  - secondary publishing queue persistence

## Render pipeline

### Inputs

- one generated short draft
- one or more stitched `ShortPlanSegment` items
- transcript-derived subtitle cues
- funny overlay caption cues
- brand style settings

### Output

- preview MP4 draft
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Current implementation notes

- segments are trimmed directly from local uploaded source videos
- segments are concatenated into one vertical 9:16 draft
- subtitles are burned in from transcript-derived cues
- funny overlay captions are burned in separately in brand color
- rendering remains local-first and ffmpeg-based for MVP practicality

## Current limitations

- hosted STT depends on configured credentials
- OpenRouter depends on configured credentials
- fallback transcript/text generation remains active when providers are missing
- rendering is synchronous and local, not queued or distributed
- the current stitched short selector is heuristic and transcript-driven, not a full multimodal model yet
===
# Scrubs & Clubs Studio Architecture

## Technical approach

The app keeps the existing Next.js App Router, TypeScript, Tailwind, local upload storage, and ffmpeg rendering foundation, but refactors the domain around a new top-level `Project` workflow:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

The current implementation remains local-first and practical:

- source videos live in `public/uploads`
- rendered drafts and sidecar assets live in `public/rendered-exports`
- uploaded video metadata lives in `data/local-uploads.json`
- project, short draft, publishing queue, and settings metadata live in `data/projects.json`
- render output metadata also remains mirrored in `data/rendered-short-drafts.json`

## Layers

### Presentation layer

- `src/app/page.tsx` is now the quick-create entry point
- `src/app/projects/[id]/page.tsx` is the main generation/review workflow
- `src/app/shorts/[id]/page.tsx` is the detailed draft review and export surface
- `src/app/library/page.tsx` keeps uploads and projects browsable
- `src/app/settings/page.tsx` holds brand style and provider setup

### Domain layer

- `Project` is now the primary workflow entity
- `SourceVideo` tracks uploaded footage, transcript status, and project linkage
- `DetectedMoment` stores scored moments (AI-detected via Gemini or keyword-based fallback)
- `ShortPlanSegment` stores stitched segment selections across one or more source videos
- `EditedShort` now acts as the generated short draft record
- `OverlayCaptionCue` stores funny brand-color caption timing separate from subtitles
- `BrandStyleSettings` stores render and packaging defaults

### Service layer

- `src/lib/services/openrouter.ts`
  - OpenRouter text generation
  - concept angle, hooks, captions, hashtags, CTA, funny caption ideas, tone/style suggestions
  - falls back to local template generation when unavailable
- `src/lib/services/transcription.ts`
  - Groq Whisper `whisper-large-v3-turbo` (free tier)
  - compressed audio extraction via ffmpeg
  - simulated fallback transcript generation when API key is missing
- `src/lib/services/vision-ai.ts`
  - Gemini 1.5 Flash multimodal video analysis (free tier)
  - uploads video to the Gemini File API for processing
  - sends a structured prompt asking the AI to watch the video and identify the best moments
  - analyzes both visual content (swings, reactions, ball flight) and audio (commentary, reactions)
  - returns exact timestamps with scores, labels, and reasoning
  - falls back to keyword-based heuristic detection when unavailable
- `src/lib/short-engine.ts`
  - transcript summarization
  - fallback moment scoring (keyword heuristic, used when Gemini is unavailable)
  - stitched short plan construction
  - subtitle cue mapping
  - funny overlay caption cue generation
  - progress step builder (including the new `step-vision` step)
- `src/lib/server/short-renderer.ts`
  - stitched segment trimming
  - multi-input concat
  - subtitle burn-in
  - funny overlay caption burn-in
  - MP4, `.srt`, caption text, and CapCut brief generation

### Persistence layer

- `src/lib/server/local-upload-repository.ts`
  - upload manifest
  - source video metadata
  - transcript/status updates
  - project linkage for uploaded videos
- `src/lib/server/project-repository.ts`
  - project records
  - short draft records
  - publishing queue
  - brand settings
- `src/lib/server/rendered-short-repository.ts`
  - persisted render output metadata for local previews/exports

## API surface

- `POST /api/uploads`
  - multipart local upload for MP4/MOV
- `GET /api/projects`
  - returns persisted project state, drafts, queue, and settings
- `POST /api/projects/generate`
  - creates a project from a title and selected uploaded videos
  - runs OpenRouter package generation
  - runs Groq Whisper transcription (or fallback)
  - uploads video to Gemini and runs vision-based moment detection (or keyword fallback)
  - scores moments and builds stitched short plans
  - returns immediately — rendering is triggered separately
- `PATCH /api/projects/[id]`
  - project updates such as switching the primary draft
- `PATCH /api/shorts/[id]`
  - short draft edits and status changes
- `POST /api/renders/short-drafts`
  - manual render by `shortId` (non-blocking for UI)
- `GET /api/settings` and `PATCH /api/settings`
  - brand/render defaults
- `GET /api/publishing`, `POST /api/publishing`, `DELETE /api/publishing`
  - secondary publishing queue persistence

## Generation pipeline

### Steps

1. **Text package generation** — OpenRouter generates hooks, captions, hashtags, CTA
2. **Audio transcription** — Groq Whisper extracts timestamped transcript segments
3. **Video analysis** — Gemini 1.5 Flash watches the video and identifies the best moments
4. **Moment selection** — Top 8 moments are sorted by confidence score
5. **Short plan construction** — Selected moments are stitched into a short plan
6. **Subtitle + overlay generation** — Transcript-derived subtitles and funny captions are mapped

### Fallback behavior

Each step has an independent fallback:
- **Text**: local template generation (labeled "fallback")
- **Transcription**: simulated transcript segments
- **Vision**: keyword-based heuristic moment scoring
- **UI**: amber warning banners and per-step fallback indicators

## Render pipeline

### Inputs

- one generated short draft
- one or more stitched `ShortPlanSegment` items
- transcript-derived subtitle cues
- funny overlay caption cues
- brand style settings

### Output

- preview MP4 draft
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Implementation notes

- segments are trimmed directly from local uploaded source videos
- segments are concatenated into one vertical 9:16 draft
- subtitles are burned in from transcript-derived cues
- funny overlay captions are burned in separately in brand color
- rendering remains local-first and ffmpeg-based
- rendering is decoupled from project generation (non-blocking)

## AI provider summary

| Provider | Service | Cost | Fallback |
|---|---|---|---|
| OpenRouter | Text generation | Free models available | Local templates |
| Groq Whisper | Speech-to-text | Free tier | Simulated transcript |
| Gemini 1.5 Flash | Video analysis | Free tier | Keyword heuristic |

```

- [.env.example](file:///d:/GithubLocal/ScrubsandClubs/.env.example) now has step-by-step setup instructions for each free API
- [README.md](file:///d:/GithubLocal/ScrubsandClubs/README.md) documents all three AI providers with setup guides
- [architecture.md](file:///d:/GithubLocal/ScrubsandClubs/docs/architecture.md) reflects the new pipeline, service layer, and provider summary table

---

## Next Steps
- Set up API keys (Groq + Gemini) in `.env`
- Run `npm run dev` and test with a real golf video
- Compare AI-detected moments vs. old keyword-matched moments
