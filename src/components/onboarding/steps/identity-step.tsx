import { ScreenHeading } from "@/components/onboarding/onboarding-screen";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_USER_NAME_LEN, type UserNameProblem } from "@/stores/onboarding/onboarding-schema";

const NAME_INPUT_ID = "onboarding-user-name";
const NAME_ERROR_ID = "onboarding-user-name-error";

/** The sentence each problem gets. A blank field is not told it is too long. */
const NAME_ERROR: Record<UserNameProblem, string> = {
  empty: "Enter your name to continue.",
  "too-long": `Use ${MAX_USER_NAME_LEN} characters or fewer.`,
};

interface IdentityStepProps {
  userName: string;
  /**
   * What is wrong with the typed name, or `null` while nothing is. Computed by the wizard
   * from the shared `userNameProblem` rather than here, so this step holds no rule that
   * could disagree with the schema or with Rust.
   */
  nameError: UserNameProblem | null;
  onUserNameChange: (value: string) => void;
}

/**
 * The one thing Stashly asks for, and the only answer it needs to make the vault personal.
 *
 * The vault has no name field: it is called `<your name>'s Stash` until the user renames it
 * in Settings. Asking for a second name here would be asking the user to decide something
 * the app can decide, on the screen where they are least able to judge it.
 */
export function IdentityStep({ userName, nameError, onUserNameChange }: IdentityStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading
        title="Make Stashly yours"
        description="Tell us a little about how you want your personal vault to be set up."
      />

      <Field data-invalid={nameError !== null}>
        <FieldLabel htmlFor={NAME_INPUT_ID}>What should we call you?</FieldLabel>
        <Input
          id={NAME_INPUT_ID}
          value={userName}
          autoComplete="name"
          aria-invalid={nameError !== null}
          // The error is the only thing this field is described by: the design puts no
          // helper line under it, and a field with nothing to explain needs no description.
          aria-describedby={nameError === null ? undefined : NAME_ERROR_ID}
          onChange={(event) => onUserNameChange(event.target.value)}
        />
        {nameError !== null && <FieldError id={NAME_ERROR_ID}>{NAME_ERROR[nameError]}</FieldError>}
      </Field>
    </div>
  );
}
