import { MediaAsset, SourceVideo } from "@/lib/types";

export interface DriveFolderOption {
  id: string;
  name: string;
}

export interface DriveConnectionStatus {
  provider: "google" | "mock";
  configured: boolean;
  connected: boolean;
  selectedFolderId: string | null;
  selectedFolderName: string | null;
  preferredFolderName: string;
}

export interface DriveImportResult {
  imported: number;
  folderId: string;
  folderName: string | null;
  assets: MediaAsset[];
  sourceVideos: SourceVideo[];
}
