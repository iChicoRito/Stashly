import { create } from "zustand";

import { getVaultStartup } from "@/lib/vault/api";
import { toVaultCommandError } from "@/lib/vault/error";
import type { VaultStartup } from "@/lib/vault/types";

/**
 * What the app knows about the vault on disk.
 *
 * `onboarding` is the only state that means "there is no vault yet", and it is reached
 * only by a `not_initialized` reply. `unavailable` is every other failure — a `db`, `io`
 * or `internal` code, a transport error, or no Tauri at all — and the app shows a retry
 * screen for it, because treating one of those as `onboarding` would walk a user through
 * first-run setup on top of a vault that already exists.
 */
export type VaultStatus = "loading" | "ready" | "onboarding" | "unavailable";

/** Shown for a reply the contract does not define, which is a failure and not an empty vault. */
const UNRECOGNIZED_MESSAGE = "The vault reported a state Stashly does not recognize.";

interface VaultState {
  status: VaultStatus;
  /** The reply the status came from; `null` whenever the read failed. */
  startup: VaultStartup | null;
  errorCode: string | null;
  errorMessage: string | null;
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
}

type VaultSetter = (partial: Partial<VaultState>) => void;

/**
 * The one place the vault is read.
 *
 * Both actions below route through here, so "a failure is never an empty vault" is a
 * property of a single function rather than of two copies of the same `try`/`catch`.
 */
async function load(set: VaultSetter): Promise<void> {
  try {
    const startup = await getVaultStartup();
    const status = statusOf(startup);

    if (status === null) {
      // Unreachable through the typed API, and reachable through a replaced transport or a
      // Rust reply that drifted from §4.2. A payload nothing understands is not evidence
      // that the vault is missing, so it fails closed.
      set({ status: "unavailable", startup: null, errorCode: "internal", errorMessage: UNRECOGNIZED_MESSAGE });
      return;
    }

    set({ status, startup, errorCode: null, errorMessage: null });
  } catch (raw) {
    // `getVaultStartup` already normalizes what it throws, but a mocked or replaced
    // transport is not bound by that, and an unclassified rejection still has to land on
    // `unavailable` rather than on anything that renders the wizard.
    const failure = toVaultCommandError(raw);

    // `startup` is dropped with the failure: a vault read that failed is not a vault whose
    // previous contents may still be shown as if they were current.
    set({ status: "unavailable", startup: null, errorCode: failure.code, errorMessage: failure.message });
  }
}

/**
 * The status a recognized reply means, or `null` for one nothing recognizes.
 *
 * The cast is deliberate: `VaultStartup` is a closed union, so TypeScript believes the
 * final branch cannot be reached, and at runtime the value arrives from Rust — or from a
 * mock — where nothing enforces that union.
 */
function statusOf(startup: VaultStartup): VaultStatus | null {
  const { status } = startup as { status?: unknown };

  if (status === "ready") {
    return "ready";
  }

  if (status === "not_initialized") {
    return "onboarding";
  }

  return null;
}

/**
 * The vault's startup state, read once at launch.
 *
 * Module-level, in the style of the stores around it, so every `OnboardingGate` on every
 * route reads one answer rather than each issuing its own `vault_get_state`. The store
 * holds no vault data beyond that reply; the vault itself lives in `src-tauri`.
 */
export const useVaultStore = create<VaultState>()((set) => ({
  // The app starts unknown rather than empty, so the first frame is a skeleton and never a
  // wizard. There is no "idle" state for a reason: an answer that has not arrived yet and a
  // vault that does not exist yet must not look alike.
  status: "loading",
  startup: null,
  errorCode: null,
  errorMessage: null,

  boot: async () => {
    set({ status: "loading", startup: null, errorCode: null, errorMessage: null });
    await load(set);
  },

  // Same read, minus the leading `loading`: this runs when the wizard has just written the
  // vault, and blanking the screen there would throw away the completion screen the user is
  // reading. The previous status stands until the new one is known.
  refresh: async () => {
    await load(set);
  },
}));
