"use client";

import { useEffect, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProgressBarProps {
  progress: number;
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  progress,
  message,
  className,
  size = "md",
}: ProgressBarProps) {
  // Pulse animation for the progress bar
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const heightClass =
    size === "sm" ? "h-1.5" : size === "md" ? "h-3" : "h-5";

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-ink">
            {message || "Rendering..."}
          </p>
        </div>
        <div className="shrink-0">
          <span className="text-sm font-bold tabular-nums text-fairway">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-slate-100",
          heightClass
        )}
      >
        {/* Animated background gradient */}
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-fairway via-emerald-500 to-fairway transition-all duration-500 ease-out",
            pulse && "opacity-90"
          )}
          style={{ width: `${Math.max(2, progress)}%`, backgroundSize: "200% 100%" }}
        />
        
        {/* Overlay shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>
      
      {progress > 95 && (
        <p className="animate-pulse text-center text-xs font-medium text-slate-500">
          Finalizing video file...
        </p>
      )}
    </div>
  );
}
