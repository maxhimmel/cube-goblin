import type { Snapshot } from "@repo/cube/browser";
import { snapshotSchema } from "@repo/cube/browser";
import raw from "./generated/snapshot.json";

export const snapshot: Snapshot = snapshotSchema.parse(raw);
