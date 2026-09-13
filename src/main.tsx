import { StrictMode } from "react";

import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { fontVars } from "@/lib/fonts/registry";
import { router } from "@/router";
import { applyBootPreferences } from "@/scripts/theme-boot";

import "@/styles/fonts.css";

// Preferences first, so the shell renders with the right theme and layout.
applyBootPreferences();
document.body.classList.add(...fontVars.split(" "));

const container = document.getElementById("root");

if (!container) {
  throw new Error("Stashly could not start: #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
