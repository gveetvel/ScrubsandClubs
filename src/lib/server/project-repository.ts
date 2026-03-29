import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { initialAppState } from "@/lib/data/mock-data";
import { AppState, BrandStyleSettings, EditedShort, Project, PublishingItem } from "@/lib/types";

interface ProjectManifest {
  settings: BrandStyleSettings;
  projects: Project[];
  editedShorts: EditedShort[];
  publishingQueue: PublishingItem[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const MANIFEST_PATH = path.join(DATA_DIR, "projects.json");

async function ensureStorage() {
  await mkdir(DATA_DIR, { recursive: true });
}

function defaultManifest(): ProjectManifest {
  return {
    settings: initialAppState.brandSettings,
    projects: initialAppState.projects,
    editedShorts: initialAppState.editedShorts,
    publishingQueue: initialAppState.publishingQueue
  };
}

async function readManifest(): Promise<ProjectManifest> {
  await ensureStorage();
  try {
    const content = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<ProjectManifest>;
    return {
      settings: parsed.settings ?? initialAppState.brandSettings,
      projects: parsed.projects ?? [],
      editedShorts: parsed.editedShorts ?? [],
      publishingQueue: parsed.publishingQueue ?? []
    };
  } catch {
    return defaultManifest();
  }
}

async function writeManifest(manifest: ProjectManifest) {
  await ensureStorage();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export async function listProjectState() {
  return readManifest();
}

export async function upsertProject(project: Project) {
  const manifest = await readManifest();
  const projects = manifest.projects.some((item) => item.id === project.id)
    ? manifest.projects.map((item) => (item.id === project.id ? project : item))
    : [project, ...manifest.projects];

  await writeManifest({ ...manifest, projects });
  return project;
}

export async function upsertShortDraft(shortDraft: EditedShort) {
  const manifest = await readManifest();
  const editedShorts = manifest.editedShorts.some((item) => item.id === shortDraft.id)
    ? manifest.editedShorts.map((item) => (item.id === shortDraft.id ? shortDraft : item))
    : [shortDraft, ...manifest.editedShorts];

  await writeManifest({ ...manifest, editedShorts });
  return shortDraft;
}

export async function updateShortDraft(
  shortId: string,
  patch: Partial<EditedShort>
) {
  const manifest = await readManifest();
  const current = manifest.editedShorts.find((item) => item.id === shortId);
  if (!current) {
    return null;
  }

  const next = { ...current, ...patch };
  const editedShorts = manifest.editedShorts.map((item) => (item.id === shortId ? next : item));
  await writeManifest({ ...manifest, editedShorts });
  return next;
}

export async function getShortDraftById(shortId: string) {
  const manifest = await readManifest();
  return manifest.editedShorts.find((item) => item.id === shortId) ?? null;
}

export async function updateProject(projectId: string, patch: Partial<Project>) {
  const manifest = await readManifest();
  const current = manifest.projects.find((item) => item.id === projectId);
  if (!current) {
    return null;
  }

  const next = { ...current, ...patch };
  const projects = manifest.projects.map((item) => (item.id === projectId ? next : item));
  await writeManifest({ ...manifest, projects });
  return next;
}

export async function replaceProjectState(nextState: ProjectManifest) {
  await writeManifest(nextState);
  return nextState;
}

export async function upsertPublishingItem(item: PublishingItem) {
  const manifest = await readManifest();
  const publishingQueue = manifest.publishingQueue.some((entry) => entry.id === item.id)
    ? manifest.publishingQueue.map((entry) => (entry.id === item.id ? item : entry))
    : [item, ...manifest.publishingQueue];

  await writeManifest({ ...manifest, publishingQueue });
  return item;
}

export async function replacePublishingQueue(queue: PublishingItem[]) {
  const manifest = await readManifest();
  await writeManifest({ ...manifest, publishingQueue: queue });
  return queue;
}

export async function updateBrandSettings(patch: Partial<BrandStyleSettings>) {
  const manifest = await readManifest();
  const settings = { ...manifest.settings, ...patch };
  await writeManifest({ ...manifest, settings });
  return settings;
}
