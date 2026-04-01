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
