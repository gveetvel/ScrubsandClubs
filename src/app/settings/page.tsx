"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useMockApp } from "@/components/providers/mock-app-provider";
import { Button } from "@/components/ui/button";
import { LoadingBlocks } from "@/components/ui/loading-blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { usePageReady } from "@/lib/use-page-ready";

const renderNotes = [
  "Local uploads are still the default source video workflow.",
  "Source files are stored in public/uploads for local development.",
  "Rendered drafts and exports are stored in public/rendered-exports.",
  "Hosted speech-to-text is the preferred subtitle pipeline; fallback transcript simulation remains available.",
  "CapCut is optional finishing, not a dependency for draft generation."
];

export default function SettingsPage() {
  const ready = usePageReady();
  const { state, saveBrandSettings } = useMockApp();
  const [draftSettings, setDraftSettings] = useState(state.brandSettings);

  useEffect(() => {
    setDraftSettings(state.brandSettings);
  }, [state.brandSettings]);

  const handleField =
    (field: "overlayCaptionColor" | "subtitlePreset" | "hookStylePreset" | "tonePreset") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraftSettings((current) => ({ ...current, [field]: event.target.value }));
    };

  if (!ready) {
    return <LoadingBlocks rows={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Brand styling and provider setup"
        description="The app now centers on local uploads, hosted transcription when configured, OpenRouter for language generation, and in-app short rendering."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_0.92fr]">
        <Panel className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Brand style defaults</h2>
            <p className="text-sm text-slate-600">These settings feed the short-generation and render pipeline directly.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Funny caption color</span>
              <input value={draftSettings.overlayCaptionColor} onChange={handleField("overlayCaptionColor")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Subtitle preset</span>
              <input value={draftSettings.subtitlePreset} onChange={handleField("subtitlePreset")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Hook style preset</span>
              <input value={draftSettings.hookStylePreset} onChange={handleField("hookStylePreset")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ink">Tone preset</span>
              <input value={draftSettings.tonePreset} onChange={handleField("tonePreset")} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Default platform</span>
            <select
              value={draftSettings.platformPreset}
              onChange={(event) =>
                setDraftSettings((current) => ({
                  ...current,
                  platformPreset: event.target.value as "YouTube Shorts" | "Instagram Reels" | "TikTok"
                }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="YouTube Shorts">YouTube Shorts</option>
              <option value="Instagram Reels">Instagram Reels</option>
              <option value="TikTok">TikTok</option>
            </select>
          </label>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Current render stack</p>
            <div className="mt-4 space-y-3">
              {renderNotes.map((note) => (
                <div key={note} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Providers and handoffs</h2>
            <p className="text-sm text-slate-600">These integrations are now scoped to what the simplified product actually needs.</p>
          </div>

          <div className="space-y-3">
            {state.integrations.map((integration) => (
              <div key={integration.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="font-semibold text-ink">{integration.name}</p>
                    <p className="text-sm text-slate-600">{integration.summary}</p>
                    <p className="text-sm text-slate-500">{integration.nextStep}</p>
                  </div>
                  <StatusPill label={integration.status} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Environment variables to configure</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold text-ink">OpenRouter:</span> OPENROUTER_API_KEY, OPENROUTER_MODEL</p>
              <p><span className="font-semibold text-ink">Hosted STT:</span> OPENAI_API_KEY, OPENAI_TRANSCRIPTION_MODEL</p>
              <p><span className="font-semibold text-ink">Uploads:</span> LOCAL_UPLOAD_MAX_MB</p>
              <p><span className="font-semibold text-ink">Optional future:</span> CAPCUT_API_KEY, METRICOOL_API_KEY</p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Save behavior</p>
            <p className="mt-3 text-sm text-slate-700">
              Save once you like the settings. They will be used for new project generation, overlay caption rendering, and default platform packaging.
            </p>
            <Button className="mt-4" onClick={() => void saveBrandSettings(draftSettings)}>
              Save settings
            </Button>
          </div>
        </Panel>
      </section>
    </div>
  );
}
