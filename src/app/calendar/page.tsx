"use client";

import Link from "next/link";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { usePageReady } from "@/lib/use-page-ready";

export default function CalendarPage() {
  const ready = usePageReady();
  const { state } = useMockApp();

  if (!ready) {
    return <LoadingBlocks rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendar"
        title="Calendar is now optional for MVP"
        description="The core product has shifted to generation and preview first. Scheduling remains secondary, so this page is now just a lightweight reference."
      />

      <Panel className="space-y-4">
        {state.calendarEntries.length === 0 ? (
          <EmptyState title="No scheduled entries" detail="Queue a draft from a project or short detail page to make scheduling useful again." action={<Link href="/publishing" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Open publishing</Link>} />
        ) : (
          <div className="space-y-3">
            {state.calendarEntries.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-slate-600">{item.dayLabel} · {item.date} · {item.platform}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
