import { ScreenHeading } from "@/components/onboarding/onboarding-screen";

/**
 * The screen that closes the flow, and the only one that is not asking for anything.
 *
 * It confirms one fact — the vault exists — and hands over the way in. What was chosen
 * along the way is not repeated back: the collections and the password are already in the
 * vault, and listing them here would ask the user to check work the app has done.
 */
export function CompleteStep() {
  return (
    <ScreenHeading
      title="Congrats! Your vault has been created"
      description="Your personal space is ready. Start organizing your notes, files, links, and important information."
    />
  );
}
