import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export interface UploadFileStatus {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface UploadProgressProps {
  files: UploadFileStatus[];
  visible: boolean;
}

export function UploadProgress({ files, visible }: UploadProgressProps) {
  if (!visible || files.length === 0) return null;

  const completed = files.filter((f) => f.status === "done").length;
  const total = files.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded-lg border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">Upload in corso</span>
        <span className="text-muted-foreground">{completed}/{total}</span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="max-h-32 space-y-1 overflow-y-auto">
        {files.map((file, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            {file.status === "uploading" && <Loader2 className="size-3 animate-spin text-blue-500" />}
            {file.status === "done" && <CheckCircle2 className="size-3 text-green-500" />}
            {file.status === "error" && <XCircle className="size-3 text-red-500" />}
            {file.status === "pending" && <div className="size-3 rounded-full border border-muted-foreground/30" />}
            <span className="flex-1 truncate">{file.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
