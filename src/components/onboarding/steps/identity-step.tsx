import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { derivedVaultName, MAX_USER_NAME_LEN } from "@/stores/onboarding/onboarding-schema";

const NAME_INPUT_ID = "onboarding-user-name";
const NAME_HELP_ID = "onboarding-user-name-help";
const NAME_ERROR_ID = "onboarding-user-name-error";
const VAULT_INPUT_ID = "onboarding-vault-name";
const VAULT_HELP_ID = "onboarding-vault-name-help";

const NAME_REQUIRED = "The user's name is required.";
const NAME_TOO_LONG = `Use ${MAX_USER_NAME_LEN} characters or fewer.`;

interface IdentityStepProps {
  userName: string;
  vaultName: string;
  /** Set once the user has asked to continue with this step; until then the field is quiet. */
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
  const nameError = showNameError ? userNameError(userName) : null;
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
          <Field data-invalid={nameError !== null}>
            <FieldLabel htmlFor={NAME_INPUT_ID}>What should we call you?</FieldLabel>
            <Input
              id={NAME_INPUT_ID}
              value={userName}
              autoComplete="name"
              aria-invalid={nameError !== null}
              // The help text stays described while the error is shown, so a screen reader
              // hears the field's purpose and its complaint together rather than one alone.
              aria-describedby={nameError === null ? NAME_HELP_ID : `${NAME_HELP_ID} ${NAME_ERROR_ID}`}
              onChange={(event) => onUserNameChange(event.target.value)}
            />
            <FieldDescription id={NAME_HELP_ID}>
              Your name is required. It is used for personalized messages around Stashly.
            </FieldDescription>
            {nameError !== null && <FieldError id={NAME_ERROR_ID}>{nameError}</FieldError>}
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

/**
 * The rule `isStepComplete` applies to this step, in words.
 *
 * Both halves come from the same two facts the schema uses — the trimmed name measured in
 * code points — so the message can never disagree with what actually blocks Continue.
 */
function userNameError(userName: string): string | null {
  const trimmed = userName.trim();

  if (trimmed === "") {
    return NAME_REQUIRED;
  }

  return [...trimmed].length > MAX_USER_NAME_LEN ? NAME_TOO_LONG : null;
}
