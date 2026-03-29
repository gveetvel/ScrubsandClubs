"use client";

import { useCallback, useEffect, useState } from "react";
import { DriveConnectionStatus, DriveFolderOption, DriveImportResult } from "@/lib/integrations/google-drive-types";

export function useGoogleDriveIntegration() {
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [folders, setFolders] = useState<DriveFolderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/integrations/google-drive/status", { cache: "no-store" });
    const payload = (await response.json()) as { data: DriveConnectionStatus };
    setStatus(payload.data);
  }, []);

  const loadFolders = useCallback(async () => {
    setBusy("folders");
    setError(null);
    try {
      const response = await fetch("/api/integrations/google-drive/folders", { cache: "no-store" });
      const payload = (await response.json()) as { data?: DriveFolderOption[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load folders");
      }
      setFolders(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load folders");
    } finally {
      setBusy(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshStatus();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to load Drive status");
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setBusy("connect");
    setError(null);
    try {
      const response = await fetch("/api/integrations/google-drive/connect", { method: "POST" });
      const payload = (await response.json()) as { data: { url: string | null } };
      if (payload.data.url) {
        window.location.href = payload.data.url;
        return;
      }
      throw new Error("Google Drive credentials are not configured.");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Failed to start Google Drive auth");
      setBusy(null);
    }
  }, []);

  const selectFolder = useCallback(async (folder: DriveFolderOption) => {
    setBusy("select-folder");
    setError(null);
    try {
      const response = await fetch("/api/integrations/google-drive/select-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id, folderName: folder.name })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to select folder");
      }
      await refreshStatus();
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Failed to select folder");
    } finally {
      setBusy(null);
    }
  }, [refreshStatus]);

  const importSelectedFolder = useCallback(async () => {
    setBusy("import");
    setError(null);
    try {
      const response = await fetch("/api/integrations/google-drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as { data?: DriveImportResult; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to import Google Drive videos");
      }
      return payload.data;
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import Google Drive videos");
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  return {
    status,
    folders,
    loading,
    busy,
    error,
    refresh,
    connect,
    loadFolders,
    selectFolder,
    importSelectedFolder
  };
}
