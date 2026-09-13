import { describe, expect, test } from "vitest";

import { type NavGroup, sidebarItems } from "@/navigation/sidebar/sidebar-items";

function urlsOf(group: NavGroup): string[] {
  return group.items.flatMap((item) => ("url" in item ? [item.url] : (item.subItems ?? []).map((sub) => sub.url)));
}

describe("sidebar navigation", () => {
  test("lists Stashly's own routes first", () => {
    const group = sidebarItems[0];

    expect(group.label).toBe("Stashly");
    expect(group.items.map((item) => item.title)).toEqual(["Dashboard", "Settings"]);
  });

  test("points at the routes the app exports", () => {
    const urls = sidebarItems[0].items.map((item) => ("url" in item ? item.url : undefined));

    expect(urls).toEqual(["/", "/settings"]);
  });

  test("dropped the prototype's Inventory register", () => {
    const titles = sidebarItems[0].items.map((item) => item.title);

    expect(titles.some((title) => title.includes("Inventory"))).toBe(false);
  });

  test("keeps the template's demo routes reachable below Stashly's", () => {
    const templateUrls = sidebarItems
      .slice(1)
      .filter((group) => group.label !== "Developer")
      .flatMap((group) => urlsOf(group));

    expect(templateUrls.length).toBeGreaterThan(10);
    expect(templateUrls.every((url) => url.startsWith("/template"))).toBe(true);
  });

  test("confines the DEV storage probe to the Developer group", () => {
    const developerGroups = sidebarItems.filter((group) => group.label === "Developer");

    for (const group of developerGroups) {
      expect(urlsOf(group)).toEqual(["/dev/storage"]);
    }

    // The group is appended by a conditional spread, so it is present in DEV
    // and absent from a release build. Vitest pins DEV to true even under
    // `--mode production`, so this asserts each environment's expected shape
    // rather than exercising both; the release build's static `false` replaces
    // the spread at bundle time (see sidebar-items.ts).
    expect(developerGroups).toHaveLength(import.meta.env.DEV ? 1 : 0);
  });
});
