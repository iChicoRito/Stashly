import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The frame every onboarding screen sits in.
 *
 * Onboarding is a full-bleed surface: no sidebar, no header, nothing from the dashboard
 * shell around it. The column is one fixed measure so the five screens do not shift as the
 * user moves between them, and the block inside it is centred both ways — that is where the
 * design puts every screen, whether its text is centred or ranged left.
 */
export function OnboardingScreen({ children, centered = false }: OnboardingScreenProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16">
      <div className={cn("flex w-full max-w-[52rem] flex-col", centered && "items-center text-center")}>{children}</div>
    </main>
  );
}

interface OnboardingScreenProps {
  children: ReactNode;
  /**
   * Centres the block's text. The welcoming and closing screens are centred; the three
   * screens that ask for something are ranged left, which is what makes them read as forms.
   */
  centered?: boolean;
}

interface ScreenHeadingProps {
  title: string;
  description: string;
}

/**
 * The heading pair every screen opens with: one line of what this screen is, one line of
 * why it is being asked. Its spacing is fixed here rather than per screen, because the
 * distance from a heading to its own sentence is not a per-screen decision.
 *
 * Both sizes are the app's own: `text-3xl` is what the Dashboard's page title uses, and
 * `text-sm` is what everything secondary in Stashly is set in. Medium is the heaviest weight
 * anywhere in onboarding, and it belongs to titles alone.
 */
export function ScreenHeading({ title, description }: ScreenHeadingProps) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-medium text-3xl leading-tight">{title}</h1>
      <p className="font-normal text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

interface ScreenActionsProps {
  children: ReactNode;
  /**
   * `center` for a screen whose whole block is centred, `start` for a left-aligned one with
   * nothing else in the row, and `split` for one that carries a way to skip beside a way
   * forward — Back is then at the far edge, away from the control that commits.
   */
  align?: "center" | "start" | "split";
  className?: string;
}

export function ScreenActions({ children, align = "start", className }: ScreenActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        align === "center" && "justify-center",
        align === "split" && "justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}
