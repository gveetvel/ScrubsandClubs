"use client";

import Link from "next/link";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

export default function ClipsPage() {
  const ready = usePageReady();
  const { state } = useMockApp();

  if (!ready) {
    return <LoadingBlocks rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Drafts"
        title="Short drafts replaced the old clip-review board"
        description="The simplified product now focuses on stitched short drafts rather than making the creator bounce through a separate clip board first."
      />

      <Panel className="space-y-4">
        {state.editedShorts.length === 0 ? (
          <EmptyState title="No drafts yet" detail="Generate a project from the Create page to populate this archive." action={<Link href="/" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Open Create</Link>} />
        ) : (
          <div className="space-y-3">
            {state.editedShorts.map((draft) => (
              <Link key={draft.id} href={`/shorts/${draft.id}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <p className="font-semibold text-ink">{draft.title}</p>
                      {draft.primary ? <StatusPill label="primary" /> : null}
                    </div>
                    <p className="text-sm text-slate-600">{draft.hook}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{draft.shortPlanSegments?.length ?? 0} segments · {draft.subtitleCues?.length ?? 0} subtitle cues</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <StatusPill label={draft.renderStatus ?? "not_started"} />
                    {draft.draftStatus ? <StatusPill label={draft.draftStatus} /> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
