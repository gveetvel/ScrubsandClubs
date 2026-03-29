import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { EditedShort } from "@/lib/types";

interface RenderedShortManifest {
  drafts: Array<Pick<EditedShort, "id" | "renderStatus" | "exportStatus" | "previewUrl" | "renderedFilePath" | "subtitleFilePath" | "captionFilePath" | "briefFilePath" | "renderError">>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const MANIFEST_PATH = path.join(DATA_DIR, "rendered-short-drafts.json");
const EXPORTS_DIR = path.join(process.cwd(), "public", "rendered-exports");

async function ensureStorage() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(EXPORTS_DIR, { recursive: true });
}

async function readManifest(): Promise<RenderedShortManifest> {
  await ensureStorage();
  try {
    const content = await readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(content) as RenderedShortManifest;
  } catch {
    return { drafts: [] };
  }
}

async function writeManifest(manifest: RenderedShortManifest) {
  await ensureStorage();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export async function listRenderedDrafts() {
  const manifest = await readManifest();
  return manifest.drafts;
}

export async function upsertRenderedDraft(
  draft: Pick<EditedShort, "id" | "renderStatus" | "exportStatus" | "previewUrl" | "renderedFilePath" | "subtitleFilePath" | "captionFilePath" | "briefFilePath" | "renderError">
) {
  const manifest = await readManifest();
  const nextDrafts = manifest.drafts.some((item) => item.id === draft.id)
    ? manifest.drafts.map((item) => (item.id === draft.id ? draft : item))
    : [draft, ...manifest.drafts];

  await writeManifest({ drafts: nextDrafts });
  return draft;
}

export function getRenderedExportsDir() {
  return EXPORTS_DIR;
}
