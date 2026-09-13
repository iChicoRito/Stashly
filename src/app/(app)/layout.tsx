import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

/**
 * Stashly's own routes live outside the `/template` demo tree but share the
 * template's sidebar and header shell.
 */
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
