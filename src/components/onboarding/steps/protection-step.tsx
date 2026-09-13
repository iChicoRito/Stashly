import { useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MAX_MASTER_PASSWORD_LEN, MIN_MASTER_PASSWORD_LEN } from "@/stores/onboarding/onboarding-schema";

const PASSWORD_INPUT_ID = "onboarding-master-password";
const PASSWORD_HELP_ID = "onboarding-master-password-help";
const PASSWORD_ERROR_ID = "onboarding-master-password-error";
const CONFIRM_INPUT_ID = "onboarding-confirm-password";
const CONFIRM_ERROR_ID = "onboarding-confirm-password-error";

const TOO_SHORT = `Use at least ${MIN_MASTER_PASSWORD_LEN} characters.`;
const TOO_LONG = `Use ${MAX_MASTER_PASSWORD_LEN} characters or fewer.`;
const MISMATCH = "The two passwords do not match.";

interface ProtectionStepProps {
  password: string;
  confirmPassword: string;
  /** Set once the user has asked to create the vault from this step. */
  showPasswordError: boolean;
  /** True while `completeOnboarding` is in flight; every control here stops accepting input. */
  disabled: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSkip: () => void;
}

/**
 * T-01's page 4, quoted from the spec: the optional Master Password, the way to see what was
 * typed, the way past the step, and the storage line that says where the vault is going.
 *
 * Nothing here chooses a location. T-01 keeps storage automatic and discloses it as
 * `● This Device`; folder, path, and database options belong to Settings.
 */
export function ProtectionStep({
  password,
  confirmPassword,
  showPasswordError,
  disabled,
  onPasswordChange,
  onConfirmPasswordChange,
  onSkip,
}: ProtectionStepProps) {
  // Local, and deliberately not in a store: whether the typed password is on screen is a
  // property of this screen, not an answer about the vault, and it must not outlive it.
  const [revealed, setRevealed] = useState(false);

  const mismatch = showPasswordError && password !== confirmPassword && confirmPassword !== "" ? MISMATCH : null;
  const lengthError = showPasswordError && password !== "" ? lengthMessage(password) : null;
  const inputType = revealed ? "text" : "password";

  return (
    <>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="text-2xl">
          Keep your vault private
        </CardTitle>
        <CardDescription>
          Add a Master Password to lock Stashly and help protect your personal information when you're away from your
          device. Setting a Master Password during onboarding is optional.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={PASSWORD_INPUT_ID}>Master Password</FieldLabel>
            <Input
              id={PASSWORD_INPUT_ID}
              type={inputType}
              value={password}
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={lengthError !== null}
              aria-describedby={lengthError === null ? PASSWORD_HELP_ID : `${PASSWORD_HELP_ID} ${PASSWORD_ERROR_ID}`}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
            <FieldDescription id={PASSWORD_HELP_ID}>
              At least {MIN_MASTER_PASSWORD_LEN} characters. Leave this empty to skip it for now.
            </FieldDescription>
            {lengthError !== null && <FieldError id={PASSWORD_ERROR_ID}>{lengthError}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor={CONFIRM_INPUT_ID}>Confirm Password</FieldLabel>
            <Input
              id={CONFIRM_INPUT_ID}
              type={inputType}
              value={confirmPassword}
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={mismatch !== null}
              aria-describedby={mismatch === null ? undefined : CONFIRM_ERROR_ID}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
            />
            {mismatch !== null && <FieldError id={CONFIRM_ERROR_ID}>{mismatch}</FieldError>}
          </Field>
        </FieldGroup>

        <div className="flex items-center justify-between gap-3">
          <FieldDescription>You can show or hide what you type.</FieldDescription>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-pressed={revealed}
            aria-label={revealed ? "Hide password" : "Show password"}
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {revealed ? "Hide" : "Show"}
          </Button>
        </div>

        <Button type="button" variant="ghost" className="self-start" disabled={disabled} onClick={onSkip}>
          Skip for now
        </Button>

        <FieldDescription>You can enable Vault Lock anytime from Settings → Security.</FieldDescription>

        <Separator />

        <div className="flex flex-col gap-1">
          <p className="font-medium text-sm">Storage</p>
          {/* T-01's indicator, glyph and words in one run so it reads as the single line it is. */}
          <p className="text-muted-foreground text-sm">● This Device</p>
          <FieldDescription>
            Stashly uses its default local application storage automatically. You will not need to choose folders or
            locations.
          </FieldDescription>
        </div>
      </CardContent>
    </>
  );
}

/**
 * The rule `isStepComplete` applies to this step, in words.
 *
 * Two empty fields are not an error — that is T-01's skipped password — and the mismatch is
 * checked first because it is the one the user caused most recently.
 */
function lengthMessage(password: string): string | null {
  const length = [...password].length;

  if (length < MIN_MASTER_PASSWORD_LEN) {
    return TOO_SHORT;
  }

  return length > MAX_MASTER_PASSWORD_LEN ? TOO_LONG : null;
}
