import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { StashSettingsForm } from "@/components/stash/stash-settings-form";
import type { StashSettings } from "@/stores/stash/stash-store";

/** Mirrors how the settings route wires the form to the store. */
function Harness() {
  const [values, setValues] = useState<StashSettings>({
    collectionName: "My stash",
    defaultLocation: "Desk drawer",
  });
  const [saved, setSaved] = useState(false);

  return (
    <StashSettingsForm
      values={values}
      saved={saved}
      onChange={(next) => {
        setValues(next);
        setSaved(false);
      }}
      onSave={() => setSaved(true)}
    />
  );
}

describe("Stash settings form", () => {
  test("edits values and reports a successful save", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText(/reset when Stashly closes/i)).toBeInTheDocument();
    const owner = screen.getByLabelText("Collection name");
    const location = screen.getByLabelText("Default location");

    await user.clear(owner);
    await user.type(owner, "Workshop archive");
    await user.clear(location);
    await user.type(location, "North cabinet");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Changes saved for this session.");
    expect(owner).toHaveValue("Workshop archive");
    expect(location).toHaveValue("North cabinet");
  });

  test("describes each field for assistive technology", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Collection name")).toHaveAttribute("aria-describedby", "collection-name-help");
    expect(screen.getByLabelText("Default location")).toHaveAttribute("aria-describedby", "default-location-help");
  });

  test("clears the saved notice when a value changes again", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Changes saved for this session.");

    await user.type(screen.getByLabelText("Collection name"), "!");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
