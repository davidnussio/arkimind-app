import { useCallback, useRef, useState } from "react";
import { errorMessage } from "@/lib/format";

export type ActivityItemStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface ActivityItem {
  id: string;
  name: string;
  status: ActivityItemStatus;
  error?: string;
}

export interface Activity {
  kind: "batch" | "upload";
  title: string;
  items: ActivityItem[];
  running: boolean;
  stopping: boolean;
}

export interface ActivityResult {
  done: number;
  errors: number;
  skipped: number;
}

/** Returned by a worker to mark an item as skipped instead of done. */
export const SKIPPED = "skipped" as const;

/**
 * Runs one long operation at a time (batch analysis/archiving, uploads),
 * item by item, and exposes its progress to the docked activity panel.
 */
export function useActivity() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const run = useCallback(
    async <T extends { id: string; name: string }>(
      kind: Activity["kind"],
      title: string,
      entries: T[],
      worker: (entry: T, isCancelled: () => boolean) => Promise<void | typeof SKIPPED>,
    ): Promise<ActivityResult> => {
      const result: ActivityResult = { done: 0, errors: 0, skipped: 0 };
      if (runningRef.current || entries.length === 0) return result;
      runningRef.current = true;
      cancelRef.current = false;

      setActivity({
        kind,
        title,
        running: true,
        stopping: false,
        items: entries.map((e) => ({ id: e.id, name: e.name, status: "pending" })),
      });
      const update = (index: number, patch: Partial<ActivityItem>) =>
        setActivity((a) =>
          a && { ...a, items: a.items.map((it, j) => (j === index ? { ...it, ...patch } : it)) },
        );
      const isCancelled = () => cancelRef.current;

      for (let i = 0; i < entries.length; i++) {
        if (cancelRef.current) {
          setActivity((a) =>
            a && {
              ...a,
              items: a.items.map((it, j) => (j >= i && it.status === "pending" ? { ...it, status: "skipped" } : it)),
            },
          );
          result.skipped += entries.length - i;
          break;
        }
        update(i, { status: "running" });
        try {
          const outcome = await worker(entries[i], isCancelled);
          if (outcome === SKIPPED) {
            result.skipped++;
            update(i, { status: "skipped" });
          } else {
            result.done++;
            update(i, { status: "done" });
          }
        } catch (e) {
          result.errors++;
          update(i, { status: "error", error: errorMessage(e) });
        }
      }

      runningRef.current = false;
      setActivity((a) => a && { ...a, running: false, stopping: false });
      return result;
    },
    [],
  );

  const stop = useCallback(() => {
    cancelRef.current = true;
    setActivity((a) => a && { ...a, stopping: true });
  }, []);

  const dismiss = useCallback(() => {
    if (!runningRef.current) setActivity(null);
  }, []);

  return { activity, busy: activity?.running ?? false, run, stop, dismiss };
}

export type ActivityController = ReturnType<typeof useActivity>;
