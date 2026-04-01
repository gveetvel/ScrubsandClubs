"use client";

import { useState, useEffect } from "react";
import { checkDriveConnection, exportShortToDrive } from "@/app/actions/drive-actions";
import { Button } from "@/components/ui/button";

export function GoogleDriveExport({ 
  shortName, 
  mp4Path, 
  thumbnailPath, 
  textContent 
}: { 
  shortName: string; 
  mp4Path: string; 
  thumbnailPath?: string; 
  textContent?: string;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkDriveConnection().then(setIsConnected);
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);
      setSuccess(false);

      // We need absolute paths or paths relative to cwd for fs streams.
      // Since our previewUrl ends up just being `/shorts-output/...`, we map it to `public/shorts-output/...`
      const fullMp4Path = `public${mp4Path}`;
      const fullThumbPath = thumbnailPath ? `public${thumbnailPath}` : undefined;

      await exportShortToDrive({
        shortName,
        mp4Path: fullMp4Path,
        thumbnailPath: fullThumbPath,
        textContent
      });

      setSuccess(true);
    } catch (e) {
      setError("Failed to export to Google Drive. Ensure you are connected and the files exist.");
    } finally {
      setExporting(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="mt-4 pt-4 border-t border-emerald-200/50 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-emerald-900">Backup & Handoff</p>
        <p className="text-xs text-emerald-700">Push to your Drive to keep it on your phone for Metricool/CapCut.</p>
      </div>
      <div className="flex items-center gap-3">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {success && <span className="text-xs font-semibold text-emerald-600">Exported to Drive!</span>}
        <Button onClick={handleExport} disabled={exporting || success}>
          {exporting ? "Exporting..." : success ? "Exported" : "Export to Drive"}
        </Button>
      </div>
    </div>
  );
}
