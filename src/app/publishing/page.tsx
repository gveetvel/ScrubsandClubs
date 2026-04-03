"use client";

import Link from "next/link";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

export default function PublishingPage() {
  const ready = usePageReady();
  const { state, clearPublishingQueue } = useMockApp();

  if (!ready) {
    return <LoadingBlocks rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publishing"
        title="Rendered exports"
        description="Access your finalized MP4 drafts, subtitles, and social media assets in your local file system."
      />

      <Panel className="space-y-6 py-12 text-center">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 ring-8 ring-slate-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-600"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Open local exports folder</h2>
            <p className="mt-2 text-sm text-slate-600">
              Click the button below to open Windows File Explorer directly to your rendered shorts folder.
              From there, you can drag and drop assets into CapCut, Metricool, or your browser.
            </p>
          </div>
          <Button
            className="w-full py-3 text-base"
            onClick={async () => {
              try {
                await fetch("/api/utils/open-exports", { method: "POST" });
              } catch (error) {
                console.error("Failed to open exports folder:", error);
                alert("Failed to open folder. Check if the server is running on Windows.");
              }
            }}
          >
            Open in File Explorer
          </Button>
          <p className="text-xs text-slate-400">
            Path: <code className="rounded bg-slate-100 px-1 py-0.5">public\rendered-exports</code>
          </p>
        </div>
      </Panel>
    </div>
  );
}
