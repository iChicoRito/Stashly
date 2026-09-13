import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { StarterCollections } from "@/components/onboarding/starter-collections";
import { STARTER_COLLECTION_OPTIONS } from "@/stores/onboarding/onboarding-schema";

interface RenderOptions {
  selected?: readonly string[];
  disabled?: boolean;
  onToggle?: (name: string) => void;
  onSkip?: () => void;
}

/** The block on its own, so its six options and its skip affordance are testable directly. */
function renderOptions({ selected = [], disabled = false, onToggle, onSkip }: RenderOptions = {}) {
  const toggle = onToggle ?? vi.fn();
  const skip = onSkip ?? vi.fn();

  render(<StarterCollections selected={selected} disabled={disabled} onToggle={toggle} onSkip={skip} />);

  return { onToggle: toggle, onSkip: skip };
}

describe("StarterCollections", () => {
  test("renders T-01's six categories in T-01's order, each one labelled", () => {
    renderOptions();

    const rendered = screen.getAllByRole("checkbox");

    expect(rendered).toHaveLength(6);
    // Naming each option and comparing the resolved elements to the DOM order proves both
    // halves at once: every row has a real accessible name, and the order is the schema's.
    expect(STARTER_COLLECTION_OPTIONS.map((name) => screen.getByRole("checkbox", { name }))).toEqual(rendered);
  });

  test("says the choice is optional and that the collections are not permanent", () => {
    renderOptions();

    expect(screen.getByText("Select all that apply. There is no minimum.")).toBeInTheDocument();
    expect(screen.getByText("These collections are only starting points. You can later:")).toBeInTheDocument();
    for (const freedom of ["Rename them", "Delete them", "Reorganize them", "Create additional collections"]) {
      expect(screen.getByText(freedom)).toBeInTheDocument();
    }
  });

  test("shows the selection it is given rather than one of its own", () => {
    renderOptions({ selected: ["Work", "Images & Media"] });

    expect(screen.getByRole("checkbox", { name: "Work" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Images & Media" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Projects" })).not.toBeChecked();
  });

  test("reports a toggle by the category's name, which is the name the vault will be given", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderOptions();

    await user.click(screen.getByRole("checkbox", { name: "Learning & References" }));

    expect(onToggle).toHaveBeenCalledWith("Learning & References");
  });

  test("offers the way past every option, as T-01 writes it", async () => {
    const user = userEvent.setup();
    const { onSkip, onToggle } = renderOptions();

    const skip = screen.getByRole("button", { name: "Skip — I'll organize it myself" });
    expect(skip).toHaveAttribute("data-variant", "ghost");

    await user.click(skip);

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test("stops accepting anything while a write is in flight", () => {
    renderOptions({ disabled: true });

    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }

    expect(screen.getByRole("button", { name: "Skip — I'll organize it myself" })).toBeDisabled();
  });
});
