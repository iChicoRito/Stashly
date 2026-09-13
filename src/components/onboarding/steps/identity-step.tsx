import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { derivedVaultName, MAX_USER_NAME_LEN } from "@/stores/onboarding/onboarding-schema";

const NAME_INPUT_ID = "onboarding-user-name";
const NAME_HELP_ID = "onboarding-user-name-help";
const NAME_ERROR_ID = "onboarding-user-name-error";
const VAULT_INPUT_ID = "onboarding-vault-name";
const VAULT_HELP_ID = "onboarding-vault-name-help";

/**
 * The one thing this step can be told is wrong. The wizard's `isStepComplete` decides
 * *whether* to say it; the bound appears only in the sentence.
 */
const NAME_ERROR = `Enter a name with ${MAX_USER_NAME_LEN} characters or fewer.`;

interface IdentityStepProps {
  userName: string;
  vaultName: string;
  /**
   * True only while this step's answer is incomplete and the user has asked to continue.
   * Computed by the wizard from the shared `isStepComplete` predicate rather than here, so
   * this step holds no rule that could disagree with the schema or with Rust.
   */
  showNameError: boolean;
  onUserNameChange: (value: string) => void;
  onVaultNameChange: (value: string) => void;
}

/** T-01's page 2, quoted from the spec: "Make Stashly yours", and both of its fields. */
export function IdentityStep({
  userName,
  vaultName,
  showNameError,
  onUserNameChange,
  onVaultNameChange,
}: IdentityStepProps) {
  const derived = derivedVaultName(userName);

  return (
    <>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="text-2xl">
          Make Stashly yours
        </CardTitle>
        <CardDescription>Tell us a little about how you want your personal vault to be set up.</CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <Field data-invalid={showNameError}>
            <FieldLabel htmlFor={NAME_INPUT_ID}>What should we call you?</FieldLabel>
            <Input
              id={NAME_INPUT_ID}
              value={userName}
              autoComplete="name"
              aria-invalid={showNameError}
              // The help text stays described while the error is shown, so a screen reader
              // hears the field's purpose and its complaint together rather than one alone.
              aria-describedby={showNameError ? `${NAME_HELP_ID} ${NAME_ERROR_ID}` : NAME_HELP_ID}
              onChange={(event) => onUserNameChange(event.target.value)}
            />
            <FieldDescription id={NAME_HELP_ID}>
              Your name is required. It is used for personalized messages around Stashly.
            </FieldDescription>
            {showNameError && <FieldError id={NAME_ERROR_ID}>{NAME_ERROR}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor={VAULT_INPUT_ID}>Name your vault</FieldLabel>
            <Input
              id={VAULT_INPUT_ID}
              value={vaultName}
              placeholder={derived}
              aria-describedby={VAULT_HELP_ID}
              onChange={(event) => onVaultNameChange(event.target.value)}
            />
            <FieldDescription id={VAULT_HELP_ID}>
              Optional. Leave it empty and your vault is called {derived}. You can rename it later through Settings →
              Vault.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </>
  );
}
