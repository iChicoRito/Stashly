import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { AddItemDialog } from "@/components/stash/add-item-dialog";
import type { StashItem } from "@/data/stash-items";

function renderDialog(onAdd: (item: StashItem) => void = vi.fn()) {
  render(
    <AddItemDialog onAdd={onAdd}>
      <button type="button">Add item</button>
    </AddItemDialog>,
  );
  return onAdd;
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /add item/i }));
  return { user, dialog: screen.getByRole("dialog", { name: /add item/i }) };
}

describe("Add item dialog", () => {
  test("opens and Cancel closes it, then reopening starts clean", async () => {
    renderDialog();
    const { user, dialog } = await openDialog();

    await user.type(within(dialog).getByLabelText("Name"), "Unfinished item");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const { dialog: reopened } = await openDialog();
    expect(within(reopened).getByLabelText("Name")).toHaveValue("");
    expect(within(reopened).queryByRole("alert")).not.toBeInTheDocument();
  });

  test("rejects whitespace-only fields with connected inline errors", async () => {
    const onAdd = renderDialog();
    const { user, dialog } = await openDialog();

    await user.type(within(dialog).getByLabelText("Name"), "   ");
    await user.type(within(dialog).getByLabelText("Category"), " ");
    await user.type(within(dialog).getByLabelText("Location"), "  ");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    expect(within(dialog).getAllByRole("alert")).toHaveLength(3);
    for (const label of ["Name", "Category", "Location"]) {
      const input = within(dialog).getByLabelText(label);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input.getAttribute("aria-describedby")).toBeTruthy();
    }
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("adds a trimmed item and closes", async () => {
    const onAdd = renderDialog();
    const { user, dialog } = await openDialog();

    await user.type(within(dialog).getByLabelText("Name"), "  Brass Compass  ");
    await user.type(within(dialog).getByLabelText("Category"), "  Navigation  ");
    await user.type(within(dialog).getByLabelText("Location"), "  Map cabinet  ");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Brass Compass",
        category: "Navigation",
        location: "Map cabinet",
        quantity: 1,
      }),
    );
  });

  test("reopening after a successful add shows cleared inputs and no errors", async () => {
    const added: StashItem[] = [];
    render(
      <AddItemDialog onAdd={(item) => added.push(item)}>
        <button type="button">Add item</button>
      </AddItemDialog>,
    );

    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByLabelText("Name"), "Brass Compass");
    await user.type(within(dialog).getByLabelText("Category"), "Navigation");
    await user.type(within(dialog).getByLabelText("Location"), "Map cabinet");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));
    expect(added).toHaveLength(1);

    const { dialog: reopened } = await openDialog();
    for (const label of ["Name", "Category", "Location"]) {
      expect(within(reopened).getByLabelText(label)).toHaveValue("");
    }
    expect(within(reopened).queryByRole("alert")).not.toBeInTheDocument();
  });
});

/** Guards the state wiring the route uses: adding an item updates the register. */
describe("Add item + register wiring", () => {
  test("a submitted item reaches the inventory list", async () => {
    function Harness() {
      const [items, setItems] = useState<StashItem[]>([]);
      return (
        <>
          <ul aria-label="Added items">
            {items.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
          <AddItemDialog onAdd={(item) => setItems((current) => [...current, item])}>
            <button type="button">Add item</button>
          </AddItemDialog>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("list", { name: "Added items" })).toHaveTextContent("");

    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByLabelText("Name"), "Brass Compass");
    await user.type(within(dialog).getByLabelText("Category"), "Navigation");
    await user.type(within(dialog).getByLabelText("Location"), "Map cabinet");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    expect(screen.getByRole("list", { name: "Added items" })).toHaveTextContent("Brass Compass");
  });
});
