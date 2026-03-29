"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <AppShell currentPath={pathname}>{children}</AppShell>;
}
