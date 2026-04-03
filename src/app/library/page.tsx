"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

export default function LibraryPage() {
  const ready = usePageReady();
  const { state, deleteProject } = useMockApp();

  if (!ready) {
    return <LoadingBlocks rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Project Management"
        description="View and manage your active short projects. Raw source video management is handled automatically during project creation."
      />

      <section className="grid gap-4">
        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Recent projects</h2>
              <p className="text-sm text-slate-600">
                These are your transcript-backed short projects. Open one to continue editing or previewing.
              </p>
            </div>
            <StatusPill label={`${state.projects.length} projects`} />
          </div>
          {state.projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              detail="Create your first short project from the home page."
            />
          ) : (
            <div className="space-y-3">
              {state.projects.map((project) => {
                const primaryDraft = state.editedShorts.find(
                  (draft) => draft.id === project.primaryShortId
                );
                return (
                  <div key={project.id} className="relative">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block rounded-2xl border border-slate-200 p-4 pr-12 transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{project.title}</p>
                          <p className="text-sm text-slate-600">{project.summary}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                            {project.sourceVideoIds.length} source videos ·{" "}
                            {project.shortDraftIds.length} drafts
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <StatusPill label={project.status} />
                          {primaryDraft?.renderStatus ? (
                            <StatusPill label={primaryDraft.renderStatus} />
                          ) : null}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${project.title}"? This cannot be undone.`)) {
                          void deleteProject(project.id);
                        }
                      }}
                      className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
