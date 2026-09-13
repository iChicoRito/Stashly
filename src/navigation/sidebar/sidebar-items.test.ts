import { describe, expect, test } from "vitest";

import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

describe("sidebar navigation", () => {
  test("lists Stashly's own routes first", () => {
    const group = sidebarItems[0];

    expect(group.label).toBe("Stashly");
    expect(group.items.map((item) => item.title)).toEqual(["Inventory", "Settings"]);
  });

  test("points at the routes the app exports", () => {
    const urls = sidebarItems[0].items.map((item) => ("url" in item ? item.url : undefined));

    expect(urls).toEqual(["/", "/settings"]);
  });

  test("keeps the template's demo routes reachable below Stashly's", () => {
    const templateUrls = sidebarItems
      .slice(1)
      .flatMap((group) => group.items)
      .flatMap((item) => ("url" in item ? [item.url] : (item.subItems ?? []).map((sub) => sub.url)));

    expect(templateUrls.length).toBeGreaterThan(10);
    expect(templateUrls.every((url) => url.startsWith("/template"))).toBe(true);
  });
});
