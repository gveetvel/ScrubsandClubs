"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

interface PendingUpload {
  file: File;
  durationSeconds: number | null;
}

async function readVideoDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

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

export default function LibraryPage() {
  const ready = usePageReady();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { state, importLocalUploadPayload } = useMockApp();
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showProjectsOnly, setShowProjectsOnly] = useState(false);

  const localVideos = useMemo(
    () => state.sourceVideos.filter((video) => (showProjectsOnly ? Boolean(video.projectId) : true)),
    [showProjectsOnly, state.sourceVideos]
  );

  const onFilesChosen = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const allowed = Array.from(files).filter((file) => ["video/mp4", "video/quicktime"].includes(file.type));
    if (allowed.length !== files.length) {
      setUploadError("Only MP4 and MOV files are supported for MVP uploads.");
    } else {
      setUploadError(null);
    }

    const enriched = await Promise.all(
      allowed.map(async (file) => ({
        file,
        durationSeconds: await readVideoDuration(file)
      }))
    );

    setPendingUploads(enriched);
    setUploadSuccess(null);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    await onFilesChosen(event.dataTransfer.files);
  };

  const uploadFiles = async () => {
    if (pendingUploads.length === 0) {
      setUploadError("Choose at least one MP4 or MOV file before uploading.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    const formData = new FormData();
    pendingUploads.forEach((entry) => {
      formData.append("files", entry.file);
      formData.append("durationSeconds", String(entry.durationSeconds ?? ""));
    });

    const response = await new Promise<XMLHttpRequest>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => resolve(xhr);
      xhr.onerror = () => resolve(xhr);
      xhr.send(formData);
    });

    setIsUploading(false);

    if (response.status >= 200 && response.status < 300) {
      const payload = JSON.parse(response.responseText) as {
        data: { mediaAssets: typeof state.mediaAssets; sourceVideos: typeof state.sourceVideos };
      };
      importLocalUploadPayload({ assets: payload.data.mediaAssets, sourceVideos: payload.data.sourceVideos });
      setPendingUploads([]);
      setUploadProgress(0);
      setUploadSuccess(`${payload.data.sourceVideos.length} video file(s) uploaded. Start a new project from the Create page when you are ready.`);
      return;
    }

    try {
      const payload = JSON.parse(response.responseText) as { error?: string };
      setUploadError(payload.error ?? "Upload failed.");
    } catch {
      setUploadError("Upload failed.");
    }
  };

  if (!ready) {
    return <LoadingBlocks rows={4} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Projects and uploaded footage"
        description="The library now stays simple: upload source videos, review which projects they belong to, and jump back into generation or preview."
        actions={
          <>
            <Button onClick={() => fileInputRef.current?.click()}>Upload videos</Button>
            <Link href="/" className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
              Start new project
            </Link>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_0.92fr]">
        <Panel className="space-y-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-[2rem] border-2 border-dashed p-8 transition ${dragActive ? "border-fairway bg-fairway/10" : "border-slate-300 bg-slate-50"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime"
              multiple
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => void onFilesChosen(event.target.files)}
            />
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <UploadCloud className="h-10 w-10 text-fairway" />
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-ink">Upload source videos</h2>
                <p className="max-w-2xl text-sm text-slate-600">
                  Local upload is still the default ingestion path. Bring footage in here, then open the Create page to turn it into a transcript-backed stitched short.
                </p>
              </div>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose files
              </Button>
            </div>
          </div>

          {pendingUploads.length === 0 ? (
            <EmptyState title="No upload batch selected" detail="Choose a few MP4 or MOV files to add them to the source library." />
          ) : (
            <div className="space-y-3">
              {pendingUploads.map((entry) => (
                <div key={`${entry.file.name}-${entry.file.size}`} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-ink">{entry.file.name}</p>
                  <p className="text-sm text-slate-500">
                    {formatBytes(entry.file.size)} · {entry.durationSeconds ? `${Math.round(entry.durationSeconds)} sec` : "Duration pending"}
                  </p>
                </div>
              ))}
              {isUploading ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink">Uploading... {uploadProgress}%</p>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full bg-fairway transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : null}
              {uploadError ? <p className="text-sm text-amber-700">{uploadError}</p> : null}
              {uploadSuccess ? <p className="text-sm text-emerald-700">{uploadSuccess}</p> : null}
              <Button onClick={() => void uploadFiles()} disabled={isUploading || pendingUploads.length === 0}>
                Upload to library
              </Button>
            </div>
          )}
        </Panel>

        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Recent projects</h2>
              <p className="text-sm text-slate-600">These are the projects already generated by the new simplified flow.</p>
            </div>
            <StatusPill label={`${state.projects.length} projects`} />
          </div>
          {state.projects.length === 0 ? (
            <EmptyState title="No projects yet" detail="Create your first short project from the home page." />
          ) : (
            <div className="space-y-3">
              {state.projects.map((project) => {
                const primaryDraft = state.editedShorts.find((draft) => draft.id === project.primaryShortId);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{project.title}</p>
                        <p className="text-sm text-slate-600">{project.summary}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{project.sourceVideoIds.length} source videos · {project.shortDraftIds.length} drafts</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <StatusPill label={project.status} />
                        {primaryDraft?.renderStatus ? <StatusPill label={primaryDraft.renderStatus} /> : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      <Panel className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Source videos</h2>
            <p className="text-sm text-slate-600">Uploaded videos remain visible individually, but the main workflow now happens at the project level.</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm">
            <input type="checkbox" checked={showProjectsOnly} onChange={(event) => setShowProjectsOnly(event.target.checked)} />
            Only show videos in projects
          </label>
        </div>

        {localVideos.length === 0 ? (
          <EmptyState title="No source videos yet" detail="Upload videos above or use the Create page to start generating from footage." />
        ) : (
          <div className="space-y-3">
            {localVideos.map((video) => {
              const project = state.projects.find((item) => item.id === video.projectId);
              return (
                <Link key={video.id} href={project ? `/projects/${project.id}` : `/videos/${video.id}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{video.title}</p>
                      <p className="text-sm text-slate-600">{video.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        {video.duration} · {formatBytes(video.sizeBytes)} · {video.mimeType ?? "video"}
                      </p>
                      {project ? <p className="mt-2 text-sm text-emerald-700">Project: {project.title}</p> : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      {video.projectId ? <StatusPill label="in project" /> : <StatusPill label="available" />}
                      <StatusPill label={video.transcriptStatus} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
