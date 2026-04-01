"use client";

import { useState, useEffect } from "react";
import { checkDriveConnection, listDriveContents, importDriveVideo } from "@/app/actions/drive-actions";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Folder, FileVideo, ArrowLeft, Search } from "lucide-react";

import type { SourceVideo } from "@/lib/types";

type DriveItem = { id: string; name: string; mimeType: string; thumbnailLink?: string | null };

export function GoogleDriveImport({ onImportComplete }: { onImportComplete: (url: string, name: string, sourceVideo: SourceVideo) => void }) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // Breadcrumbs: { id?: string, name: string }
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id?: string, name: string }>>([
    { id: undefined, name: "Home" }
  ]);

  useEffect(() => {
    checkDriveConnection().then((connected) => {
      setIsConnected(connected);
      if (connected) {
        loadContents(undefined);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadContents = async (folderId?: string, query?: string) => {
    try {
      setLoading(true);
      setError(null);
      const fetchedItems = await listDriveContents(folderId, query);
      setItems(fetchedItems);
    } catch (e) {
      setError("Failed to load Google Drive contents.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      loadContents(breadcrumbs[breadcrumbs.length - 1].id);
      return;
    }
    setIsSearching(true);
    loadContents(undefined, searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    loadContents(breadcrumbs[breadcrumbs.length - 1].id);
  };

  const navigateToFolder = (id: string, name: string) => {
    const newBreadcrumbs = [...breadcrumbs, { id, name }];
    setBreadcrumbs(newBreadcrumbs);
    loadContents(id);
  };

  const navigateBack = () => {
    if (breadcrumbs.length > 1) {
      const newBreadcrumbs = [...breadcrumbs];
      newBreadcrumbs.pop();
      setBreadcrumbs(newBreadcrumbs);
      loadContents(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }
  };

  const handleImport = async (fileId: string, fileName: string) => {
    try {
      setImportingId(fileId);
      setError(null);
      const res = await importDriveVideo({ fileId, fileName });
      onImportComplete(res.localUrl, res.fileName, res.sourceVideo);
    } catch (e) {
      setError(`Failed to import ${fileName}`);
    } finally {
      setImportingId(null);
    }
  };

  if (loading && items.length === 0 && !isSearching) {
    return <div className="p-4 border rounded-2xl animate-pulse bg-slate-50"><p className="text-sm text-slate-500">Checking Google Drive...</p></div>;
  }

  if (!isConnected) {
    return (
      <div className="p-6 border-2 border-dashed border-slate-300 bg-slate-50 rounded-[2rem] text-center space-y-3">
        <h3 className="text-xl font-semibold text-ink">Connect Google Drive</h3>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">Import raw footage directly from your Google Drive account.</p>
        <Button onClick={() => window.location.href = "/api/integrations/google-drive/auth"}>
          Authorize Google Drive
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 border border-slate-200 bg-slate-50 rounded-2xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-ink">Google Drive Files</h3>
        <StatusPill label="Connected" />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Drive for videos or folders..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-fairway/20"
          />
        </div>
        <Button type="submit" variant="secondary" className="px-4">Search</Button>
        {isSearching && (
          <Button type="button" variant="secondary" onClick={clearSearch} className="px-4">Clear</Button>
        )}
      </form>
      
      {!isSearching && (
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-100 py-2 px-3 rounded-lg">
          <Button 
            variant="ghost" 
            className="h-7 w-7 p-0 flex-shrink-0" 
            disabled={breadcrumbs.length <= 1}
            onClick={navigateBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium truncate flex-1">
            {breadcrumbs.map(b => b.name).join(" / ")}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-amber-600">{error}</p>}

      {loading && items.length > 0 ? (
        <div className="p-4 text-center text-sm text-slate-500 animate-pulse">Loading contents...</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">No folders or video files found.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {items.map((item) => {
            const isFolder = item.mimeType === "application/vnd.google-apps.folder";

            return (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-fairway/50 transition">
                <div 
                  className={`flex items-center gap-3 overflow-hidden flex-1 ${isFolder ? "cursor-pointer group" : ""}`}
                  onClick={() => isFolder ? navigateToFolder(item.id, item.name) : undefined}
                >
                  {isFolder ? (
                    <div className="w-10 h-10 flex-shrink-0 bg-blue-50 text-blue-500 flex items-center justify-center rounded-md group-hover:bg-blue-100 transition">
                      <Folder className="h-5 w-5" />
                    </div>
                  ) : item.thumbnailLink ? (
                    <img src={item.thumbnailLink} className="w-10 h-10 flex-shrink-0 rounded-md object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 flex-shrink-0 bg-slate-100 text-slate-400 flex items-center justify-center rounded-md">
                      <FileVideo className="h-5 w-5" />
                    </div>
                  )}
                  <p className={`text-sm font-medium truncate ${isFolder ? "group-hover:text-blue-600 text-slate-700" : "text-ink"}`}>
                    {item.name}
                  </p>
                </div>
                
                {!isFolder && (
                  <Button 
                    variant="secondary" 
                    className="text-xs py-1 h-auto ml-3 flex-shrink-0"
                    disabled={importingId === item.id}
                    onClick={() => handleImport(item.id, item.name)}
                  >
                    {importingId === item.id ? "Importing..." : "Import"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
