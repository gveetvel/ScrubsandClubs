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
        title="Secondary handoff queue"
        description="Publishing is still available, but it now sits after the core Create -> Preview -> Download flow instead of driving the whole product."
        actions={<Button variant="secondary" onClick={() => void clearPublishingQueue()}>Clear queue</Button>}
      />

      <Panel className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Ready for handoff</h2>
            <p className="text-sm text-slate-600">Approved drafts can be parked here with their caption and hashtag packages.</p>
          </div>
          <StatusPill label={`${state.publishingQueue.length} queued`} />
        </div>

        {state.publishingQueue.length === 0 ? (
          <EmptyState
            title="No drafts queued"
            detail="Approve or queue a generated short from a project or short detail page to see it here."
            action={<Link href="/" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Create a new project</Link>}
          />
        ) : (
          <div className="space-y-3">
            {state.publishingQueue.map((item) => {
              const short = state.editedShorts.find((entry) => entry.id === item.shortId);
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <p className="font-semibold text-ink">{item.shortTitle}</p>
                        <StatusPill label={item.platform} />
                        {short?.draftStatus ? <StatusPill label={short.draftStatus} /> : null}
                      </div>
                      <p className="text-sm text-slate-700">{item.hook}</p>
                      <p className="text-sm text-slate-600">{item.caption}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.hashtags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>Scheduled: {item.scheduledDate}</p>
                      <p>Music vibe: {item.musicVibe}</p>
                      <p>Ready for Metricool: {item.readyForMetricool ? "Yes" : "No"}</p>
                      {short ? (
                        <Link href={`/shorts/${short.id}`} className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink">
                          Open draft
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
