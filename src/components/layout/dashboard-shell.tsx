"use client";

import { type ReactNode, useEffect, useState } from "react";

import { AccountSwitcher } from "@/app/(template)/template/(main)/dashboard/_components/sidebar/account-switcher";
import { AppSidebar } from "@/app/(template)/template/(main)/dashboard/_components/sidebar/app-sidebar";
import { LayoutControls } from "@/app/(template)/template/(main)/dashboard/_components/sidebar/layout-controls";
import { NotificationPanel } from "@/app/(template)/template/(main)/dashboard/_components/sidebar/notification-panel";
import { SearchDialog } from "@/app/(template)/template/(main)/dashboard/_components/sidebar/search-dialog";
import { ThemeSwitcher } from "@/app/(template)/template/(main)/dashboard/_components/sidebar/theme-switcher";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { users } from "@/data/users";
import { getClientCookie } from "@/lib/cookie.client";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

/**
 * The template's dashboard shell (sidebar + header), extracted so Stashly's own
 * routes can share it instead of duplicating the layout.
 *
 * A static export has no server, so the sidebar preferences the original layout
 * read with `cookies()` now come from the preferences store (which syncs from
 * the DOM), and the remembered open state is restored from the client cookie
 * after mount.
 */
export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(true);
  const sidebarVariant = usePreferencesStore((state) => state.sidebarVariant);
  const sidebarCollapsible = usePreferencesStore((state) => state.sidebarCollapsible);

  useEffect(() => {
    if (getClientCookie("sidebar_state") === "false") setOpen(false);
  }, []);

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant={sidebarVariant ?? PREFERENCE_DEFAULTS.sidebar_variant}
        collapsible={sidebarCollapsible ?? PREFERENCE_DEFAULTS.sidebar_collapsible}
      />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-hidden",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <ThemeSwitcher />
              <NotificationPanel />
              <AccountSwitcher users={users} />
            </div>
          </div>
        </header>
        {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
