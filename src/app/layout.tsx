import type { Metadata } from "next";
import { ClientErrorBoundary } from "@/components/providers/client-error-boundary";
import { MockAppProvider } from "@/components/providers/mock-app-provider";
import { PageFrame } from "@/components/shell/page-frame";
import { ToastStack } from "@/components/ui/toast-stack";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrubs & Clubs Studio",
  description: "AI-assisted short-form video production app for a golf creator workflow."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClientErrorBoundary>
          <MockAppProvider>
            <PageFrame>{children}</PageFrame>
            <ToastStack />
          </MockAppProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
