import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCardLink({ href, title, description, meta, children, className }: { href: string; title: string; description: string; meta?: string; children?: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-fairway/40 hover:bg-white", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
          {meta ? <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{meta}</p> : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </Link>
  );
}
