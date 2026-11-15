import { mode } from "#mode";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "./query-client.ts";
import { router } from "./router.tsx";
import "mana-font/css/mana.css";
import "./mana.css";
import "./fonts.css";
import "./styles.css";
import "./ui.css";
import "./strip.css";
import "./pane.css";
import "./board.css";
import "./insights/insights.css";
import "./overlaps/overlap.css";
import "./workbench/compare.css";
import "./log/log.css";
import "./forge/lab.css";
import "./query/query.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}
document.documentElement.dataset["mode"] = mode.name;

void mode
  .boot()
  .catch((error: unknown) => {
    console.warn(`Could not read the cube's name and id: ${String(error)}`);
  })
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
