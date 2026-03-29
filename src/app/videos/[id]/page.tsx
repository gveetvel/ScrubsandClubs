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

function formatBytes(size?: number) {
  if (!size) {
    return "Unknown size";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const ready = usePageReady();
  const { state } = useMockApp();

  const video = state.sourceVideos.find((item) => item.id === params.id);
  const project = state.projects.find((item) => item.id === video?.projectId);
  const relatedDrafts = useMemo(
    () => state.editedShorts.filter((draft) => draft.sourceVideoIds?.includes(params.id) || draft.sourceVideoId === params.id),
    [params.id, state.editedShorts]
  );
  const asset = state.mediaAssets.find((item) => item.id === video?.assetId);

  if (!video && ready) {
    notFound();
  }

  if (!ready || !video) {
    return <LoadingBlocks rows={4} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Source video"
        title={video.title}
        description="This page is now a focused source view. The main generation workflow lives on the project page, where the app stitches moments into full short drafts."
        actions={
          <>
            {project ? (
              <Link href={`/projects/${project.id}`} className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                Open project
              </Link>
            ) : (
              <Link href="/" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                Create project from this
              </Link>
            )}
            <Link href="/library" className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
              Back to library
            </Link>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Upload status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{video.uploadStatus ?? "uploaded"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Transcript status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{video.transcriptStatus}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Analysis status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{video.analysisStatus}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">File size</p>
              <p className="mt-2 text-lg font-semibold text-ink">{formatBytes(video.sizeBytes)}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">File metadata</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold text-ink">Filename:</span> {asset?.filename ?? "Unknown"}</p>
              <p><span className="font-semibold text-ink">Duration:</span> {video.duration}</p>
              <p><span className="font-semibold text-ink">Storage path:</span> {video.storagePath ?? asset?.storagePath ?? "Seeded sample"}</p>
              <p><span className="font-semibold text-ink">Project:</span> {project?.title ?? "Not assigned yet"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Transcript preview</p>
            {video.transcriptSegments?.length ? (
              <div className="mt-4 space-y-2">
                {video.transcriptSegments.map((segment) => (
                  <div key={segment.id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-ink">{segment.start} to {segment.end}</p>
                    <p className="mt-1">{segment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No transcript yet" detail="Create or reopen the project to generate transcript-backed moments and stitched drafts." />
            )}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Related drafts</h2>
              <p className="text-sm text-slate-600">Source videos can now feed multiple stitched short drafts inside a project.</p>
            </div>
            <StatusPill label={`${relatedDrafts.length} drafts`} />
          </div>

          {relatedDrafts.length === 0 ? (
            <EmptyState title="No drafts yet" detail="Generate a project from this source video to create stitched short drafts." action={<Link href="/" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Start from create page</Link>} />
          ) : (
            <div className="space-y-3">
              {relatedDrafts.map((draft) => (
                <div key={draft.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <p className="font-semibold text-ink">{draft.title}</p>
                        {draft.primary ? <StatusPill label="primary" /> : null}
                        {draft.renderStatus ? <StatusPill label={draft.renderStatus} /> : null}
                      </div>
                      <p className="text-sm text-slate-700">{draft.hook}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/shorts/${draft.id}`} className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                        Open draft
                      </Link>
                      {project ? (
                        <Link href={`/projects/${project.id}`} className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                          Open project
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
