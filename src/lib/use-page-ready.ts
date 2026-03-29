"use client";

import { useEffect, useState } from "react";

export function usePageReady(delay = 250) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return ready;
}
