import type { VaultErrorCode } from "@/lib/vault/types";

const VAULT_ERROR_CODES = ["not_initialized", "validation", "db", "io", "internal"] as const;

const FALLBACK_MESSAGE = "The vault command failed.";

function isVaultErrorCode(value: unknown): value is VaultErrorCode {
  return typeof value === "string" && (VAULT_ERROR_CODES as readonly string[]).includes(value);
}

function codeFrom(raw: unknown): VaultErrorCode {
  if (typeof raw === "object" && raw !== null) {
    const { code } = raw as { code?: unknown };
    if (isVaultErrorCode(code)) {
      return code;
    }
  }

  // Only a structured `{ code }` from Rust may claim a specific code. Anything
  // else is a transport or programming failure and must not be mistaken for
  // "the vault does not exist yet" — a caller acting on that would restart
  // onboarding over a live vault.
  return "internal";
}

function messageFrom(raw: unknown): string {
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw;
  }

  if (typeof raw === "object" && raw !== null) {
    const { message } = raw as { message?: unknown };
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  }

  return FALLBACK_MESSAGE;
}

export class VaultCommandError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.name = "VaultCommandError";
    this.code = code;
  }
}

export function toVaultCommandError(raw: unknown): VaultCommandError {
  if (raw instanceof VaultCommandError) {
    return raw;
  }

  return new VaultCommandError(codeFrom(raw), messageFrom(raw));
}
