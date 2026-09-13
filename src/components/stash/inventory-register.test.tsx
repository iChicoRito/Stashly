import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { InventoryRegister } from "@/components/stash/inventory-register";
import { type StashItem, sampleStashItems } from "@/data/stash-items";

/** Mirrors how the route wires the register to its search state. */
function Harness({
  items = sampleStashItems,
  onAddItem = vi.fn(),
}: {
  items?: StashItem[];
  onAddItem?: (item: StashItem) => void;
}) {
  const [query, setQuery] = useState("");
  return <InventoryRegister items={items} query={query} onQueryChange={setQuery} onAddItem={onAddItem} />;
}

function inventoryRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Inventory register", () => {
  test("renders derived totals and semantic table headers", () => {
    render(<Harness />);

    expect(screen.getByText("6", { selector: "[data-summary='items']" })).toBeInTheDocument();
    expect(screen.getByText("25", { selector: "[data-summary='units']" })).toBeInTheDocument();
    expect(screen.getByText("5", { selector: "[data-summary='locations']" })).toBeInTheDocument();
    for (const heading of ["Item", "Category", "Location", "Quantity", "Updated"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
  });

  test.each([
    { query: "  FIELD  ", item: "Field Notes Archive" },
    { query: "AuDiO", item: "Blank Cassette Set" },
    { query: "  STUDIO  ", item: "Polaroid SX-70" },
  ])("filters by name, category, or location with '$query'", async ({ query, item }) => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("searchbox", { name: /search inventory/i }), query);

    const rows = inventoryRows();
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(item)).toBeInTheDocument();
  });

  test("shows a useful no-results state and clears the query", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const search = screen.getByRole("searchbox", { name: /search inventory/i });

    await user.type(search, "not in this stash");

    expect(screen.getByText(/no items match/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear search/i }));

    expect(search).toHaveValue("");
    expect(inventoryRows()).toHaveLength(6);
  });

  test("labels the summary section for assistive technology", () => {
    render(<Harness />);

    expect(screen.getByRole("region", { name: "Inventory summary" })).toBeInTheDocument();
  });
});
