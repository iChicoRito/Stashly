"use client";

import { useState } from "react";

import { InventoryRegister } from "@/components/stash/inventory-register";
import { useStashStore } from "@/stores/stash/stash-store";

export default function Page() {
  const items = useStashStore((state) => state.items);
  const addItem = useStashStore((state) => state.addItem);
  const [query, setQuery] = useState("");

  return <InventoryRegister items={items} query={query} onQueryChange={setQuery} onAddItem={addItem} />;
}
