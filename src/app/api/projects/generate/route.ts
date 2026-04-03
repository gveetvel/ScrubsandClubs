import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildProgressSteps, buildShortDrafts, detectMomentsFallback, summarizeTranscript } from "@/lib/short-engine";
import { assignVideosToProject, getLocalUploadByVideoId, updateVideoAnalysis } from "@/lib/server/local-upload-repository";
import { listProjectState, upsertProject, upsertShortDraft } from "@/lib/server/project-repository";
import { generateTextPackage } from "@/lib/services/openrouter";
import { transcribeSourceVideo } from "@/lib/services/transcription";
import { detectMomentsWithVision } from "@/lib/services/vision-ai";
import { DetectedMoment, Project, ProgressStepStatus, SourceVideo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type GenerateRequestBody = {
  title?: string;
  sourceVideoIds?: string[];
};

type StepEvent = { type: "step"; stepId: string; status: ProgressStepStatus };
type DoneEvent = { type: "done"; projectId: string; project: Project; shortDrafts: ReturnType<typeof buildShortDrafts> };
type ErrorEvent = { type: "error"; message: string };
type SSEEvent = StepEvent | DoneEvent | ErrorEvent;

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SSEEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const { settings } = await listProjectState();
        const projectId = `project-${randomUUID().slice(0, 10)}`;
        const createdAt = new Date().toISOString();

        // Step: text generation is deferred until after transcription so the
        // transcript summary can inform hook, caption, and CTA generation.
        // Previous code ran two separate text-gen calls (one before transcription
        // and one after). The first result was immediately discarded, wasting an
        // API call and emitting a phantom "step-text-refine" SSE event that had
        // no matching UI step. Now we call once, after transcription.
        send({ type: "step", stepId: "step-text", status: "active" });

        await assignVideosToProject(sourceVideoIds, projectId, title);

        // Step: transcription
        send({ type: "step", stepId: "step-transcribe", status: "active" });
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
          send({ type: "error", message: "No uploaded source videos were available to generate from." });
          controller.close();
          return;
        }

        const usedFallbackTranscript = updatedVideos.some((video) => video.transcriptSource !== "hosted");
        const transcriptWarning = usedFallbackTranscript
          ? updatedVideos.find((v) => v.transcriptWarning)?.transcriptWarning
          : undefined;
        send({ type: "step", stepId: "step-transcribe", status: usedFallbackTranscript ? "fallback" : "complete" });

        // Step: text generation (single call, informed by transcript summary)
        const refinedTextPackage = await generateTextPackage({
          idea: title,
          transcriptSummary: summarizeTranscript(updatedVideos),
          tonePreset: settings.tonePreset,
          platformPreset: settings.platformPreset
        });
        const usedFallbackText = refinedTextPackage.provider !== "openrouter";
        send({ type: "step", stepId: "step-text", status: usedFallbackText ? "fallback" : "complete" });

        // Step: vision AI moment detection
        send({ type: "step", stepId: "step-vision", status: "active" });
        let detectedMoments: DetectedMoment[] = [];
        let usedFallbackVision = false;
        let visionErrorMessage: string | undefined;
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
              if (visionResult.warning && !visionErrorMessage) {
                visionErrorMessage = visionResult.warning;
              }
            }
          } else {
            usedFallbackVision = true;
            visionErrorMessage = "Video has no storage path — cannot upload to Gemini.";
          }
        }

        if (detectedMoments.length === 0) {
          usedFallbackVision = true;
          detectedMoments = detectMomentsFallback(projectId, updatedVideos);
        }

        detectedMoments = detectedMoments.sort((a, b) => b.score - a.score).slice(0, 8);
        send({ type: "step", stepId: "step-vision", status: usedFallbackVision ? "fallback" : "complete" });

        // Step: moments + plan
        send({ type: "step", stepId: "step-moments", status: "active" });
        send({ type: "step", stepId: "step-plan", status: "active" });

        const warnings: string[] = [];
        if (usedFallbackText) warnings.push("Text generation used fallback templates (OpenRouter unavailable).");
        if (usedFallbackTranscript) {
          const reason = transcriptWarning ? ` Error: ${transcriptWarning}` : " Groq API unavailable.";
          warnings.push(`Transcription used simulated data.${reason}`);
        }
        if (usedFallbackVision) warnings.push(visionErrorMessage ?? "Video analysis used keyword matching (Gemini API unavailable).");

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
          progressSteps: buildProgressSteps(
            {
              "step-text": usedFallbackText ? "fallback" : "complete",
              "step-transcribe": usedFallbackTranscript ? "fallback" : "complete",
              "step-vision": usedFallbackVision ? "fallback" : "complete",
              "step-moments": "complete",
              "step-plan": "complete",
              "step-render": "pending"
            },
            {
              "step-transcribe": transcriptWarning,
              "step-vision": usedFallbackVision ? visionErrorMessage : undefined
            }
          ),
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

        send({ type: "step", stepId: "step-moments", status: "complete" });
        send({ type: "step", stepId: "step-plan", status: "complete" });
        send({ type: "done", projectId, project, shortDrafts });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
