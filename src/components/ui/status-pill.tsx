import { cn, statusTone } from "@/lib/utils";

interface StatusPillProps {
  label?: string | null;
  className?: string;
}

export function StatusPill({ label, className }: StatusPillProps) {
  const resolvedLabel = (label ?? "unknown").trim() || "unknown";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-wide",
        statusTone(resolvedLabel),
        className
      )}
    >
      {resolvedLabel}
    </span>
  );
}
