import type { OnboardingSubmission } from "@/lib/vault/types";

// The pure half of the onboarding wizard: T-01's steps, their rules, and the conversion
// into the frozen IPC submission. No React and no store import, so every rule below is
// testable without rendering anything. `onboarding-store.ts` owns the state.
//
// The rules here mirror `src-tauri/src/vault.rs`'s `validate_submission` and
// `vault_repo::save_onboarding`, because a rule the wizard is missing shows up as a
// rejected submit the user cannot act on.

/** T-01's five screens, in order. `complete` is the confirmation screen, not a form. */
export const ONBOARDING_STEPS = ["welcome", "identity", "collections", "protection", "complete"] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

// Counterpart: `vault_repo::MAX_USER_NAME_LEN` in `src-tauri/src/vault_repo.rs`. There is
// no way to import a Rust constant from TypeScript, so the bound is mirrored by hand and
// the two MUST be changed together. A value smaller than Rust's only blocks a name the
// command would have accepted; a larger one lets the wizard accept a name that
// `vault_complete_onboarding` then rejects. The value is pinned by a test.
export const MAX_USER_NAME_LEN = 120;

// Counterparts: `vault::MIN_MASTER_PASSWORD_LEN` and `vault::MAX_MASTER_PASSWORD_LEN` in
// `src-tauri/src/vault.rs`, mirrored by hand for the same reason as the name bound above.
export const MIN_MASTER_PASSWORD_LEN = 8;
export const MAX_MASTER_PASSWORD_LEN = 1024;

// T-01's six categories in T-01's order. These are plain ASCII, and they become collection
// names in the vault exactly as written — `vault_repo::slugify` derives the slug.
export const STARTER_COLLECTION_OPTIONS = [
  "Personal Documents",
  "Projects",
  "Work",
  "Learning & References",
  "Important Records",
  "Images & Media",
] as const;

/** What the wizard's fields hold while the user fills them in. */
export interface OnboardingDraft {
  userName: string;
  vaultName: string;
  starterCollections: string[];
  masterPassword: string;
  confirmPassword: string;
}

/** A draft nothing has been typed into: every optional answer is "left blank". */
export function emptyDraft(): OnboardingDraft {
  return {
    userName: "",
    vaultName: "",
    starterCollections: [],
    masterPassword: "",
    confirmPassword: "",
  };
}

/**
 * Unicode code points, not UTF-16 code units.
 *
 * Rust's `chars().count()` counts scalar values, so `"🔒🔒🔒🔒".length` is 8 while the
 * password is 4 characters. Every length rule in this module measures with this function,
 * so a rule cannot accept a value `vault_complete_onboarding` rejects.
 */
function countCodePoints(value: string): number {
  return [...value].length;
}

/**
 * Whether the step at hand has an answer the vault can be created from.
 *
 * `welcome` and `complete` display and confirm, so neither can be incomplete.
 */
export function isStepComplete(step: OnboardingStepId, draft: OnboardingDraft): boolean {
  switch (step) {
    case "welcome":
    case "complete":
      return true;
    case "identity": {
      // The command and the repository both measure the trimmed name, so this does too.
      const userName = draft.userName.trim();
      return userName !== "" && countCodePoints(userName) <= MAX_USER_NAME_LEN;
    }
    case "collections":
      // T-01: "There should be no required minimum number of selections" — skipping is a
      // complete answer, not a missing one.
      return true;
    case "protection":
      return isProtectionComplete(draft);
  }
}

/**
 * T-01 makes the master password optional, so two empty fields complete the step: that is
 * the state both "Skip for now" and "Create My Vault" submit from. A password the user
 * typed has to sit within the command's bounds and match its confirmation.
 */
function isProtectionComplete(draft: OnboardingDraft): boolean {
  if (draft.masterPassword === "" && draft.confirmPassword === "") {
    return true;
  }

  if (draft.masterPassword !== draft.confirmPassword) {
    return false;
  }

  const length = countCodePoints(draft.masterPassword);
  return length >= MIN_MASTER_PASSWORD_LEN && length <= MAX_MASTER_PASSWORD_LEN;
}

/**
 * The draft as the IPC layer sends it.
 *
 * Every value is trimmed before it is measured, and the trimmed value is what goes on the
 * wire, so the trim `vault_repo::save_onboarding` applies to what it receives cannot
 * change a measurement this module already made.
 */
export function toSubmission(draft: OnboardingDraft): OnboardingSubmission {
  const vaultName = draft.vaultName.trim();

  return {
    userName: draft.userName.trim(),
    // `null` is how the contract says "you choose": Rust derives `${userName}'s Stash`.
    vaultName: vaultName === "" ? null : vaultName,
    starterCollections: draft.starterCollections.map((name) => name.trim()).filter((name) => name !== ""),
    // Sent exactly as typed. `vault.rs` measures the password untrimmed, so trimming here
    // could shorten "  abcde " from eight characters to five and have the command reject a
    // password this module accepted. Only an empty field becomes `null` ("no password").
    masterPassword: draft.masterPassword === "" ? null : draft.masterPassword,
  };
}

/**
 * `<name>'s Stash`, or `My Stash` for a blank name — `vault_repo::derive_vault_name`'s
 * rule, including its use of the whole trimmed name rather than its first token.
 */
export function derivedVaultName(userName: string): string {
  const name = userName.trim();
  return name === "" ? "My Stash" : `${name}'s Stash`;
}
