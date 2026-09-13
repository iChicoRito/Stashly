import { ScreenHeading } from "@/components/onboarding/onboarding-screen";

/**
 * The screen that says what Stashly is for, and nothing else.
 *
 * It carries no illustration, no feature list, and no claim about where anything is stored:
 * a first-run screen that tries to explain storage, searching, and organizing before the
 * user has anything to store talks them out of starting. The forward control is the
 * wizard's, so this step is a heading and a sentence.
 */
export function WelcomeStep() {
  return (
    <ScreenHeading
      title="Everything important, in one place."
      description="Keep your notes, files, useful links, documents, and personal information organized inside your own private vault."
    />
  );
}
