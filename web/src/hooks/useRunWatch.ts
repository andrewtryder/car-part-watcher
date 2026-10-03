import { useCallback, useState } from "react";
import { refreshUnreadCount, runWatch, type RunWatchResponse } from "../api.ts";

type RunMessageFormatters = {
  start?: (watchId: string) => string | undefined;
  success: (result: RunWatchResponse, watchId: string) => string;
  error?: (error: unknown, watchId: string) => string;
};

type UseRunWatchOptions = {
  refresh: () => Promise<void>;
  onMessage: (message: string | undefined) => void;
  messages: RunMessageFormatters;
};

/** Shares the user-visible lifecycle of one manually executed saved search. */
export function useRunWatch(
  { refresh, onMessage, messages }: UseRunWatchOptions,
) {
  const [runningWatchId, setRunningWatchId] = useState<string>();

  const request = useCallback((watchId: string) => runWatch(watchId), []);

  const execute = useCallback(async (watchId: string) => {
    if (runningWatchId) return;
    setRunningWatchId(watchId);
    onMessage(messages.start?.(watchId));
    try {
      const result = await request(watchId);
      onMessage(messages.success(result, watchId));
      await refresh();
      // The navigation badge is a best-effort browser event; it must not turn
      // an already successful execution into an error notice.
      try {
        refreshUnreadCount();
      } catch {
        // The next navigation refresh will reconcile the count.
      }
      return result;
    } catch (error) {
      onMessage(
        messages.error?.(error, watchId) ??
          (error instanceof Error ? error.message : "Run failed"),
      );
      return undefined;
    } finally {
      setRunningWatchId(undefined);
    }
  }, [messages, onMessage, refresh, request, runningWatchId]);

  return { execute, request, runningWatchId };
}
