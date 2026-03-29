"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ChangeEvent } from "react";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { Button } from "@/components/ui/button";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

export default function ShortDraftPage() {
  const params = useParams<{ id: string }>();
  const ready = usePageReady();
  const { state, updateShortDraft, approveShortDraft, queueShortForPublishing, renderShortDraft } = useMockApp();

  const short = state.editedShorts.find((item) => item.id === params.id);
  const project = state.projects.find((item) => item.id === short?.projectId);

  if (!short && ready) {
    notFound();
  }

  if (!ready || !short) {
    return <LoadingBlocks rows={4} />;
  }

  const updateText = (field: "title" | "hook" | "caption" | "cta" | "musicVibe" | "notes") => async (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    await updateShortDraft(short.id, { [field]: event.target.value });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Short draft"
        title={short.title}
        description="This is the final creator review surface: stitched segments, exact transcript-backed subtitles, funny overlay captions, preview playback, and downloadable export assets."
        actions={
          <>
            <Button variant="secondary" onClick={() => void renderShortDraft(short.id)}>
              {short.renderStatus === "ready" ? "Regenerate preview" : "Generate preview"}
            </Button>
            <Button onClick={() => void approveShortDraft(short.id)}>Approve draft</Button>
            <Button variant="secondary" onClick={() => void queueShortForPublishing(short.id)}>
              Send to publishing
            </Button>
            {project ? (
              <Link href={`/projects/${project.id}`} className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                Back to project
              </Link>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Draft structure</h2>
            <p className="text-sm text-slate-600">The app now builds a real stitched short plan instead of just suggesting one continuous timestamp clip.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Render status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{short.renderStatus ?? "not_started"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Draft status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{short.draftStatus ?? "generated"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Segments used</p>
              <p className="mt-2 text-lg font-semibold text-ink">{short.shortPlanSegments?.length ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Overlay captions</p>
              <p className="mt-2 text-lg font-semibold text-ink">{short.overlayCaptions?.length ?? 0}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Stitched segment plan</p>
            <div className="mt-4 space-y-3">
              {short.shortPlanSegments?.map((segment) => (
                <div key={segment.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{segment.purpose}</p>
                      <p className="text-sm text-slate-600">
                        Source video: {state.sourceVideos.find((video) => video.id === segment.sourceVideoId)?.title ?? segment.sourceVideoId}
                      </p>
                    </div>
                    <StatusPill label={`${segment.start} -> ${segment.end}`} />
                  </div>
                </div>
              )) ?? <p className="text-sm text-slate-600">No stitched plan available yet.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Funny overlay captions</p>
            <div className="mt-4 space-y-2">
              {short.overlayCaptions?.map((caption) => (
                <div key={caption.id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-ink">{caption.start} to {caption.end}</p>
                  <p className="mt-1">{caption.text}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{caption.style} · {caption.color}</p>
                </div>
              )) ?? <p className="text-sm text-slate-600">No overlay captions generated yet.</p>}
            </div>
          </div>
        </Panel>

        <Panel className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-ink">Preview and exports</h2>
            <p className="text-sm text-slate-600">Play the generated MP4 inside the app, then download the draft and sidecar assets for posting or CapCut polish.</p>
          </div>

          {short.previewUrl ? (
            <div className="space-y-3">
              <video src={short.previewUrl} controls className="aspect-[9/16] w-full rounded-[2rem] bg-black object-contain" />
              <div className="flex flex-wrap gap-3">
                <a href={short.previewUrl} download className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                  Download MP4 draft
                </a>
                {short.subtitleFilePath ? (
                  <a href={short.subtitleFilePath} download className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                    Download subtitles
                  </a>
                ) : null}
                {short.captionFilePath ? (
                  <a href={short.captionFilePath} download className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                    Download caption text
                  </a>
                ) : null}
                {short.briefFilePath ? (
                  <a href={short.briefFilePath} download className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                    Download CapCut brief
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
              Generate the preview to create a real MP4 draft with stitched segments, transcript subtitles, and brand-color overlay captions applied.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Title</span>
              <input value={short.title} onChange={updateText("title")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Music vibe</span>
              <input value={short.musicVibe} onChange={updateText("musicVibe")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Hook</span>
            <textarea value={short.hook} onChange={updateText("hook")} rows={3} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Overlay text</span>
              <textarea
                value={short.overlayText.join("\n")}
                onChange={(event) =>
                  void updateShortDraft(short.id, { overlayText: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })
                }
                rows={5}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Hashtags</span>
              <textarea
                value={short.hashtags.join("\n")}
                onChange={(event) =>
                  void updateShortDraft(short.id, { hashtags: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })
                }
                rows={5}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Caption</span>
            <textarea value={short.caption} onChange={updateText("caption")} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">CTA</span>
            <input value={short.cta} onChange={updateText("cta")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Editor notes</span>
            <textarea value={short.notes} onChange={updateText("notes")} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          </label>

          {short.subtitleCues?.length ? (
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Transcript-derived subtitles</p>
              <div className="mt-4 space-y-2">
                {short.subtitleCues.map((cue) => (
                  <div key={cue.id} className="rounded-2xl bg-white p-3 text-sm text-slate-700">
                    <p className="font-semibold text-ink">{cue.start} to {cue.end}</p>
                    <p className="mt-1">{cue.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </section>
    </div>
  );
}
