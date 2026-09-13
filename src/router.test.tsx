import type { ReactElement, ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { type RouteObject, RouterProvider } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { getStorageProbePaths, getVaultStartup, readStorageProbe } from "@/lib/vault/api";
import type { StorageProbeListing, StorageProbePaths, VaultStartup } from "@/lib/vault/types";
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

const getVaultStartupMock = vi.mocked(getVaultStartup);

/**
 * The dashboard carries the storage probe's panel in a development build, and the panel
 * reads back what earlier runs wrote. Empty rather than absent, so rendering the real
 * dashboard here is about the shell and the gate and not about the panel's contents.
 */
const NO_PROBE_RECORDS: StorageProbeListing = { records: [], files: [] };

const PROBE_PATHS: StorageProbePaths = { vaultRoot: "", dbPath: "", filesDir: "" };

// Every route is eagerly imported, so the first `import("@/router")` in this file compiles the
// whole app tree — template demos included. That is why the tests below carry a timeout: the
// import is slow once and then cached, and jsdom's default 5s is not enough for it.
const ROUTE_TREE_IMPORT_TIMEOUT_MS = 60_000;

// The hash has to be set before `@/router` is evaluated: `createHashRouter` reads
// `window.location` when the module is created, and the tests below render the dashboard's
// own route, which is where a first launch lands.
window.location.hash = "#/";

const NOT_INITIALIZED: VaultStartup = { status: "not_initialized" };

const READY: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: false,
  onboarding_completed_at: "2026-09-13T09:00:00.000Z",
  collections: [],
};

/** T-01's welcome headline, which only the wizard renders. */
const WELCOME_HEADING = "Everything important, in one place.";

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

/** What a layout route renders around its `<Outlet />`, which is where a gate wraps a shell. */
function wrappedChild(route: RouteObject | undefined): unknown {
  const children = (route?.element as ReactElement<{ children?: ReactNode }> | undefined)?.props.children;
  return (children as ReactElement | undefined)?.type;
}

describe("router", () => {
  // Block-bodied: a concise arrow would return `mockReset`'s value, which vitest reads as a
  // teardown function and then calls after every test.
  beforeEach(() => {
    getVaultStartupMock.mockReset();
    vi.mocked(readStorageProbe).mockResolvedValue(NO_PROBE_RECORDS);
    vi.mocked(getStorageProbePaths).mockResolvedValue(PROBE_PATHS);
    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test(
    "gates Stashly's pages above the shell, and leaves the template demos alone",
    async () => {
      const { router } = await import("@/router");
      const routes = flatten(router.routes);

      const gated = routes.find((route) => elementType(route) === OnboardingGate);
      const gatedCount = routes.filter((route) => elementType(route) === OnboardingGate).length;

      // One gate, wrapping the shell rather than sitting inside it. A gate per route would
      // render a first-run screen inside a sidebar full of collections that do not exist, and
      // would re-read the vault on every move between pages.
      expect(gatedCount).toBe(1);
      expect(wrappedChild(gated)).toBe(DashboardShell);
      expect(gated?.children?.map((route) => route.path ?? "(index)")).toEqual(["(index)", "settings", "dev/storage"]);

      // The template demos keep the same shell and take no gate: no vault of Stashly's stands
      // behind them.
      const ungatedShells = routes.filter((route) => elementType(route) === DashboardShell);
      expect(ungatedShells).toHaveLength(1);
      expect(ungatedShells[0]?.children?.some((route) => route.path === "template/dashboard")).toBe(true);

      // The catch-all survives the rewiring.
      expect(routes.some((route) => route.path === "*")).toBe(true);
    },
    ROUTE_TREE_IMPORT_TIMEOUT_MS,
  );

  test("shows onboarding on the dashboard's own route when there is no vault yet", async () => {
    const { router } = await import("@/router");
    getVaultStartupMock.mockResolvedValue(NOT_INITIALIZED);

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: WELCOME_HEADING })).toBeInTheDocument();

    // The whole point: a first-run screen is a page of its own rather than a panel inside the
    // dashboard, so the sidebar is not rendered around it at all.
    expect(document.querySelector("[data-slot='sidebar']")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  test("shows the dashboard, inside its shell, once the vault is ready", async () => {
    const { router } = await import("@/router");
    getVaultStartupMock.mockResolvedValue(READY);

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='sidebar']")).not.toBeNull();
    expect(screen.queryByText(WELCOME_HEADING)).not.toBeInTheDocument();
  });
});
