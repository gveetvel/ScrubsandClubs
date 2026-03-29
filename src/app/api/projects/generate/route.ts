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
