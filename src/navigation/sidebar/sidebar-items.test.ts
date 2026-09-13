import { describe, expect, test } from "vitest";

import { type NavGroup, sidebarItems } from "@/navigation/sidebar/sidebar-items";

function urlsOf(group: NavGroup): string[] {
  return group.items.flatMap((item) => ("url" in item ? [item.url] : (item.subItems ?? []).map((sub) => sub.url)));
}

describe("sidebar navigation", () => {
  test("lists Stashly's own route first", () => {
    const group = sidebarItems[0];

    expect(group.label).toBe("Stashly");
    expect(group.items.map((item) => item.title)).toEqual(["Dashboard"]);
  });

  test("points at the routes the app exports", () => {
    const urls = sidebarItems[0].items.map((item) => ("url" in item ? item.url : undefined));

    expect(urls).toEqual(["/"]);
  });

  test("dropped the prototype's Inventory register", () => {
    const titles = sidebarItems[0].items.map((item) => item.title);

    expect(titles.some((title) => title.includes("Inventory"))).toBe(false);
  });

  test("keeps the template's demo routes reachable below Stashly's", () => {
    const templateUrls = sidebarItems.slice(1).flatMap((group) => urlsOf(group));

    expect(templateUrls.length).toBeGreaterThan(10);
    expect(templateUrls.every((url) => url.startsWith("/template"))).toBe(true);
  });

  test("carries no entry for a page Stashly does not have", () => {
    // Every entry has to land somewhere: a nav item pointing at a route the router does not
    // export is a dead link in a window with no address bar to fall back on.
    const stashlyUrls = urlsOf(sidebarItems[0]);

    expect(stashlyUrls).not.toContain("/settings");
    expect(stashlyUrls).not.toContain("/dev/storage");
    expect(sidebarItems.some((group) => group.label === "Developer")).toBe(false);
  });
});
