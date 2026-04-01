"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, UploadCloud } from "lucide-react";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";
import { GoogleDriveImport } from "@/components/google-drive-import";

interface PendingUpload {
  file: File;
  durationSeconds: number | null;
}

const progressLabels = [
  "Generating text package",
  "Transcribing videos",
  "Finding best moments",
  "Building short plan",
  "Rendering preview"
];

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

export default function CreatePage() {
  const ready = usePageReady();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { state, importLocalUploadPayload, generateProject, loadingPage } = useMockApp();
  const [ideaInput, setIdeaInput] = useState("");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generationStarted, setGenerationStarted] = useState(false);

  const localVideos = useMemo(
    () => [...state.sourceVideos].reverse().filter((video) => video.sourceType === "local_upload" || video.storagePath?.startsWith("/uploads/")),
    [state.sourceVideos]
  );

  const onFilesChosen = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const allowed = Array.from(files).filter((file) => ["video/mp4", "video/quicktime"].includes(file.type));
    if (allowed.length !== files.length) {
      setError("Only MP4 and MOV files are supported.");
    } else {
      setError(null);
    }

    const enriched = await Promise.all(
      allowed.map(async (file) => ({
        file,
        durationSeconds: await readVideoDuration(file)
      }))
    );

    setPendingUploads(enriched);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    await onFilesChosen(event.dataTransfer.files);
  };

  const toggleExistingVideo = (videoId: string) => {
    setSelectedExistingIds((current) => (current.includes(videoId) ? current.filter((id) => id !== videoId) : [...current, videoId]));
  };

  const handleGenerate = async () => {
    const title = ideaInput.trim();
    if (!title) {
      setError("Start with a title or simple idea.");
      return;
    }

    if (pendingUploads.length === 0 && selectedExistingIds.length === 0) {
      setError("Upload at least one video or choose an existing uploaded source video.");
      return;
    }

    setError(null);
    setGenerationStarted(true);

    let sourceVideoIds = [...selectedExistingIds];

    if (pendingUploads.length > 0) {
      const formData = new FormData();
      pendingUploads.forEach((entry) => {
        formData.append("files", entry.file);
        formData.append("durationSeconds", String(entry.durationSeconds ?? ""));
      });

      const uploadResponse = await new Promise<XMLHttpRequest>((resolve) => {
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

      if (!(uploadResponse.status >= 200 && uploadResponse.status < 300)) {
        try {
          const payload = JSON.parse(uploadResponse.responseText) as { error?: string };
          setError(payload.error ?? "Upload failed.");
        } catch {
          setError("Upload failed.");
        }
        setGenerationStarted(false);
        return;
      }

      const payload = JSON.parse(uploadResponse.responseText) as {
        data: { mediaAssets: typeof state.mediaAssets; sourceVideos: typeof state.sourceVideos };
      };
      importLocalUploadPayload({ assets: payload.data.mediaAssets, sourceVideos: payload.data.sourceVideos });
      sourceVideoIds = [...sourceVideoIds, ...payload.data.sourceVideos.map((video) => video.id)];
    }

    const projectId = await generateProject(title, sourceVideoIds);
    if (projectId) {
      router.push(`/projects/${projectId}`);
      return;
    }

    setGenerationStarted(false);
  };

  if (!ready) {
    return <LoadingBlocks rows={4} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Create"
        title="Idea to short draft in one flow"
        description="Start with a title, add one or more local videos, and let the app generate the concept package, transcript-driven moments, stitched short, preview, and download package."
      />

      <Panel className="overflow-hidden bg-ink text-white">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
              {"Create -> Analyze -> Generate -> Preview -> Download"}
            </span>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight">The app is now the first AI short producer, not just a planning board.</h2>
            <p className="max-w-2xl text-sm text-slate-300">
              Enter an idea, upload footage, and generate a stitched short draft with transcript-backed subtitles, funny overlay captions, preview playback, and a downloadable MP4.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/library" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                Open library
              </Link>
              <Link href="/settings" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                Tune brand settings
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-white/8 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">Quick create</p>
            <div className="mt-4 space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white">Title or idea</span>
                <input
                  value={ideaInput}
                  onChange={(event) => setIdeaInput(event.target.value)}
                  placeholder="Example: 2 surgeons try to break 100"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400"
                />
              </label>
              <Button onClick={() => void handleGenerate()}>{loadingPage === "generate-project" ? "Generating..." : "Generate short project"}</Button>
              {error ? <p className="text-sm text-amber-200">{error}</p> : null}
            </div>
          </div>
        </div>
      </Panel>

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
                <h2 className="text-2xl font-semibold text-ink">Add source footage</h2>
                <p className="max-w-2xl text-sm text-slate-600">
                  Upload one or more MP4 or MOV files directly from your computer. The app will analyze them together and can stitch the strongest moments into one short.
                </p>
              </div>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose files
              </Button>
            </div>
          </div>

          <GoogleDriveImport onImportComplete={(_url, _name, sourceVideo) => {
            importLocalUploadPayload({ assets: [], sourceVideos: [sourceVideo] });
            setSelectedExistingIds(curr => [...curr, sourceVideo.id]);
          }} />

          {pendingUploads.length === 0 ? (
            <EmptyState title="No new uploads queued" detail="Drag files here or pick them from your computer to build a new short project." />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-ink">Upload batch</h3>
                  <p className="text-sm text-slate-600">These files will be uploaded and immediately analyzed inside the new project.</p>
                </div>
                {uploadProgress > 0 && generationStarted ? <StatusPill label={`Upload ${uploadProgress}%`} /> : null}
              </div>
              {pendingUploads.map((entry) => (
                <div key={`${entry.file.name}-${entry.file.size}`} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-ink">{entry.file.name}</p>
                  <p className="text-sm text-slate-500">
                    {formatBytes(entry.file.size)} · {entry.durationSeconds ? `${Math.round(entry.durationSeconds)} sec` : "Duration pending"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">Use existing uploads</h2>
              <p className="text-sm text-slate-600">You can also generate a project from videos that are already in the library.</p>
            </div>
            <Sparkles className="h-5 w-5 text-fairway" />
          </div>

          {localVideos.length === 0 ? (
            <EmptyState title="No uploaded videos yet" detail="Upload a local MP4 or MOV above, or open the library to add source footage first." />
          ) : (
            <div className="space-y-3">
              {localVideos.slice(0, 6).map((video) => (
                <button
                  key={video.id}
                  onClick={() => toggleExistingVideo(video.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedExistingIds.includes(video.id) ? "border-fairway bg-fairway/10" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{video.title}</p>
                      <p className="text-sm text-slate-600">{video.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{video.duration} · {formatBytes(video.sizeBytes)}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {video.projectId ? <StatusPill label="in project" /> : <StatusPill label="available" />}
                      {video.transcriptStatus ? <StatusPill label={video.transcriptStatus} /> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Generation pipeline</p>
            <div className="mt-4 space-y-3">
              {progressLabels.map((label, index) => {
                const active = generationStarted && (loadingPage === "generate-project" ? index < 4 : false);
                return (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white p-3">
                    <p className="text-sm font-medium text-ink">{label}</p>
                    <StatusPill label={generationStarted ? (index === progressLabels.length - 1 && loadingPage === "generate-project" ? "working" : active ? "working" : "pending") : "pending"} />
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
