import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import {
  Folder,
  ChevronRight,
  ArrowLeft,
  X,
  Loader2,
  Check,
} from "lucide-react";

interface FolderBrowserProps {
  title: string;
  onSelect: (folderId: string, folderName: string) => void;
  onClose: () => void;
}

interface DriveFolder {
  id: string;
  name: string;
}

interface BreadcrumbItem {
  id: string | undefined;
  name: string;
}

export function FolderBrowser({ title, onSelect, onClose }: FolderBrowserProps) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: undefined, name: "Il mio Drive" },
  ]);

  const currentParentId = breadcrumb[breadcrumb.length - 1].id;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.browseFolders(currentParentId);
        setFolders(result);
      } catch (e) {
        console.error("Failed to browse folders:", e);
        setFolders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentParentId]);

  const navigateInto = (folder: DriveFolder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateBack = () => {
    if (breadcrumb.length > 1) {
      setBreadcrumb((prev) => prev.slice(0, -1));
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">{title}</h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {breadcrumb.length > 1 && (
            <button
              onClick={navigateBack}
              className="mr-1 rounded p-0.5 hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
            </button>
          )}
          {breadcrumb.map((item, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3 text-muted-foreground/50" />}
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={`rounded px-1 py-0.5 hover:bg-muted ${
                  index === breadcrumb.length - 1
                    ? "font-medium text-foreground"
                    : ""
                }`}
              >
                {item.name}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div className="max-h-72 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna sottocartella
            </p>
          ) : (
            <ul className="space-y-0.5">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigateInto(folder)}
                      className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Folder className="size-4 text-blue-500" />
                      {folder.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onSelect(folder.id, folder.name)}
                      title="Seleziona questa cartella"
                    >
                      <Check className="size-3.5 text-green-600" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer - select current folder */}
        {currentParentId && (
          <div className="border-t border-border px-4 py-3">
            <Button
              size="sm"
              className="w-full"
              onClick={() =>
                onSelect(
                  currentParentId,
                  breadcrumb[breadcrumb.length - 1].name,
                )
              }
            >
              <Check className="size-3.5" />
              Seleziona "{breadcrumb[breadcrumb.length - 1].name}"
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
