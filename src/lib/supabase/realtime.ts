import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";

interface TableChange<T> {
  new: T;
}

/**
 * Subscribes to Postgres changes on a table and returns an unsubscribe function.
 * Realtime is a progressive enhancement (live balance/ledger updates), so a misconfigured or unreachable
 * backend is logged and ignored instead of crashing the whole page.
 */
export function subscribeToTable<T>(
  channelName: string,
  config: { event: "INSERT" | "UPDATE" | "DELETE" | "*"; schema: string; table: string; filter?: string },
  onChange: (payload: TableChange<T>) => void,
): () => void {
  try {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", config, (payload) => onChange(payload as unknown as TableChange<T>))
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        logError("realtime.unsubscribe", error, { channel: channelName });
      }
    };
  } catch (error) {
    logError("realtime.subscribe", error, { channel: channelName });
    return () => {};
  }
}
