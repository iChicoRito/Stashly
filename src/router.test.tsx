import type { ReactElement } from "react";

import { render, screen } from "@testing-library/react";
import { type RouteObject, RouterProvider } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import type { VaultStartup } from "@/lib/vault/types";
import { emptyDraft } from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";
import { useVaultStore } from "@/stores/vault/vault-store";

vi.mock("@/lib/vault/api", () => ({
  getVaultStartup: vi.fn(),
  completeOnboarding: vi.fn(),
  getStorageProbePaths: vi.fn(),
  readStorageProbe: vi.fn(),
  writeStorageProbe: vi.fn(),
}));

// Every route is eagerly imported, so the first `import("@/router")` in this file compiles the
// whole app tree — template demos included. That is why the tests below carry a timeout: the
// import is slow once and then cached, and jsdom's default 5s is not enough for it.
const ROUTE_TREE_IMPORT_TIMEOUT_MS = 60_000;

// The hash has to be set before `@/router` is evaluated: `createHashRouter` reads
// `window.location` when the module is created, and the wizard's own route is what the last
// test renders.
window.location.hash = "#/onboarding";

const READY: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: false,
  onboarding_completed_at: "2026-09-13T09:00:00.000Z",
  collections: [],
};

/** T-01's SETUP COMPLETE headline, which only the wizard's last screen renders. */
const COMPLETE_HEADING = "Your Stash is ready.";

function flatten(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);
}

/**
 * The component a route renders, which is how a gate is told apart from the page it wraps.
 *
 * Read through the route's own `element` rather than by rendering: the difference under test is
 * the shape of the wiring, and no vault is needed to check it.
 */
function elementType(route: RouteObject | undefined): unknown {
  return (route?.element as ReactElement | undefined)?.type;
}

describe("router", () => {
  // Block-bodied: a concise arrow would return `mockReset`'s value, which vitest reads as a
  // teardown function and then calls after every test.
  beforeEach(() => {
    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test(
    "gates Stashly's pages, and registers the wizard ungated",
    async () => {
      const { router } = await import("@/router");
      const routes = flatten(router.routes);

      // The gate is the only reader of `vault_get_state`, and the page behind it renders the
      // answer that read produced.
      expect(elementType(routes.find((route) => route.index))).toBe(OnboardingGate);
      expect(elementType(routes.find((route) => route.path === "settings"))).toBe(OnboardingGate);
      expect(elementType(routes.find((route) => route.path === "dev/storage"))).toBe(OnboardingGate);

      // NOT gated: `onboarding-wizard.tsx` refreshes the vault store the moment the submission
      // succeeds, which flips the store to `ready`. A gate here would swap the completion
      // summary for the Dashboard before the user could read it, or click "Open Stashly →".
      expect(elementType(routes.find((route) => route.path === "onboarding"))).toBe(OnboardingWizard);

      // The template demo routes and the catch-all survive the rewiring.
      expect(routes.some((route) => route.path === "template/dashboard")).toBe(true);
      expect(routes.some((route) => route.path === "*")).toBe(true);
    },
    ROUTE_TREE_IMPORT_TIMEOUT_MS,
  );

  test("keeps the completion screen on screen when that refresh lands", async () => {
    const { router } = await import("@/router");

    useOnboardingStore.setState({
      step: "complete",
      draft: { ...emptyDraft(), userName: "Mark Adrianne", starterCollections: ["Projects"] },
      status: "complete",
      error: null,
    });
    useVaultStore.setState({
      status: "onboarding",
      startup: { status: "not_initialized" },
      errorCode: null,
      errorMessage: null,
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();

    // Exactly what `refresh()` does once the vault has been written.
    useVaultStore.setState({ status: "ready", startup: READY, errorCode: null, errorMessage: null });

    expect(screen.getByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Dashboard" })).not.toBeInTheDocument();
  });
});
