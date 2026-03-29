import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function statusTone(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();

  if (normalized.includes("ready") || normalized.includes("posted") || normalized.includes("connected")) {
    return "bg-fairway/15 text-emerald-700";
  }

  if (normalized.includes("working") || normalized.includes("generating") || normalized.includes("transcribing") || normalized.includes("analyzing")) {
    return "bg-amber-100 text-amber-800";
  }

  if (normalized.includes("editing") || normalized.includes("clip")) {
    return "bg-amber-100 text-amber-800";
  }

  if (normalized.includes("scheduled") || normalized.includes("export")) {
    return "bg-sky-100 text-sky-800";
  }

  if (normalized.includes("fallback")) {
    return "bg-orange-100 text-orange-800";
  }

  if (normalized.includes("failed") || normalized.includes("rejected")) {
    return "bg-rose-100 text-rose-800";
  }

  return "bg-slate-200 text-slate-700";
}
