import { beforeEach, describe, expect, test, vi } from "vitest";

import { completeOnboarding } from "@/lib/vault/api";
import { VaultCommandError } from "@/lib/vault/error";
import type { VaultStartup } from "@/lib/vault/types";
import type { OnboardingDraft } from "@/stores/onboarding/onboarding-schema";
import { emptyDraft } from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";

vi.mock("@/lib/vault/api", () => ({ completeOnboarding: vi.fn() }));

const completeOnboardingMock = vi.mocked(completeOnboarding);

const ready: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: false,
  onboarding_completed_at: "2026-09-13T00:00:00.000Z",
  collections: [],
};

const readyDraft: OnboardingDraft = {
  userName: " Mark Adrianne ",
  vaultName: "",
  starterCollections: ["Projects"],
  masterPassword: "",
  confirmPassword: "",
};

function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return { ...emptyDraft(), ...overrides };
}

describe("onboarding store", () => {
  // Block bodies, not concise arrows: the concise form RETURNS the mock, and Vitest treats
  // a value returned from a hook as teardown, so it would call the mock again after every
  // test — and a still-configured rejection would then surface as an unhandled rejection
  // attributed to a test whose assertions are correct.
  beforeEach(() => {
    completeOnboardingMock.mockReset();
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test("start() returns to the first step with an empty draft", () => {
    useOnboardingStore.setState({
      step: "protection",
      draft: draft({ userName: "Mark", masterPassword: "correct horse" }),
      status: "error",
      error: "The vault could not be written.",
    });

    useOnboardingStore.getState().start();

    expect(useOnboardingStore.getState()).toMatchObject({
      step: "welcome",
      draft: emptyDraft(),
      status: "idle",
      error: null,
    });
  });

  describe("next", () => {
    test("refuses to advance while the current step is incomplete", () => {
      useOnboardingStore.setState({ step: "identity", draft: draft({ userName: "   " }) });
      useOnboardingStore.getState().next();
      expect(useOnboardingStore.getState().step).toBe("identity");

      const mismatched = draft({ masterPassword: "correct horse", confirmPassword: "correct hors" });
      useOnboardingStore.setState({ step: "protection", draft: mismatched });
      useOnboardingStore.getState().next();
      expect(useOnboardingStore.getState().step).toBe("protection");
    });

    test("changes nothing at all when the step is incomplete", () => {
      useOnboardingStore.setState({ step: "identity", draft: draft({ userName: "" }) });

      useOnboardingStore.getState().next();

      expect(useOnboardingStore.getState()).toMatchObject({ step: "identity", status: "idle", error: null });
    });

    test("advances once the current step has a valid answer", () => {
      useOnboardingStore.setState({ step: "identity", draft: draft({ userName: "Mark Adrianne" }) });

      useOnboardingStore.getState().next();

      expect(useOnboardingStore.getState().step).toBe("collections");
    });

    test("advances from an untouched collections step, because T-01 sets no minimum", () => {
      useOnboardingStore.setState({ step: "collections", draft: emptyDraft() });

      useOnboardingStore.getState().next();

      expect(useOnboardingStore.getState().step).toBe("protection");
    });

    test("stays on complete, which is the last step", () => {
      useOnboardingStore.setState({ step: "complete", draft: readyDraft });

      useOnboardingStore.getState().next();

      expect(useOnboardingStore.getState().step).toBe("complete");
    });
  });

  describe("back", () => {
    test("does nothing on the first step", () => {
      useOnboardingStore.getState().back();

      expect(useOnboardingStore.getState().step).toBe("welcome");
    });

    test("returns to the previous step", () => {
      useOnboardingStore.setState({ step: "collections", draft: readyDraft });

      useOnboardingStore.getState().back();

      expect(useOnboardingStore.getState().step).toBe("identity");
    });

    test("returns from the completion screen to the protection step", () => {
      useOnboardingStore.setState({ step: "complete", draft: readyDraft });

      useOnboardingStore.getState().back();

      expect(useOnboardingStore.getState().step).toBe("protection");
    });
  });

  describe("toggleCollection", () => {
    test("adds a collection that is not selected", () => {
      useOnboardingStore.getState().toggleCollection("Projects");

      expect(useOnboardingStore.getState().draft.starterCollections).toEqual(["Projects"]);
    });

    test("removes a collection that is already selected", () => {
      useOnboardingStore.setState({ draft: draft({ starterCollections: ["Projects", "Work"] }) });

      useOnboardingStore.getState().toggleCollection("Projects");

      expect(useOnboardingStore.getState().draft.starterCollections).toEqual(["Work"]);
    });

    test("keeps the option order rather than the order they were clicked in", () => {
      useOnboardingStore.getState().toggleCollection("Work");
      useOnboardingStore.getState().toggleCollection("Images & Media");
      useOnboardingStore.getState().toggleCollection("Personal Documents");

      expect(useOnboardingStore.getState().draft.starterCollections).toEqual([
        "Personal Documents",
        "Work",
        "Images & Media",
      ]);
    });

    test("toggling twice leaves the draft as it started", () => {
      useOnboardingStore.getState().toggleCollection("Learning & References");
      useOnboardingStore.getState().toggleCollection("Learning & References");

      expect(useOnboardingStore.getState().draft.starterCollections).toEqual([]);
    });

    test("leaves every other field alone", () => {
      useOnboardingStore.setState({ draft: draft({ userName: "Mark", vaultName: "Mark's Stash" }) });

      useOnboardingStore.getState().toggleCollection("Work");

      expect(useOnboardingStore.getState().draft).toMatchObject({ userName: "Mark", vaultName: "Mark's Stash" });
    });
  });

  describe("setField", () => {
    test("writes the field it is given", () => {
      useOnboardingStore.getState().setField("vaultName", "Mark's Stash");

      expect(useOnboardingStore.getState().draft.vaultName).toBe("Mark's Stash");
      expect(useOnboardingStore.getState().draft.userName).toBe("");
    });

    test("clears the error a failed submit left behind", async () => {
      completeOnboardingMock.mockRejectedValue(new VaultCommandError("validation", "The user name is required."));
      useOnboardingStore.setState({ step: "identity", draft: draft({ userName: "Mark" }) });
      await useOnboardingStore.getState().submit();
      expect(useOnboardingStore.getState().error).toBe("The user name is required.");

      useOnboardingStore.getState().setField("masterPassword", "correct horse");

      expect(useOnboardingStore.getState()).toMatchObject({ status: "idle", error: null });
    });

    test("returns a submitting status to idle, so an edit is never made mid-flight", () => {
      useOnboardingStore.setState({ status: "submitting" });

      useOnboardingStore.getState().setField("userName", "M");

      expect(useOnboardingStore.getState().status).toBe("idle");
    });
  });

  describe("submit", () => {
    test("submits the trimmed draft once and completes", async () => {
      completeOnboardingMock.mockResolvedValue(ready);
      useOnboardingStore.setState({ step: "protection", draft: readyDraft });

      await useOnboardingStore.getState().submit();

      expect(completeOnboardingMock).toHaveBeenCalledTimes(1);
      expect(completeOnboardingMock).toHaveBeenCalledWith({
        userName: "Mark Adrianne",
        vaultName: null,
        starterCollections: ["Projects"],
        masterPassword: null,
      });
      expect(useOnboardingStore.getState()).toMatchObject({ status: "complete", step: "complete", error: null });
    });

    test("sends a skipped master password as null", async () => {
      completeOnboardingMock.mockResolvedValue(ready);
      useOnboardingStore.setState({
        step: "protection",
        draft: draft({ userName: "Mark", masterPassword: "", confirmPassword: "" }),
      });

      await useOnboardingStore.getState().submit();

      expect(completeOnboardingMock).toHaveBeenCalledWith(expect.objectContaining({ masterPassword: null }));
    });

    test("sends a typed master password as typed", async () => {
      completeOnboardingMock.mockResolvedValue(ready);
      const password = "correct horse";
      useOnboardingStore.setState({
        step: "protection",
        draft: draft({ userName: "Mark", masterPassword: password, confirmPassword: password }),
      });

      await useOnboardingStore.getState().submit();

      expect(completeOnboardingMock).toHaveBeenCalledWith(expect.objectContaining({ masterPassword: password }));
    });

    test("refuses an incomplete step without calling the command", async () => {
      useOnboardingStore.setState({
        step: "protection",
        draft: draft({ userName: "Mark", masterPassword: "short", confirmPassword: "short" }),
      });

      await useOnboardingStore.getState().submit();

      expect(completeOnboardingMock).not.toHaveBeenCalled();
      const state = useOnboardingStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).not.toBeNull();
      expect(state.step).toBe("protection");
    });

    test("keeps the step and the command's message when validation fails", async () => {
      completeOnboardingMock.mockRejectedValue(
        new VaultCommandError("validation", "The user name must be 120 characters or fewer."),
      );
      useOnboardingStore.setState({ step: "protection", draft: readyDraft });

      await useOnboardingStore.getState().submit();

      expect(useOnboardingStore.getState()).toMatchObject({
        status: "error",
        error: "The user name must be 120 characters or fewer.",
        step: "protection",
      });
    });

    test("surfaces a write failure without swallowing its message", async () => {
      completeOnboardingMock.mockRejectedValue(new VaultCommandError("db", "database or disk is full"));
      useOnboardingStore.setState({ step: "protection", draft: readyDraft });

      await useOnboardingStore.getState().submit();

      const state = useOnboardingStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).toContain("database or disk is full");
      expect(state.step).toBe("protection");
    });

    test("surfaces a transport failure the api layer could not classify", async () => {
      completeOnboardingMock.mockRejectedValue({ code: "io", message: "read-only file system" });
      useOnboardingStore.setState({ step: "protection", draft: readyDraft });

      await useOnboardingStore.getState().submit();

      const state = useOnboardingStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).toContain("read-only file system");
    });

    test("ignores a second submit while the first is in flight", async () => {
      let resolveSubmission: (startup: VaultStartup) => void = () => undefined;
      completeOnboardingMock.mockImplementation(
        () =>
          new Promise<VaultStartup>((resolve) => {
            resolveSubmission = resolve;
          }),
      );
      useOnboardingStore.setState({ step: "protection", draft: readyDraft });

      const inFlight = useOnboardingStore.getState().submit();
      expect(useOnboardingStore.getState().status).toBe("submitting");

      await useOnboardingStore.getState().submit();
      expect(completeOnboardingMock).toHaveBeenCalledTimes(1);

      resolveSubmission(ready);
      await inFlight;

      expect(useOnboardingStore.getState()).toMatchObject({ status: "complete", step: "complete" });
    });
  });
});
