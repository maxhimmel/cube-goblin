import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LogView } from "../log/log-view.tsx";
import { LOG_QUERY_KEY, fetchLog } from "./api.ts";

export function WorkbenchLogPage(): ReactNode {
  const log = useQuery({ queryKey: LOG_QUERY_KEY, queryFn: fetchLog });
  if (log.error) {
    return <p className="error">{log.error.message}</p>;
  }
  if (!log.data) {
    return <p className="muted">Loading the change log…</p>;
  }
  return <LogView entries={log.data} />;
}
