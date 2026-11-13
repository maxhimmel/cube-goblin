import type { LogEntry } from "@repo/cube/browser";
import { parsePoint } from "@repo/cube/browser";

export interface Marker {
  id: string;
  label: string;
  at: string;
}

export function markerPosition(entries: readonly LogEntry[], at: string): number {
  return entries.filter((entry) => entry.at <= at).length - 0.5;
}

export function pointPosition(
  entries: readonly LogEntry[],
  markers: readonly Marker[],
  id: string,
): number | undefined {
  const point = parsePoint(id);
  if (point.kind === "current") {
    return entries.length - 0.5;
  }
  if (point.kind === "version") {
    const marker = markers.find((item) => item.id === point.id);
    return marker && markerPosition(entries, marker.at);
  }
  const index = entries.findIndex((entry) => entry.id === point.entry);
  if (index === -1) {
    return undefined;
  }
  return point.side === "before" ? index - 0.5 : index + 0.5;
}

export function rangeOf(
  entries: readonly LogEntry[],
  markers: readonly Marker[],
  from: string | undefined,
  to: string | undefined,
): Set<string> {
  if (from === undefined || to === undefined) {
    return new Set();
  }
  const start = pointPosition(entries, markers, from);
  const end = pointPosition(entries, markers, to);
  if (start === undefined || end === undefined) {
    return new Set();
  }
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  return new Set(
    entries.filter((_, index) => index > low && index < high).map((entry) => entry.id),
  );
}
