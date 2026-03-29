"use client";

import { CheckCircle2 } from "lucide-react";
import { useMockApp } from "@/components/providers/mock-app-provider";

export function ToastStack() {
  const { toasts } = useMockApp();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto rounded-2xl border border-emerald-200 bg-white p-4 shadow-panel">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              <p className="text-sm text-slate-600">{toast.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
