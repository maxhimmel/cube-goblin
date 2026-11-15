import { connectionSchema, offlineStatusSchema } from "@repo/cube/browser";
import type { OfflineStatus } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";

export const CONNECTION_QUERY_KEY = ["connection"] as const;
export const OFFLINE_QUERY_KEY = ["offline"] as const;
const ONLINE_POLL_MS = 30_000;
const OFFLINE_POLL_MS = 5_000;
export const OFFLINE_REASON = "Offline: Scryfall can't be reached";

async function fetchConnection(): Promise<boolean> {
  const response = await fetch("/api/connection");
  if (!response.ok) {
    return true;
  }
  return connectionSchema.parse(await response.json()).online;
}

function recheck(): void {
  void queryClient.invalidateQueries({ queryKey: CONNECTION_QUERY_KEY });
}

let watching = false;

function watch(): void {
  if (watching) {
    return;
  }
  watching = true;
  window.addEventListener("online", recheck);
  window.addEventListener("offline", recheck);
  queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.action.type === "error" &&
      event.query.queryHash !== JSON.stringify(CONNECTION_QUERY_KEY)
    ) {
      recheck();
    }
  });
  queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "error") {
      recheck();
    }
  });
}

export function useOnline(): boolean {
  watch();
  const { data } = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: fetchConnection,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data === false ? OFFLINE_POLL_MS : ONLINE_POLL_MS),
  });
  return data ?? true;
}

export async function fetchOffline(): Promise<OfflineStatus> {
  const response = await fetch("/api/offline");
  if (!response.ok) {
    throw new Error(`GET /api/offline failed (${String(response.status)})`);
  }
  return offlineStatusSchema.parse(await response.json());
}

export async function makeOffline(): Promise<OfflineStatus> {
  const response = await fetch("/api/offline", { method: "POST" });
  if (!response.ok) {
    throw new Error(`POST /api/offline failed (${String(response.status)})`);
  }
  return offlineStatusSchema.parse(await response.json());
}
