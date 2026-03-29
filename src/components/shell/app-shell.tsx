import Link from "next/link";
import { Home, LibraryBig, Send, Settings } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Create", icon: Home },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/publishing", label: "Publishing", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings }
];

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
}

export function AppShell({ children, currentPath }: AppShellProps) {
  return (
    <div className="min-h-screen bg-moss/40 bg-grain">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="w-full rounded-[2rem] border border-white/70 bg-ink px-5 py-6 text-white shadow-panel lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72">
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">Scrubs & Clubs</p>
            <div>
              <h1 className="text-2xl font-bold">Studio</h1>
              <p className="mt-2 text-sm text-slate-300">Idea to uploaded footage to stitched short preview, without the creator-tool bloat.</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = currentPath === href;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    active ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl bg-white/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">Workflow</p>
            <p className="mt-3 text-sm text-slate-200">Primary flow: Create, upload, generate, preview, download. Publishing stays available when you need it.</p>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden rounded-[2rem] border border-white/70 bg-white/60 p-4 shadow-panel backdrop-blur lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
