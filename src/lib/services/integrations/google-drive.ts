import { cookies } from "next/headers";
import { mediaAssets } from "@/lib/data/mock-data";
import { DriveConnectionStatus, DriveFolderOption, DriveImportResult } from "@/lib/integrations/google-drive-types";
import { MediaAsset, SourceVideo } from "@/lib/types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file";

const ACCESS_COOKIE = "scs_gdrive_access_token";
const REFRESH_COOKIE = "scs_gdrive_refresh_token";
const EXPIRY_COOKIE = "scs_gdrive_expiry";
const FOLDER_COOKIE = "scs_gdrive_folder_id";
const FOLDER_NAME_COOKIE = "scs_gdrive_folder_name";
const STATE_COOKIE = "scs_gdrive_state";

interface DriveTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface DriveProvider {
  getConnectionStatus(origin: string): Promise<DriveConnectionStatus>;
  getAuthorizationUrl(origin: string): Promise<string | null>;
  handleOAuthCallback(origin: string, code: string, state: string | null): Promise<void>;
  listFolders(): Promise<DriveFolderOption[]>;
  setSelectedFolder(folderId: string, folderName: string): Promise<void>;
  importFolder(folderId?: string): Promise<DriveImportResult>;
}

function env() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    preferredFolderName: process.env.GOOGLE_DRIVE_SOURCE_FOLDER_NAME ?? "Video's to edit"
  };
}

function isConfigured() {
  const values = env();
  return Boolean(values.clientId && values.clientSecret);
}

function buildRedirectUri(origin: string) {
  return env().redirectUri || `${origin}/api/integrations/google-drive/callback`;
}

async function tokenCookies() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: store.get(REFRESH_COOKIE)?.value ?? null,
    expiry: Number(store.get(EXPIRY_COOKIE)?.value ?? "0") || 0
  };
}

async function setTokens(tokens: DriveTokenResponse) {
  const store = await cookies();
  const expiry = Date.now() + tokens.expires_in * 1000;
  store.set(ACCESS_COOKIE, tokens.access_token, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  store.set(EXPIRY_COOKIE, String(expiry), { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  if (tokens.refresh_token) {
    store.set(REFRESH_COOKIE, tokens.refresh_token, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  }
}

async function setOAuthState(state: string) {
  const store = await cookies();
  store.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
}

async function consumeOAuthState() {
  const store = await cookies();
  const value = store.get(STATE_COOKIE)?.value ?? null;
  store.delete(STATE_COOKIE);
  return value;
}

async function getSelectedFolderCookies() {
  const store = await cookies();
  return {
    id: store.get(FOLDER_COOKIE)?.value ?? null,
    name: store.get(FOLDER_NAME_COOKIE)?.value ?? null
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function exchangeCodeForTokens(origin: string, code: string) {
  const values = env();
  const body = new URLSearchParams({
    client_id: values.clientId,
    client_secret: values.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: buildRedirectUri(origin)
  });

  return fetchJson<DriveTokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
}

async function refreshAccessToken(refreshToken: string) {
  const values = env();
  const body = new URLSearchParams({
    client_id: values.clientId,
    client_secret: values.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  return fetchJson<DriveTokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
}

async function getValidAccessToken() {
  const tokens = await tokenCookies();
  if (!tokens.accessToken || !tokens.expiry || Date.now() > tokens.expiry - 60_000) {
    if (!tokens.refreshToken) {
      return null;
    }
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    await setTokens({ ...refreshed, refresh_token: tokens.refreshToken });
    return refreshed.access_token;
  }
  return tokens.accessToken;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  createdTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  videoMediaMetadata?: {
    durationMillis?: string;
    width?: number;
    height?: number;
  };
}

interface GoogleDriveListResponse {
  files?: GoogleDriveFile[];
}

async function driveListFiles(query: string, fields: string) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error("Google Drive is not connected.");
  }

  const params = new URLSearchParams({
    q: query,
    fields,
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: "100"
  });

  return fetchJson<GoogleDriveListResponse>(`${GOOGLE_DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

function driveFileToMediaAsset(file: GoogleDriveFile, folderName: string | null): MediaAsset {
  const durationMillis = Number(file.videoMediaMetadata?.durationMillis ?? "0");
  const totalSeconds = Math.max(Math.floor(durationMillis / 1000), 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return {
    id: `drive-asset-${file.id}`,
    filename: file.name,
    duration: `${minutes}:${seconds}`,
    uploadDate: file.createdTime ? file.createdTime.slice(0, 10) : new Date().toISOString().slice(0, 10),
    tags: ["google drive import", "video source"],
    sourceFolder: folderName ? `Google Drive/${folderName}` : "Google Drive",
    project: "Video's to edit"
  };
}

function driveFileToSourceVideo(file: GoogleDriveFile, assetId: string): SourceVideo {
  const durationMillis = Number(file.videoMediaMetadata?.durationMillis ?? "0");
  const totalSeconds = Math.max(Math.floor(durationMillis / 1000), 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return {
    id: `drive-video-${file.id}`,
    title: file.name.replace(/\.[a-z0-9]+$/i, ""),
    description: "Imported from Google Drive folder for video editing and short extraction.",
    duration: `${minutes}:${seconds}`,
    transcriptStatus: "pending",
    analysisStatus: "queued",
    assetId,
    ideaIds: [],
    shortsExtracted: 0
  };
}

export class MockGoogleDriveProvider implements DriveProvider {
  async getConnectionStatus() {
    return {
      provider: "mock" as const,
      configured: false,
      connected: false,
      selectedFolderId: null,
      selectedFolderName: null,
      preferredFolderName: env().preferredFolderName
    };
  }

  async getAuthorizationUrl() {
    return null;
  }

  async handleOAuthCallback() {
    return;
  }

  async listFolders() {
    return [{ id: "mock-folder", name: env().preferredFolderName }];
  }

  async setSelectedFolder() {
    return;
  }

  async importFolder(folderId: string = "mock-folder") {
    const assets = mediaAssets;
    const sourceVideos: SourceVideo[] = assets.map((asset, index) => ({
      id: `mock-import-video-${index + 1}`,
      title: asset.filename.replace(/\.[a-z0-9]+$/i, ""),
      description: "Imported from mock provider fallback.",
      duration: asset.duration,
      transcriptStatus: "pending",
      analysisStatus: "queued",
      assetId: asset.id,
      ideaIds: [],
      shortsExtracted: 0
    }));

    return {
      imported: assets.length,
      folderId,
      folderName: env().preferredFolderName,
      assets,
      sourceVideos
    };
  }
}

export class RealGoogleDriveProvider implements DriveProvider {
  async getConnectionStatus(origin: string) {
    const selected = await getSelectedFolderCookies();
    const tokens = await tokenCookies();
    return {
      provider: "google" as const,
      configured: isConfigured(),
      connected: Boolean(tokens.accessToken || tokens.refreshToken),
      selectedFolderId: selected.id,
      selectedFolderName: selected.name,
      preferredFolderName: env().preferredFolderName
    };
  }

  async getAuthorizationUrl(origin: string) {
    if (!isConfigured()) {
      return null;
    }

    const state = crypto.randomUUID();
    await setOAuthState(state);
    const redirectUri = buildRedirectUri(origin);
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", env().clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", DRIVE_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async handleOAuthCallback(origin: string, code: string, state: string | null) {
    const expectedState = await consumeOAuthState();
    if (!expectedState || expectedState !== state) {
      throw new Error("Google Drive OAuth state mismatch.");
    }

    const tokens = await exchangeCodeForTokens(origin, code);
    await setTokens(tokens);

    const selected = await getSelectedFolderCookies();
    if (!selected.id) {
      const folders = await this.listFolders();
      const preferred = folders.find((folder) => folder.name === env().preferredFolderName) ?? folders[0];
      if (preferred) {
        await this.setSelectedFolder(preferred.id, preferred.name);
      }
    }
  }

  async listFolders() {
    const fallback = await driveListFiles("mimeType='application/vnd.google-apps.folder' and trashed=false", "files(id,name)");
    const folders = fallback.files?.map((file) => ({ id: file.id, name: file.name })) ?? [];
    const preferred = env().preferredFolderName.toLowerCase();

    return [...folders.filter((folder) => folder.name.toLowerCase() === preferred), ...folders.filter((folder) => folder.name.toLowerCase() !== preferred)];
  }

  async setSelectedFolder(folderId: string, folderName: string) {
    const store = await cookies();
    store.set(FOLDER_COOKIE, folderId, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    store.set(FOLDER_NAME_COOKIE, folderName, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  }

  async importFolder(folderId?: string) {
    const selected = await getSelectedFolderCookies();
    const resolvedFolderId = folderId ?? selected.id;
    const folderName = selected.name;
    if (!resolvedFolderId) {
      throw new Error("No Google Drive folder selected.");
    }

    const response = await driveListFiles(`'${resolvedFolderId}' in parents and trashed=false`, "files(id,name,mimeType,createdTime,webViewLink,thumbnailLink,videoMediaMetadata)");
    const videoFiles = (response.files ?? []).filter((file) => file.mimeType?.startsWith("video/"));

    const assets = videoFiles.map((file) => driveFileToMediaAsset(file, folderName));
    const sourceVideos = videoFiles.map((file) => {
      const assetId = `drive-asset-${file.id}`;
      return driveFileToSourceVideo(file, assetId);
    });

    return {
      imported: sourceVideos.length,
      folderId: resolvedFolderId,
      folderName,
      assets,
      sourceVideos
    };
  }
}

export function getDriveProvider(): DriveProvider {
  return isConfigured() ? new RealGoogleDriveProvider() : new MockGoogleDriveProvider();
}
