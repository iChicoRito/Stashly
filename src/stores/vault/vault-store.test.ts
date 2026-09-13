import { beforeEach, describe, expect, test, vi } from "vitest";

import { getVaultStartup } from "@/lib/vault/api";
import { VaultCommandError } from "@/lib/vault/error";
import type { VaultStartup } from "@/lib/vault/types";
import { useVaultStore, type VaultStatus } from "@/stores/vault/vault-store";

vi.mock("@/lib/vault/api", () => ({ getVaultStartup: vi.fn() }));

const getVaultStartupMock = vi.mocked(getVaultStartup);

const ready: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: true,
  onboarding_completed_at: "2026-09-13T00:00:00.000Z",
  collections: [
    {
      id: 1,
      slug: "projects",
      name: "Projects",
      createdAt: "2026-09-13T00:00:00.000Z",
      isStarter: true,
    },
  ],
};

const notInitialized: VaultStartup = { status: "not_initialized" };

/**
 * Every status the store passed through while `run` was in flight, starting from the
 * status it held before.
 *
 * The whole sequence is asserted rather than only the final value: the invariant this
 * store exists to keep is that a *failure* never passes through `ready` or `onboarding`,
 * and a status that is set and immediately replaced would still have rendered the wizard
 * for a frame. `boot()` re-setting the status it already holds must not be counted twice.
 */
async function statusesDuring(run: () => Promise<void>): Promise<VaultStatus[]> {
  const seen: VaultStatus[] = [useVaultStore.getState().status];
  const record = (status: VaultStatus) => {
    if (seen.at(-1) !== status) {
      seen.push(status);
    }
  };

  const unsubscribe = useVaultStore.subscribe((state) => record(state.status));

  try {
    await run();
  } finally {
    unsubscribe();
  }

  return seen;
}

describe("vault store", () => {
  // A block body, not a concise arrow: the concise form RETURNS the mock, and Vitest treats
  // a value returned from a hook as teardown, so a still-configured rejection would be
  // invoked again after the test and surface as an unhandled rejection.
  beforeEach(() => {
    getVaultStartupMock.mockReset();
    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });
  });

  describe("boot", () => {
    test("reaches ready with the payload it read", async () => {
      getVaultStartupMock.mockResolvedValue(ready);

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).toEqual(["loading", "ready"]);
      expect(useVaultStore.getState()).toMatchObject({
        status: "ready",
        startup: ready,
        errorCode: null,
        errorMessage: null,
      });
      expect(getVaultStartupMock).toHaveBeenCalledTimes(1);
    });

    test("holds loading until the read settles, so the gate renders a skeleton and not a wizard", async () => {
      let settle: (startup: VaultStartup) => void = () => undefined;
      getVaultStartupMock.mockImplementation(
        () =>
          new Promise<VaultStartup>((resolve) => {
            settle = resolve;
          }),
      );

      const booting = useVaultStore.getState().boot();

      expect(useVaultStore.getState().status).toBe("loading");

      settle(notInitialized);
      await booting;
    });

    test("reaches onboarding for a vault that was never initialized", async () => {
      getVaultStartupMock.mockResolvedValue(notInitialized);

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).toEqual(["loading", "onboarding"]);
      expect(useVaultStore.getState()).toMatchObject({
        status: "onboarding",
        startup: notInitialized,
        errorCode: null,
        errorMessage: null,
      });
    });

    test("reaches unavailable with the command's code and message", async () => {
      getVaultStartupMock.mockRejectedValue(new VaultCommandError("db", "unable to open database file"));

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).toEqual(["loading", "unavailable"]);
      expect(useVaultStore.getState()).toMatchObject({
        status: "unavailable",
        startup: null,
        errorCode: "db",
        errorMessage: "unable to open database file",
      });
    });

    test("never reports an internal command failure as a vault that does not exist", async () => {
      getVaultStartupMock.mockRejectedValue(new VaultCommandError("internal", "vault state lock poisoned"));

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).not.toContain("ready");
      expect(statuses).not.toContain("onboarding");
      expect(useVaultStore.getState()).toMatchObject({
        status: "unavailable",
        errorCode: "internal",
        errorMessage: "vault state lock poisoned",
      });
    });

    test("never reports a bare rejection as a vault that does not exist", async () => {
      // A transport failure the api layer could not classify: `{ invoke }` itself threw, or
      // there is no Tauri at all. This is the failure that must never walk the user through
      // first-run setup on top of a live vault.
      getVaultStartupMock.mockRejectedValue("boom");

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).not.toContain("ready");
      expect(statuses).not.toContain("onboarding");
      expect(useVaultStore.getState().status).toBe("unavailable");
      expect(useVaultStore.getState().errorCode).toBe("internal");
      expect(useVaultStore.getState().errorMessage).not.toBe("");
    });

    test("discards a vault it had already read when a later boot fails", async () => {
      getVaultStartupMock.mockResolvedValue(ready);
      await useVaultStore.getState().boot();
      expect(useVaultStore.getState().status).toBe("ready");

      getVaultStartupMock.mockRejectedValue(new VaultCommandError("io", "read-only file system"));

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).toEqual(["ready", "loading", "unavailable"]);
      expect(useVaultStore.getState()).toMatchObject({ status: "unavailable", startup: null });
    });

    test("never treats an unrecognized payload as a fresh vault", async () => {
      // A success reply the contract does not define. Reading it as "no vault" would put the
      // wizard on top of whatever is actually on disk, so it is a failure like any other.
      getVaultStartupMock.mockResolvedValue({} as VaultStartup);

      const statuses = await statusesDuring(() => useVaultStore.getState().boot());

      expect(statuses).not.toContain("ready");
      expect(statuses).not.toContain("onboarding");
      expect(useVaultStore.getState().status).toBe("unavailable");
      expect(useVaultStore.getState().errorCode).toBe("internal");
    });
  });

  describe("refresh", () => {
    test("re-reads an onboarding vault into ready after the wizard writes it", async () => {
      getVaultStartupMock.mockResolvedValue(notInitialized);
      await useVaultStore.getState().boot();

      getVaultStartupMock.mockResolvedValue(ready);

      const statuses = await statusesDuring(() => useVaultStore.getState().refresh());

      // No "loading" between the two: a flash there would blank the screen the user just
      // finished working through.
      expect(statuses).toEqual(["onboarding", "ready"]);
      expect(useVaultStore.getState()).toMatchObject({ status: "ready", startup: ready });
      expect(getVaultStartupMock).toHaveBeenCalledTimes(2);
    });

    test("re-reads a ready vault without passing through loading either", async () => {
      getVaultStartupMock.mockResolvedValue(ready);
      await useVaultStore.getState().boot();

      getVaultStartupMock.mockResolvedValue(notInitialized);

      const statuses = await statusesDuring(() => useVaultStore.getState().refresh());

      expect(statuses).toEqual(["ready", "onboarding"]);
    });

    test("never reports a failed refresh as a vault that does not exist", async () => {
      getVaultStartupMock.mockResolvedValue(ready);
      await useVaultStore.getState().boot();

      getVaultStartupMock.mockRejectedValue(new VaultCommandError("internal", "vault state lock poisoned"));

      const statuses = await statusesDuring(() => useVaultStore.getState().refresh());

      // The vault was ready before the failed read and must not be left looking ready after
      // it, nor be mistaken for one that was never initialized.
      expect(statuses.at(-1)).toBe("unavailable");
      expect(statuses).not.toContain("onboarding");
      expect(useVaultStore.getState()).toMatchObject({
        status: "unavailable",
        errorCode: "internal",
        errorMessage: "vault state lock poisoned",
      });
    });
  });
});
