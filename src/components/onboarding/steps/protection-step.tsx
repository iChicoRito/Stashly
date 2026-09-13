import { useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { ScreenHeading } from "@/components/onboarding/onboarding-screen";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_MASTER_PASSWORD_LEN } from "@/stores/onboarding/onboarding-schema";

const PASSWORD_INPUT_ID = "onboarding-master-password";
const PASSWORD_ERROR_ID = "onboarding-master-password-error";
const CONFIRM_INPUT_ID = "onboarding-confirm-password";

/**
 * One message for the one thing this step can be told is wrong.
 *
 * A too-short pair and a pair that does not match mean the same thing to the user — the
 * password is not usable yet — and the step cannot tell which of the two fields they meant
 * to change. Leaving both empty is not a failure: it is how the step is skipped, which the
 * wizard offers beside the control that submits.
 */
const PASSWORD_ERROR = `Use at least ${MIN_MASTER_PASSWORD_LEN} characters, and make sure both passwords match.`;

interface ProtectionStepProps {
  password: string;
  confirmPassword: string;
  /**
   * True only while this step's answer is incomplete and the user has asked to create the
   * vault. Computed by the wizard from the shared `isStepComplete` predicate.
   */
  showPasswordError: boolean;
  /** True while `completeOnboarding` is in flight; every control here stops accepting input. */
  disabled: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

/**
 * The screen that offers to lock the vault, without requiring it.
 *
 * Nothing here chooses a location or mentions one: Stashly stores the vault where it always
 * stores it, and a first-run screen that explains folders and paths to someone who has not
 * saved anything yet asks them to make a decision they have no basis for yet.
 */
export function ProtectionStep({
  password,
  confirmPassword,
  showPasswordError,
  disabled,
  onPasswordChange,
  onConfirmPasswordChange,
}: ProtectionStepProps) {
  // Per field, and deliberately not in a store: whether a typed secret is on screen is a
  // property of this screen, not an answer about the vault, and it must not outlive it. The
  // confirmation reveals on its own so it can be read back against the password without
  // putting the password on screen as well.
  const [revealed, setRevealed] = useState({ password: false, confirmation: false });

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading
        title="Keep your vault private"
        description="Add a Master Password to lock Stashly and help protect your personal information when you're away from your device."
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <PasswordField
            id={PASSWORD_INPUT_ID}
            label="Master Password"
            value={password}
            revealed={revealed.password}
            disabled={disabled}
            invalid={showPasswordError}
            describedBy={showPasswordError ? PASSWORD_ERROR_ID : undefined}
            onRevealChange={(next) => setRevealed((current) => ({ ...current, password: next }))}
            onChange={onPasswordChange}
          />
          {showPasswordError && <FieldError id={PASSWORD_ERROR_ID}>{PASSWORD_ERROR}</FieldError>}
        </div>

        <PasswordField
          id={CONFIRM_INPUT_ID}
          label="Confirm Master Password"
          value={confirmPassword}
          revealed={revealed.confirmation}
          disabled={disabled}
          // Described by the same message as the field above it: the pair is what is wrong,
          // and this step cannot tell which half the user needs to change.
          invalid={showPasswordError}
          describedBy={showPasswordError ? PASSWORD_ERROR_ID : undefined}
          onRevealChange={(next) => setRevealed((current) => ({ ...current, confirmation: next }))}
          onChange={onConfirmPasswordChange}
        />
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  /** The field's own words, which also name the control that reveals it. */
  label: string;
  value: string;
  revealed: boolean;
  disabled: boolean;
  invalid: boolean;
  /** The error message's id, or `undefined` while there is nothing to describe. */
  describedBy: string | undefined;
  onRevealChange: (revealed: boolean) => void;
  onChange: (value: string) => void;
}

/**
 * One password box and the control that shows what was typed into it.
 *
 * Both fields are this same block rather than two hand-written copies, so the reveal control
 * cannot end up on one of them only, and neither can the padding that keeps the typed
 * password from running underneath it.
 */
function PasswordField({
  id,
  label,
  value,
  revealed,
  disabled,
  invalid,
  describedBy,
  onRevealChange,
  onChange,
}: PasswordFieldProps) {
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={revealed ? "text" : "password"}
          value={value}
          autoComplete="new-password"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          // Room for the reveal control, which sits over the field's trailing edge.
          className="pr-8"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-pressed={revealed}
          // Named for the field it belongs to: two controls called "Show password" would be
          // two identical announcements for a screen reader, next to two different boxes.
          aria-label={`${revealed ? "Hide" : "Show"} ${label}`}
          disabled={disabled}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          onClick={() => onRevealChange(!revealed)}
        >
          {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
    </Field>
  );
}
