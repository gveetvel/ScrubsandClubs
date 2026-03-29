"use client";

import Link from "next/link";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

export default function IdeasPage() {
  const ready = usePageReady();
  const { state } = useMockApp();

  if (!ready) {
    return <LoadingBlocks rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ideas"
        title="Idea records now start on the Create page"
        description="This page remains as a lightweight archive, but the primary workflow has been simplified into one create-and-generate flow."
      />

      <Panel className="space-y-4">
        {state.projects.length === 0 ? (
          <EmptyState title="No project ideas yet" detail="Start from the Create page with a title or one-sentence idea." action={<Link href="/" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Open Create</Link>} />
        ) : (
          <div className="space-y-3">
            {state.projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{project.title}</p>
                    <p className="text-sm text-slate-600">{project.textPackage.conceptAngle}</p>
                    <p className="mt-2 text-sm text-slate-700">Primary hook: {project.textPackage.hookOptions[0]}</p>
                  </div>
                  <StatusPill label={project.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
