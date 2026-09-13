import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { sampleStashItems } from "@/data/stash-items";
import { useStashStore } from "@/stores/stash/stash-store";

describe("stash store", () => {
  beforeEach(() => {
    useStashStore.setState({
      items: sampleStashItems,
      settings: { collectionName: "My stash", defaultLocation: "Desk drawer" },
      settingsSaved: false,
    });
  });

  test("starts from the sample inventory with nothing saved", () => {
    const state = useStashStore.getState();

    expect(state.items).toHaveLength(6);
    expect(state.settingsSaved).toBe(false);
  });

  test("appends added items", () => {
    useStashStore.getState().addItem({
      id: "brass-compass",
      name: "Brass Compass",
      category: "Navigation",
      location: "Map cabinet",
      quantity: 1,
      updated: "Jun 18, 2026",
    });

    const { items } = useStashStore.getState();
    expect(items).toHaveLength(7);
    expect(items.at(-1)?.name).toBe("Brass Compass");
  });

  test("clears the saved flag on edit and sets it on save", () => {
    useStashStore.getState().saveSettings();
    expect(useStashStore.getState().settingsSaved).toBe(true);

    useStashStore.getState().updateSettings({
      collectionName: "Workshop archive",
      defaultLocation: "North cabinet",
    });

    expect(useStashStore.getState().settingsSaved).toBe(false);
    expect(useStashStore.getState().settings.collectionName).toBe("Workshop archive");
  });

  test("keeps state when the components that read it unmount", () => {
    function Register() {
      const items = useStashStore((state) => state.items);
      return <p>items: {items.length}</p>;
    }

    const first = render(<Register />);
    act(() => {
      useStashStore.getState().addItem({
        id: "brass-compass",
        name: "Brass Compass",
        category: "Navigation",
        location: "Map cabinet",
        quantity: 1,
        updated: "Jun 18, 2026",
      });
    });
    expect(screen.getByText("items: 7")).toBeInTheDocument();

    // Simulates leaving the inventory route and coming back: the module-level
    // store outlives the component, which is what makes the session sticky.
    first.unmount();
    render(<Register />);

    expect(screen.getByText("items: 7")).toBeInTheDocument();
  });
});
