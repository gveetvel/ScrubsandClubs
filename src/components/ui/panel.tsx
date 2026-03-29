import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return <div className={cn("rounded-3xl border border-white/60 bg-white/90 p-6 shadow-panel", className)}>{children}</div>;
}
