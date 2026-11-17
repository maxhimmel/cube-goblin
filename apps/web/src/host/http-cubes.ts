import { offlineStatusSchema, workbenchSchema } from "@repo/cube/browser";
import type { CubeRef, CubesApi } from "@repo/server/events";
import { CUBES_ROUTE } from "@repo/server/events";
import { z } from "zod";
import { getJson, sendJson } from "../workbench/api.ts";

const cubeRefSchema = z.object({ dir: z.string(), id: z.string(), name: z.string() });
const cubeListSchema = z.object({ current: cubeRefSchema, recent: cubeRefSchema.array() });

export const httpCubes: CubesApi = {
  list: async () => cubeListSchema.parse(await getJson(CUBES_ROUTE)),
  create: async (name) => cubeRefSchema.parse(await sendJson("POST", CUBES_ROUTE, { name })),
  switchTo: async (dir) =>
    cubeRefSchema.parse(await sendJson("POST", `${CUBES_ROUTE}/switch`, { dir })),
  remove: async (dir) =>
    cubeListSchema.parse(await sendJson("POST", `${CUBES_ROUTE}/remove`, { dir })),
  offlineStatus: async (dir) =>
    offlineStatusSchema.parse(
      await getJson(`${CUBES_ROUTE}/offline?dir=${encodeURIComponent(dir)}`),
    ),
  cards: async (dir) =>
    workbenchSchema.parse(await getJson(`${CUBES_ROUTE}/cards?dir=${encodeURIComponent(dir)}`)),
};

export async function openPath(dir: string): Promise<CubeRef> {
  return cubeRefSchema.parse(await sendJson("POST", `${CUBES_ROUTE}/open`, { dir }));
}
