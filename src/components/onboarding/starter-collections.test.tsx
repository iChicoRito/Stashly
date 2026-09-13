import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { StarterCollections } from "@/components/onboarding/starter-collections";
import { STARTER_COLLECTION_BLURBS, STARTER_COLLECTION_OPTIONS } from "@/stores/onboarding/onboarding-schema";

interface RenderOptions {
  selected?: readonly string[];
  disabled?: boolean;
  onToggle?: (name: string) => void;
}

/** The grid on its own, so its six cards and their lines are testable without the wizard. */
function renderOptions({ selected = [], disabled = false, onToggle }: RenderOptions = {}) {
  const toggle = onToggle ?? vi.fn();

  render(<StarterCollections selected={selected} disabled={disabled} onToggle={toggle} />);

  return { onToggle: toggle };
}

describe("StarterCollections", () => {
  test("renders T-01's six categories in T-01's order, each one named", () => {
    renderOptions();

    const rendered = screen.getAllByRole("checkbox");

    expect(rendered).toHaveLength(6);
    // Naming each option and comparing the resolved elements to the DOM order proves both
    // halves at once: every card has a real accessible name, and the order is the schema's.
    expect(STARTER_COLLECTION_OPTIONS.map((name) => screen.getByRole("checkbox", { name }))).toEqual(rendered);
  });

  test("says what belongs in each one, beside the category rather than instead of it", () => {
    renderOptions();

    for (const name of STARTER_COLLECTION_OPTIONS) {
      const blurb = STARTER_COLLECTION_BLURBS[name];
      const card = screen.getByText(blurb);

      expect(card).toBeInTheDocument();
      // The line sits inside the same card as the box it explains: a name and a sentence
      // that belong together must not end up in different columns of the grid.
      expect(card.closest("[data-slot='field']")).toContainElement(screen.getByRole("checkbox", { name }));
    }
  });

  test("describes each box by its line instead of folding it into the name", () => {
    renderOptions();

    const checkbox = screen.getByRole("checkbox", { name: "Personal Documents" });
    const describedBy = checkbox.getAttribute("aria-describedby");
    const blurb = STARTER_COLLECTION_BLURBS["Personal Documents"];

    // Read as one string the name would be "Personal Documents IDs and legal papers", which
    // is not a name a screen reader user can act on.
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent(blurb);
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

  test("toggles from the card's own text, not only from the small box", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderOptions();

    await user.click(screen.getByText("Projects"));

    expect(onToggle).toHaveBeenCalledWith("Projects");
  });

  test("stops accepting anything while a write is in flight", () => {
    renderOptions({ disabled: true });

    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
  });
});
