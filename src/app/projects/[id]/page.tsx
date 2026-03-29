"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const ready = usePageReady();
  const { state, renderShortDraft, renderAllDraftsForProject, approveShortDraft, rejectShortDraft, queueShortForPublishing, updateProject } = useMockApp();

  const project = state.projects.find((item) => item.id === params.id);
  const sourceVideos = useMemo(() => state.sourceVideos.filter((video) => project?.sourceVideoIds.includes(video.id)), [project?.sourceVideoIds, state.sourceVideos]);
  const drafts = useMemo(() => state.editedShorts.filter((draft) => draft.projectId === params.id), [params.id, state.editedShorts]);
  const primaryDraft = drafts.find((draft) => draft.id === project?.primaryShortId) ?? drafts.find((draft) => draft.primary) ?? drafts[0];
  const alternateDrafts = drafts.filter((draft) => draft.id !== primaryDraft?.id);

  if (!project && ready) {
    notFound();
  }

  if (!ready || !project) {
    return <LoadingBlocks rows={4} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project"
        title={project.title}
        description="This is the new creator-first generation surface: text package, transcript-backed moments, stitched short drafts, previews, and downloads all in one place."
        actions={
          <>
            <Button onClick={() => void renderAllDraftsForProject(project.id)}>Render all drafts</Button>
            <Link href="/library" className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
              Back to library
            </Link>
          </>
        }
      />

      {project.status === "fallback" || project.warning ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-900">Parts of this project used fallback generation</p>
              <p className="mt-1 text-sm text-amber-800">
                {project.warning ?? "One or more AI providers were unavailable. Some content was generated using local templates instead of AI. Check the progress steps below for details."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <Panel className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-ink">Project package</h2>
            <p className="text-sm text-slate-600">OpenRouter and the transcript pipeline feed the creative package that drives the short.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Project status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{project.status}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Primary draft</p>
              <p className="mt-2 text-lg font-semibold text-ink">{primaryDraft?.title ?? "Pending"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Concept angle</p>
            <p className="mt-3 text-sm text-slate-700">{project.textPackage.conceptAngle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.textPackage.hookOptions.map((hook) => (
                <span key={hook} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{hook}</span>
              ))}
            </div>
            {project.warning ? <p className="mt-4 text-sm text-amber-700">{project.warning}</p> : null}
          </div>

          <div className="space-y-3">
            {project.progressSteps.map((step) => (
              <div key={step.id} className={`flex items-center justify-between rounded-2xl border p-4 ${step.status === "fallback" ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}>
                <div>
                  <p className="font-semibold text-ink">{step.label}</p>
                  <p className={`text-sm ${step.status === "fallback" ? "text-amber-700" : "text-slate-600"}`}>
                    {step.status === "fallback" && step.id === "step-text"
                      ? "⚠️ OpenRouter was unavailable. Fallback text templates were used instead of AI-generated content."
                      : step.status === "fallback" && step.id === "step-transcribe"
                        ? "⚠️ Transcription API was unavailable. Simulated transcript data was used — subtitles may not match actual audio."
                        : step.status === "fallback" && step.id === "step-vision"
                          ? "⚠️ Vision AI was unavailable. Moments were detected using keyword matching instead of video analysis."
                          : step.id === "step-transcribe"
                            ? "Audio was transcribed using a hosted speech-to-text service."
                            : step.id === "step-vision"
                              ? "Video content was analyzed by AI to find the strongest visual and audio moments."
                              : "This step is now owned by the in-app generation pipeline."}
                  </p>
                </div>
                <StatusPill label={step.status} />
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-3xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Source videos</p>
              <StatusPill label={`${sourceVideos.length} video${sourceVideos.length === 1 ? "" : "s"}`} />
            </div>
            {sourceVideos.map((video) => (
              <div key={video.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{video.title}</p>
                    <p className="text-sm text-slate-600">{video.description}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{video.duration}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <StatusPill label={video.transcriptStatus} />
                    <StatusPill label={video.analysisStatus} />
                    {video.transcriptSource && video.transcriptSource !== "hosted" ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">⚠️ simulated transcript</span>
                    ) : null}
                  </div>
                </div>
                {video.transcriptPreview ? <p className="mt-3 text-sm text-slate-700">"{video.transcriptPreview}"</p> : null}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Primary short draft</h2>
                <p className="text-sm text-slate-600">The strongest generated cut is surfaced first so you can review, approve, or download fast.</p>
              </div>
              {primaryDraft ? <StatusPill label={primaryDraft.renderStatus ?? "not_started"} /> : null}
            </div>

            {!primaryDraft ? (
              <EmptyState title="No draft created yet" detail="Generate the project again after adding source videos to create a stitched short draft." />
            ) : (
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <p className="font-semibold text-ink">{primaryDraft.title}</p>
                        {primaryDraft.primary ? <StatusPill label="primary" /> : null}
                        {primaryDraft.draftStatus ? <StatusPill label={primaryDraft.draftStatus} /> : null}
                      </div>
                      <p className="text-sm text-slate-700">{primaryDraft.hook}</p>
                      <p className="text-sm text-slate-600">{primaryDraft.caption}</p>
                      <div className="flex flex-wrap gap-2">
                        {primaryDraft.overlayText.map((item) => (
                          <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>Segments: {primaryDraft.shortPlanSegments?.length ?? 0}</p>
                      <p>Subtitles: {primaryDraft.subtitleCues?.length ?? 0}</p>
                      <p>Overlay captions: {primaryDraft.overlayCaptions?.length ?? 0}</p>
                    </div>
                  </div>

                  {primaryDraft.previewUrl ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <video src={primaryDraft.previewUrl} controls className="aspect-[9/16] w-full rounded-2xl bg-black object-contain" />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      Render the draft preview to watch the stitched short inside the app.
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={() => void renderShortDraft(primaryDraft.id)}>
                      {primaryDraft.renderStatus === "ready" ? "Regenerate preview" : "Generate preview"}
                    </Button>
                    <Button variant="secondary" onClick={() => void approveShortDraft(primaryDraft.id)}>
                      Approve draft
                    </Button>
                    <Button variant="ghost" onClick={() => void queueShortForPublishing(primaryDraft.id)}>
                      Send to publishing
                    </Button>
                    <Button variant="ghost" onClick={() => void rejectShortDraft(primaryDraft.id)}>
                      Reject
                    </Button>
                    <Link href={`/shorts/${primaryDraft.id}`} className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                      Open draft detail
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Detected moments</p>
                    <StatusPill label={`${project.detectedMoments.length} moments`} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {project.detectedMoments.map((moment) => (
                      <div key={moment.id} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{moment.label}</p>
                            <p className="text-sm text-slate-600">{moment.reason}</p>
                            <p className="mt-2 text-sm text-slate-700">"{moment.transcriptExcerpt}"</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <StatusPill label={`${moment.score} score`} />
                            <StatusPill label={moment.energy} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Alternate drafts</h2>
                <p className="text-sm text-slate-600">Alternate cuts help you compare different openings or pacing choices without leaving the project.</p>
              </div>
              <StatusPill label={`${alternateDrafts.length} alternates`} />
            </div>
            {alternateDrafts.length === 0 ? (
              <EmptyState title="No alternates yet" detail="The project currently has one primary draft only." />
            ) : (
              <div className="space-y-3">
                {alternateDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{draft.title}</p>
                          {draft.draftStatus ? <StatusPill label={draft.draftStatus} /> : null}
                        </div>
                        <p className="text-sm text-slate-700">{draft.hook}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => void renderShortDraft(draft.id)}>Render</Button>
                        <Button variant="ghost" onClick={() => void updateProject(project.id, { primaryShortId: draft.id })}>Make primary</Button>
                        <Link href={`/shorts/${draft.id}`} className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                          Review
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
