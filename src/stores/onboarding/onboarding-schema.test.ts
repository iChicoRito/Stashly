import { describe, expect, test } from "vitest";

import type { OnboardingDraft } from "@/stores/onboarding/onboarding-schema";
import {
  derivedVaultName,
  emptyDraft,
  isStepComplete,
  MAX_MASTER_PASSWORD_LEN,
  MAX_USER_NAME_LEN,
  MIN_MASTER_PASSWORD_LEN,
  ONBOARDING_STEPS,
  STARTER_COLLECTION_OPTIONS,
  toSubmission,
} from "@/stores/onboarding/onboarding-schema";

/** A draft with the given overrides, so each test states only what it is about. */
function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return { ...emptyDraft(), ...overrides };
}

// One code point, two UTF-16 code units. `[...LOCK].length` is 1 and `LOCK.length` is 2,
// which is the whole reason every length rule in the schema counts code points: Rust's
// `chars().count()` agrees with the former, and a rule written against the latter would
// accept a password `vault_complete_onboarding` rejects.
const LOCK = "🔒";

describe("onboarding schema constants", () => {
  test("lists T-01's five steps in order", () => {
    expect(ONBOARDING_STEPS).toEqual(["welcome", "identity", "collections", "protection", "complete"]);
  });

  test("offers exactly T-01's six starter collections in T-01's order", () => {
    expect(STARTER_COLLECTION_OPTIONS).toEqual([
      "Personal Documents",
      "Projects",
      "Work",
      "Learning & References",
      "Important Records",
      "Images & Media",
    ]);
  });

  // These three mirror Rust constants TypeScript cannot import, so their values are pinned
  // here: changing one side without the other has to break a test rather than reach a user
  // as a submit-time rejection.
  test("pins the bounds that mirror the Rust constants", () => {
    expect(MAX_USER_NAME_LEN).toBe(120); // vault_repo::MAX_USER_NAME_LEN
    expect(MIN_MASTER_PASSWORD_LEN).toBe(8); // vault::MIN_MASTER_PASSWORD_LEN
    expect(MAX_MASTER_PASSWORD_LEN).toBe(1024); // vault::MAX_MASTER_PASSWORD_LEN
  });
});

describe("emptyDraft", () => {
  test("starts every field blank", () => {
    expect(emptyDraft()).toEqual({
      userName: "",
      vaultName: "",
      starterCollections: [],
      masterPassword: "",
      confirmPassword: "",
    });
  });

  test("returns a fresh object with a fresh collection array each call", () => {
    const first = emptyDraft();
    const second = emptyDraft();
    first.starterCollections.push("Projects");

    expect(second.starterCollections).toEqual([]);
  });
});

describe("isStepComplete", () => {
  test("welcome and complete need nothing filled in", () => {
    expect(isStepComplete("welcome", emptyDraft())).toBe(true);
    expect(isStepComplete("complete", emptyDraft())).toBe(true);
  });

  describe("identity", () => {
    test("rejects an empty name", () => {
      expect(isStepComplete("identity", draft({ userName: "" }))).toBe(false);
    });

    test("rejects a whitespace-only name", () => {
      expect(isStepComplete("identity", draft({ userName: "   " }))).toBe(false);
    });

    test("accepts a name surrounded by whitespace", () => {
      expect(isStepComplete("identity", draft({ userName: "  Mark  " }))).toBe(true);
    });

    test("accepts exactly the maximum number of characters", () => {
      expect(isStepComplete("identity", draft({ userName: "A".repeat(MAX_USER_NAME_LEN) }))).toBe(true);
    });

    test("rejects one character more than the maximum", () => {
      expect(isStepComplete("identity", draft({ userName: "A".repeat(MAX_USER_NAME_LEN + 1) }))).toBe(false);
    });

    test("measures the trimmed name rather than the padding around it", () => {
      const padded = `  ${"A".repeat(MAX_USER_NAME_LEN)}  `;

      expect(isStepComplete("identity", draft({ userName: padded }))).toBe(true);
    });

    test("counts an astral character as one of the maximum, not two", () => {
      const atLimit = LOCK.repeat(MAX_USER_NAME_LEN);
      const overLimit = LOCK.repeat(MAX_USER_NAME_LEN + 1);

      // Guards the test itself: a `.length` rule would measure these as 240 and 242.
      expect(atLimit.length).toBe(MAX_USER_NAME_LEN * 2);
      expect(isStepComplete("identity", draft({ userName: atLimit }))).toBe(true);
      expect(isStepComplete("identity", draft({ userName: overLimit }))).toBe(false);
    });
  });

  describe("collections", () => {
    test("is complete with nothing selected, because T-01 sets no minimum", () => {
      expect(isStepComplete("collections", draft({ starterCollections: [] }))).toBe(true);
    });

    test("is complete with three selected", () => {
      const starterCollections = ["Personal Documents", "Projects", "Learning & References"];

      expect(isStepComplete("collections", draft({ starterCollections }))).toBe(true);
    });
  });

  describe("protection", () => {
    test("is complete when both password fields are empty, so the step can be skipped", () => {
      expect(isStepComplete("protection", draft())).toBe(true);
    });

    test("rejects a password with no confirmation", () => {
      expect(isStepComplete("protection", draft({ masterPassword: "correct horse" }))).toBe(false);
    });

    test("rejects a confirmation that differs from the password", () => {
      const mismatched = draft({ masterPassword: "correct horse", confirmPassword: "correct hors" });

      expect(isStepComplete("protection", mismatched)).toBe(false);
    });

    test("rejects a password one character below the minimum", () => {
      const tooShort = "p".repeat(MIN_MASTER_PASSWORD_LEN - 1);

      expect(isStepComplete("protection", draft({ masterPassword: tooShort, confirmPassword: tooShort }))).toBe(false);
    });

    test("accepts a password of exactly the minimum length", () => {
      const atMinimum = "p".repeat(MIN_MASTER_PASSWORD_LEN);

      expect(isStepComplete("protection", draft({ masterPassword: atMinimum, confirmPassword: atMinimum }))).toBe(true);
    });

    test("accepts a password of exactly the maximum length", () => {
      const atMaximum = "p".repeat(MAX_MASTER_PASSWORD_LEN);

      expect(isStepComplete("protection", draft({ masterPassword: atMaximum, confirmPassword: atMaximum }))).toBe(true);
    });

    test("rejects a password one character above the maximum", () => {
      const tooLong = "p".repeat(MAX_MASTER_PASSWORD_LEN + 1);

      expect(isStepComplete("protection", draft({ masterPassword: tooLong, confirmPassword: tooLong }))).toBe(false);
    });

    test("counts four astral characters as four, not as eight UTF-16 units", () => {
      const fourLocks = LOCK.repeat(4);

      // The trap in full: `fourLocks.length < 8` is false, so a `.length` rule would let
      // this through and the command would reject it at submit.
      expect(fourLocks.length).toBe(MIN_MASTER_PASSWORD_LEN);
      expect(isStepComplete("protection", draft({ masterPassword: fourLocks, confirmPassword: fourLocks }))).toBe(
        false,
      );
    });

    test("accepts eight astral characters as the minimum", () => {
      const eightLocks = LOCK.repeat(MIN_MASTER_PASSWORD_LEN);

      expect(isStepComplete("protection", draft({ masterPassword: eightLocks, confirmPassword: eightLocks }))).toBe(
        true,
      );
    });

    test("rejects one astral character above the maximum", () => {
      const overLimit = LOCK.repeat(MAX_MASTER_PASSWORD_LEN + 1);

      expect(isStepComplete("protection", draft({ masterPassword: overLimit, confirmPassword: overLimit }))).toBe(
        false,
      );
    });
  });
});

describe("toSubmission", () => {
  test("trims the user name", () => {
    expect(toSubmission(draft({ userName: "  Mark Adrianne  " })).userName).toBe("Mark Adrianne");
  });

  test("maps an empty vault name to null, so Rust derives one", () => {
    expect(toSubmission(draft({ vaultName: "" })).vaultName).toBeNull();
  });

  test("maps a whitespace-only vault name to null rather than storing the padding", () => {
    expect(toSubmission(draft({ vaultName: "   " })).vaultName).toBeNull();
  });

  test("trims a vault name it does keep", () => {
    expect(toSubmission(draft({ vaultName: "  Mark's Stash  " })).vaultName).toBe("Mark's Stash");
  });

  test("maps an empty master password to null, because the step is skippable", () => {
    expect(toSubmission(draft({ masterPassword: "" })).masterPassword).toBeNull();
  });

  test("sends the password exactly as typed, because the command measures it untrimmed", () => {
    // "  abcde " is eight characters, so the wizard accepts it; trimming it to "abcde"
    // would hand `vault.rs` five characters and a rejection the user cannot explain.
    expect(toSubmission(draft({ masterPassword: "  abcde ", confirmPassword: "  abcde " })).masterPassword).toBe(
      "  abcde ",
    );
  });

  test("trims each collection name and drops the blank ones", () => {
    const collections = ["  Projects  ", "", "   ", "Work"];

    expect(toSubmission(draft({ starterCollections: collections })).starterCollections).toEqual(["Projects", "Work"]);
  });

  test("copies the collections instead of sharing the draft's array", () => {
    const starterCollections = ["Projects"];
    const submission = toSubmission(draft({ starterCollections }));
    submission.starterCollections.push("Work");

    expect(starterCollections).toEqual(["Projects"]);
  });

  test("carries a full draft through unchanged apart from the trimmed values", () => {
    const full = draft({
      userName: " Mark Adrianne ",
      vaultName: " Mark's Stash ",
      starterCollections: ["Projects", "Work"],
      masterPassword: "correct horse battery staple",
      confirmPassword: "correct horse battery staple",
    });

    expect(toSubmission(full)).toEqual({
      userName: "Mark Adrianne",
      vaultName: "Mark's Stash",
      starterCollections: ["Projects", "Work"],
      masterPassword: "correct horse battery staple",
    });
  });
});

describe("derivedVaultName", () => {
  test("uses the whole trimmed name rather than the first token", () => {
    expect(derivedVaultName("Mark Adrianne")).toBe("Mark Adrianne's Stash");
    expect(derivedVaultName("  Mark  ")).toBe("Mark's Stash");
  });

  test("falls back to My Stash when the name is blank", () => {
    expect(derivedVaultName("")).toBe("My Stash");
    expect(derivedVaultName("   ")).toBe("My Stash");
  });
});
