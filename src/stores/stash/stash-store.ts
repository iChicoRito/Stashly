"use client";

import { create } from "zustand";

import { type StashItem, sampleStashItems } from "@/data/stash-items";

export interface StashSettings {
  collectionName: string;
  defaultLocation: string;
}

interface StashState {
  items: StashItem[];
  settings: StashSettings;
  settingsSaved: boolean;
  addItem: (item: StashItem) => void;
  updateSettings: (settings: StashSettings) => void;
  saveSettings: () => void;
}

/**
 * Session-only inventory state.
 *
 * A module-level store keeps the register intact while you move between the
 * inventory and settings routes, and it resets when the app closes because
 * nothing is written to disk.
 */
export const useStashStore = create<StashState>((set) => ({
  items: sampleStashItems,
  settings: { collectionName: "My stash", defaultLocation: "Desk drawer" },
  settingsSaved: false,
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateSettings: (settings) => set({ settings, settingsSaved: false }),
  saveSettings: () => set({ settingsSaved: true }),
}));
