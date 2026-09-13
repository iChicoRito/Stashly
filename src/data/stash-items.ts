export interface StashItem {
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  updated: string;
}

/** Sample inventory for the starter. Nothing here is persisted to disk. */
export const sampleStashItems: StashItem[] = [
  {
    id: "field-notes",
    name: "Field Notes Archive",
    category: "Stationery",
    location: "Desk drawer",
    quantity: 8,
    updated: "Jun 18, 2026",
  },
  {
    id: "screwdrivers",
    name: "Precision Screwdriver Set",
    category: "Tools",
    location: "Workshop",
    quantity: 1,
    updated: "Jun 16, 2026",
  },
  {
    id: "polaroid",
    name: "Polaroid SX-70",
    category: "Cameras",
    location: "Studio",
    quantity: 1,
    updated: "Jun 14, 2026",
  },
  {
    id: "linen-thread",
    name: "Waxed Linen Thread",
    category: "Craft",
    location: "Supply cabinet",
    quantity: 6,
    updated: "Jun 10, 2026",
  },
  {
    id: "cassettes",
    name: "Blank Cassette Set",
    category: "Audio",
    location: "Media shelf",
    quantity: 5,
    updated: "Jun 08, 2026",
  },
  {
    id: "cable-ties",
    name: "Reusable Cable Ties",
    category: "Tools",
    location: "Workshop",
    quantity: 4,
    updated: "Jun 03, 2026",
  },
];
