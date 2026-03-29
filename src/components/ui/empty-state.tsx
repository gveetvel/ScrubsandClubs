import { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <Panel className="border-dashed text-center">
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="text-sm text-slate-600">{detail}</p>
        {action ? <div className="flex justify-center">{action}</div> : null}
      </div>
    </Panel>
  );
}
