"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { initialAppState } from "@/lib/data/mock-data";
import { AppState, BrandStyleSettings, EditedShort, Project, ProgressStepStatus, PublishingItem, ToastMessage } from "@/lib/types";

interface MockAppContextValue {
  state: AppState;
  toasts: ToastMessage[];
  loadingPage: string | null;
  setLoadingPage: (page: string | null) => void;
  importLocalUploadPayload: (payload: { assets: AppState["mediaAssets"]; sourceVideos: AppState["sourceVideos"] }) => void;
  generateProject: (title: string, sourceVideoIds: string[], onStepUpdate?: (stepId: string, status: ProgressStepStatus) => void) => Promise<string | null>;
  renderShortDraft: (shortId: string) => Promise<void>;
  renderAllDraftsForProject: (projectId: string) => Promise<void>;
  updateShortDraft: (
    shortId: string,
    patch: Partial<Pick<EditedShort, "title" | "hook" | "caption" | "cta" | "musicVibe" | "notes" | "packageStatus" | "overlayText" | "hashtags" | "overlayCaptions">>
  ) => Promise<void>;
  approveShortDraft: (shortId: string) => Promise<void>;
  rejectShortDraft: (shortId: string) => Promise<void>;
  queueShortForPublishing: (shortId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, patch: Partial<Project>) => Promise<void>;
  saveBrandSettings: (patch: Partial<BrandStyleSettings>) => Promise<void>;
  clearPublishingQueue: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const MockAppContext = createContext<MockAppContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, { ...(map.get(item.id) ?? {}), ...item });
  }
  return Array.from(map.values());
}

function mergeState(current: AppState, patch: Partial<AppState>) {
  return {
    ...current,
    brandSettings: patch.brandSettings ?? current.brandSettings,
    projects: patch.projects ? mergeById(current.projects, patch.projects) : current.projects,
    mediaAssets: patch.mediaAssets ? mergeById(current.mediaAssets, patch.mediaAssets) : current.mediaAssets,
    sourceVideos: patch.sourceVideos ? mergeById(current.sourceVideos, patch.sourceVideos) : current.sourceVideos,
    editedShorts: patch.editedShorts ? mergeById(current.editedShorts, patch.editedShorts) : current.editedShorts,
    publishingQueue: patch.publishingQueue ? mergeById(current.publishingQueue, patch.publishingQueue) : current.publishingQueue,
    integrations: patch.integrations ? mergeById(current.integrations, patch.integrations) : current.integrations,
    ideas: patch.ideas ? mergeById(current.ideas, patch.ideas) : current.ideas,
    clipSuggestions: patch.clipSuggestions ? mergeById(current.clipSuggestions, patch.clipSuggestions) : current.clipSuggestions,
    calendarEntries: patch.calendarEntries ? mergeById(current.calendarEntries, patch.calendarEntries) : current.calendarEntries
  } satisfies AppState;
}

export function MockAppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loadingPage, setLoadingPage] = useState<string | null>(null);

  const pushToast = (title: string, detail: string) => {
    const id = makeId("toast");
    setToasts((current) => [...current, { id, title, detail }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2800);
  };

  const refreshState = async () => {
    const [uploadsResponse, projectsResponse, rendersResponse] = await Promise.all([
      fetch("/api/uploads", { cache: "no-store" }).catch(() => null),
      fetch("/api/projects", { cache: "no-store" }).catch(() => null),
      fetch("/api/renders/short-drafts", { cache: "no-store" }).catch(() => null)
    ]);

    let nextState = initialAppState;

    if (uploadsResponse?.ok) {
      const payload = (await uploadsResponse.json()) as { data?: { mediaAssets?: AppState["mediaAssets"]; sourceVideos?: AppState["sourceVideos"] } };
      if (payload.data) {
        nextState = mergeState(nextState, {
          mediaAssets: payload.data.mediaAssets ?? [],
          sourceVideos: payload.data.sourceVideos ?? []
        });
      }
    }

    if (projectsResponse?.ok) {
      const payload = (await projectsResponse.json()) as {
        data?: {
          settings?: BrandStyleSettings;
          projects?: AppState["projects"];
          editedShorts?: AppState["editedShorts"];
          publishingQueue?: AppState["publishingQueue"];
        };
      };
      if (payload.data) {
        nextState = mergeState(nextState, {
          brandSettings: payload.data.settings,
          projects: payload.data.projects ?? [],
          editedShorts: payload.data.editedShorts ?? [],
          publishingQueue: payload.data.publishingQueue ?? []
        });
      }
    }

    if (rendersResponse?.ok) {
      const payload = (await rendersResponse.json()) as { data?: Array<Partial<EditedShort> & { id: string }> };
      if (payload.data?.length) {
        nextState = mergeState(nextState, { editedShorts: payload.data as EditedShort[] });
      }
    }

    setState(nextState);
  };

  useEffect(() => {
    void refreshState();
  }, []);

  const importLocalUploadPayload = (payload: { assets: AppState["mediaAssets"]; sourceVideos: AppState["sourceVideos"] }) => {
    setState((current) =>
      mergeState(current, {
        mediaAssets: payload.assets,
        sourceVideos: payload.sourceVideos
      })
    );
    pushToast("Upload complete", `${payload.sourceVideos.length} source video${payload.sourceVideos.length === 1 ? "" : "s"} uploaded.`);
  };

  const generateProject = async (title: string, sourceVideoIds: string[], onStepUpdate?: (stepId: string, status: ProgressStepStatus) => void) => {
    setLoadingPage("generate-project");

    try {
      const response = await fetch("/api/projects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceVideoIds })
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to generate the project.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let projectId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as { type: string; stepId?: string; status?: ProgressStepStatus; projectId?: string; project?: Project; shortDrafts?: EditedShort[]; message?: string };
          if (event.type === "step" && event.stepId && event.status) {
            onStepUpdate?.(event.stepId, event.status);
          } else if (event.type === "done" && event.project && event.shortDrafts) {
            projectId = event.projectId ?? null;
            setState((current) => mergeState(current, {
              projects: [event.project!],
              editedShorts: event.shortDrafts!
            }));
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Generation failed.");
          }
        }
      }

      pushToast("Short generation complete", "Your project now has a text package, detected moments, and draft previews ready to review.");
      return projectId;
    } catch (error) {
      pushToast("Generation failed", error instanceof Error ? error.message : "Failed to generate the project.");
      return null;
    } finally {
      setLoadingPage(null);
    }
  };

  const renderShortDraft = async (shortId: string) => {
    setState((current) => ({
      ...current,
      editedShorts: current.editedShorts.map((item) =>
        item.id === shortId ? { ...item, renderStatus: "rendering", renderProgress: 0, renderMessage: "Preparing...", renderError: undefined } : item
      )
    }));

    try {
      const response = await fetch("/api/renders/short-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortId })
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to render short draft.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as { type: string; message?: string; percent?: number; data?: EditedShort };

          if (event.type === "progress") {
            setState((current) => ({
              ...current,
              editedShorts: current.editedShorts.map((item) =>
                item.id === shortId ? { ...item, renderProgress: event.percent, renderMessage: event.message } : item
              )
            }));
          } else if (event.type === "done" && event.data) {
            setState((current) => mergeState(current, { editedShorts: [event.data as EditedShort] }));
            pushToast("Draft render ready", "The stitched short preview is now ready to watch and download.");
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Render failed.");
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to render short draft.";
      setState((current) => ({
        ...current,
        editedShorts: current.editedShorts.map((item) => (item.id === shortId ? { ...item, renderStatus: "failed", renderError: message } : item))
      }));
      pushToast("Render failed", message);
    }
  };

  const renderAllDraftsForProject = async (projectId: string) => {
    const drafts = state.editedShorts.filter((item) => item.projectId === projectId);
    for (const draft of drafts) {
      // eslint-disable-next-line no-await-in-loop
      await renderShortDraft(draft.id);
    }
  };

  const updateShortDraft = async (
    shortId: string,
    patch: Partial<Pick<EditedShort, "title" | "hook" | "caption" | "cta" | "musicVibe" | "notes" | "packageStatus" | "overlayText" | "hashtags" | "overlayCaptions">>
  ) => {
    setState((current) => ({
      ...current,
      editedShorts: current.editedShorts.map((item) => (item.id === shortId ? { ...item, ...patch } : item))
    }));

    await fetch(`/api/shorts/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }).catch(() => undefined);
  };

  const approveShortDraft = async (shortId: string) => {
    await updateShortDraft(shortId, { packageStatus: "customized" });
    setState((current) => ({
      ...current,
      editedShorts: current.editedShorts.map((item) =>
        item.id === shortId ? { ...item, draftStatus: "approved", status: "ready to post", readyForMetricool: true } : item
      )
    }));
    await fetch(`/api/shorts/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftStatus: "approved", status: "ready to post", readyForMetricool: true, packageStatus: "customized" })
    }).catch(() => undefined);
    pushToast("Draft approved", "The short draft is now marked ready for publishing.");
  };

  const rejectShortDraft = async (shortId: string) => {
    setState((current) => ({
      ...current,
      editedShorts: current.editedShorts.map((item) =>
        item.id === shortId ? { ...item, draftStatus: "rejected", status: "editing" } : item
      )
    }));
    await fetch(`/api/shorts/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftStatus: "rejected" })
    }).catch(() => undefined);
    pushToast("Draft rejected", "The short draft stays available but is marked out of the active shortlist.");
  };

  const queueShortForPublishing = async (shortId: string) => {
    const short = state.editedShorts.find((item) => item.id === shortId);
    if (!short) {
      return;
    }

    const existing = state.publishingQueue.find((item) => item.shortId === shortId && item.platform === state.brandSettings.platformPreset);
    if (existing) {
      pushToast("Already queued", "That short is already in the publishing queue.");
      return;
    }

    const item: PublishingItem = {
      id: makeId("pub"),
      shortId,
      projectId: short.projectId,
      shortTitle: short.title,
      platform: state.brandSettings.platformPreset,
      scheduledDate: "2026-04-02 18:30",
      hook: short.hook,
      caption: short.caption,
      cta: short.cta,
      hashtags: short.hashtags,
      overlayText: short.overlayText,
      musicVibe: short.musicVibe,
      readyForMetricool: true,
      previewUrl: short.previewUrl
    };

    setState((current) => ({
      ...current,
      publishingQueue: [item, ...current.publishingQueue],
      editedShorts: current.editedShorts.map((entry) =>
        entry.id === shortId ? { ...entry, draftStatus: "queued", status: "scheduled", readyForMetricool: true, packageStatus: "queued" } : entry
      )
    }));

    await fetch("/api/publishing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    }).catch(() => undefined);
    await fetch(`/api/shorts/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftStatus: "queued", status: "scheduled", readyForMetricool: true, packageStatus: "queued" })
    }).catch(() => undefined);
    pushToast("Queued for publishing", "The draft is now ready for publishing handoff.");
  };

  const deleteProject = async (projectId: string) => {
    setState((current) => ({
      ...current,
      projects: current.projects.filter((p) => p.id !== projectId),
      editedShorts: current.editedShorts.filter((s) => s.projectId !== projectId)
    }));
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" }).catch(() => undefined);
    pushToast("Project deleted", "The project and its drafts have been removed.");
  };

  const updateProject = async (projectId: string, patch: Partial<Project>) => {
    setState((current) => ({
      ...current,
      projects: current.projects.map((project) => (project.id === projectId ? { ...project, ...patch } : project))
    }));

    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }).catch(() => undefined);
  };

  const saveBrandSettings = async (patch: Partial<BrandStyleSettings>) => {
    setState((current) => ({
      ...current,
      brandSettings: {
        ...current.brandSettings,
        ...patch
      }
    }));

    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }).catch(() => undefined);
    pushToast("Settings saved", "Brand styling and workflow defaults were updated.");
  };

  const clearPublishingQueue = async () => {
    setState((current) => ({ ...current, publishingQueue: [] }));
    await fetch("/api/publishing", { method: "DELETE" }).catch(() => undefined);
    pushToast("Queue cleared", "The publishing queue is now empty.");
  };

  const value = useMemo(
    () => ({
      state,
      toasts,
      loadingPage,
      setLoadingPage,
      importLocalUploadPayload,
      generateProject,
      deleteProject,
      renderShortDraft,
      renderAllDraftsForProject,
      updateShortDraft,
      approveShortDraft,
      rejectShortDraft,
      queueShortForPublishing,
      updateProject,
      saveBrandSettings,
      clearPublishingQueue,
      refreshState
    }),
    [loadingPage, state, toasts]
  );

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>;
}

export function useMockApp() {
  const context = useContext(MockAppContext);

  if (!context) {
    throw new Error("useMockApp must be used within MockAppProvider");
  }

  return context;
}
