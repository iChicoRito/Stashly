import { create } from "zustand";

import { completeOnboarding } from "@/lib/vault/api";
import { toVaultCommandError, type VaultCommandError } from "@/lib/vault/error";
import {
  emptyDraft,
  isStepComplete,
  ONBOARDING_STEPS,
  type OnboardingDraft,
  type OnboardingStepId,
  STARTER_COLLECTION_OPTIONS,
  toSubmission,
} from "@/stores/onboarding/onboarding-schema";

// The steps and their ids belong to the schema, but the wizard imports this store for
// everything it needs, so they are re-exported here rather than making every step file
// reach for the schema as well.
export type { OnboardingStepId };
export { ONBOARDING_STEPS };

export type OnboardingStatus = "idle" | "submitting" | "complete" | "error";

/** The draft's free-text fields, so a step can bind one handler to all of its inputs. */
export type OnboardingStringField = "userName" | "vaultName" | "masterPassword" | "confirmPassword";

/** Shown when `submit()` is reached with a step that is not complete yet. */
const INCOMPLETE_DRAFT_MESSAGE = "Finish the highlighted fields before creating your vault.";

// A rejection the user can fix reads differently from one they can only retry, so the two
// are told apart by the command's error code rather than by the message's wording.
const WRITE_FAILURE_PREFIX = "The vault could not be written.";

// Widened once so `indexOf`/`includes` accept a plain `string` without a cast.
const OPTIONS: readonly string[] = STARTER_COLLECTION_OPTIONS;

interface OnboardingState {
  step: OnboardingStepId;
  draft: OnboardingDraft;
  status: OnboardingStatus;
  error: string | null;
  start: () => void;
  setField: (field: OnboardingStringField, value: string) => void;
  toggleCollection: (name: string) => void;
  clearCollections: () => void;
  next: () => void;
  back: () => void;
  submit: () => Promise<void>;
}

/**
 * The wizard's step and answers.
 *
 * Module-level, in the style of the stores around it: the draft survives moving between
 * the wizard's screens and is discarded when the app closes, because nothing here is
 * persisted. The vault itself is written by `vault_complete_onboarding`; this store's job
 * ends when that command resolves, and the caller refreshes the vault store afterwards.
 */
export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  step: ONBOARDING_STEPS[0],
  draft: emptyDraft(),
  status: "idle",
  error: null,

  start: () => set({ step: ONBOARDING_STEPS[0], draft: emptyDraft(), status: "idle", error: null }),

  setField: (field, value) =>
    set((state) => ({
      draft: { ...state.draft, [field]: value },
      // A failure belonged to the input that caused it. Once that input changes, the error
      // has to go — otherwise the user fixes the field and still reads the old complaint.
      status: "idle",
      error: null,
    })),

  toggleCollection: (name) =>
    set((state) => ({
      draft: {
        ...state.draft,
        starterCollections: toggle(state.draft.starterCollections, name),
      },
    })),

  // What "Skip for now" means on the collections screen: not "leave the ticked ones behind",
  // but "create none of them". Without this, a user who ticked three boxes and then chose to
  // skip would still have three collections waiting in the vault they were told they skipped.
  clearCollections: () => set((state) => ({ draft: { ...state.draft, starterCollections: [] } })),

  next: () => {
    const { step, draft } = get();

    // An incomplete step does not move: the caller shows the field error instead.
    if (!isStepComplete(step, draft)) {
      return;
    }

    const following = ONBOARDING_STEPS.at(ONBOARDING_STEPS.indexOf(step) + 1);

    // `undefined` on the completion screen, which is the last step.
    if (following === undefined) {
      return;
    }

    set({ step: following });
  },

  back: () => {
    const index = ONBOARDING_STEPS.indexOf(get().step);
    // `undefined` on the welcome step, which has nowhere to go back to. It must be
    // `undefined` rather than `at(-1)`, which counts from the end and would wrap a Back
    // on the first screen round to the completion screen.
    const previous = index > 0 ? ONBOARDING_STEPS.at(index - 1) : undefined;

    if (previous === undefined) {
      return;
    }

    set({ step: previous });
  },

  submit: async () => {
    // The second click of a double click finds the first one still in flight and does
    // nothing, so one vault is never created twice.
    if (get().status === "submitting") {
      return;
    }

    const { step, draft } = get();

    // The command would reject this, but only after a round trip and with a message about
    // the raw fields. Catching it here keeps the wizard on the step that needs the fix.
    if (!isStepComplete(step, draft)) {
      set({ status: "error", error: INCOMPLETE_DRAFT_MESSAGE });
      return;
    }

    set({ status: "submitting", error: null });

    try {
      await completeOnboarding(toSubmission(draft));
      set({ status: "complete", error: null, step: "complete" });
    } catch (raw) {
      // `completeOnboarding` already normalizes what it throws, but a mocked or replaced
      // transport is not bound by that, so the same normalizer runs here as well. The step
      // is left where it is, so the user can fix whatever the message is about.
      const failure = toVaultCommandError(raw);
      set({ status: "error", error: describeFailure(failure) });
    }
  },
}));

/**
 * The selection after clicking `name`: out if it was in, in if it was out.
 *
 * The result is ordered by `STARTER_COLLECTION_OPTIONS` rather than by click order, so the
 * review and completion screens list collections the way the step presented them.
 */
function toggle(selected: readonly string[], name: string): string[] {
  return selectionOrder(selected.includes(name) ? selected.filter((entry) => entry !== name) : [...selected, name]);
}

/**
 * `selected` in option order. A name outside the six options — which the wizard cannot
 * produce, but a caller could set — keeps its place after them rather than being dropped.
 */
function selectionOrder(selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  const known = OPTIONS.filter((option) => chosen.has(option));
  const rest = selected.filter((name) => !OPTIONS.includes(name));

  return [...known, ...rest];
}

/**
 * The failure as the user should read it.
 *
 * A `validation` rejection is about what they typed, so its message stands alone; every
 * other code means the vault could not be written, which the user can only retry. Either
 * way the command's own message survives, so nothing is swallowed.
 */
function describeFailure(failure: VaultCommandError): string {
  return failure.code === "validation" ? failure.message : `${WRITE_FAILURE_PREFIX} ${failure.message}`;
}
