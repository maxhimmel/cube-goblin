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
import "./wall.css";
import "./pane.css";
import "./insights/insights.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}
document.documentElement.dataset["mode"] = mode.name;

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
