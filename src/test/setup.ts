import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library only registers auto-cleanup when the test framework
// exposes globals, so unmount explicitly between tests.
afterEach(() => {
  cleanup();
});

const noop = () => undefined;

// jsdom has no matchMedia, which shadcn/ui's useIsMobile hook needs to decide
// whether the sidebar renders as a sheet.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no ResizeObserver either, and Radix UI's popper-based components
// (dialog, dropdown, tooltip) use it to follow their trigger.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  } as unknown as typeof ResizeObserver;
}
