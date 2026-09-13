import { createHashRouter, Outlet } from "react-router";

import RootLayout from "@/app/layout";
import StashlyInventory from "@/app/(app)/page";
import StashlySettings from "@/app/(app)/settings/page";
import NotFound from "@/app/not-found";
import { DashboardShell } from "@/components/layout/dashboard-shell";

import TemplateExternal from "@/app/(template)/template/(external)/page";
import ChatLayout from "@/app/(template)/template/(main)/chat/layout";
import TemplateChat from "@/app/(template)/template/(main)/chat/page";
import MailLayout from "@/app/(template)/template/(main)/mail/layout";
import TemplateMail from "@/app/(template)/template/(main)/mail/page";
import TemplateUnauthorized from "@/app/(template)/template/(main)/unauthorized/page";
import AuthV2Layout from "@/app/(template)/template/(main)/auth/v2/layout";
import AuthV1Login from "@/app/(template)/template/(main)/auth/v1/login/page";
import AuthV1Register from "@/app/(template)/template/(main)/auth/v1/register/page";
import AuthV2Login from "@/app/(template)/template/(main)/auth/v2/login/page";
import AuthV2Register from "@/app/(template)/template/(main)/auth/v2/register/page";

import DashboardAcademy from "@/app/(template)/template/(main)/dashboard/academy/page";
import DashboardAnalytics from "@/app/(template)/template/(main)/dashboard/analytics/page";
import DashboardCalendar from "@/app/(template)/template/(main)/dashboard/calendar/page";
import DashboardChatDemo from "@/app/(template)/template/(main)/dashboard/chat/page";
import DashboardComingSoon from "@/app/(template)/template/(main)/dashboard/coming-soon/page";
import DashboardCrm from "@/app/(template)/template/(main)/dashboard/crm/page";
import DashboardDefault from "@/app/(template)/template/(main)/dashboard/default/page";
import DashboardEcommerce from "@/app/(template)/template/(main)/dashboard/ecommerce/page";
import DashboardFileManager from "@/app/(template)/template/(main)/dashboard/file-manager/page";
import DashboardFinance from "@/app/(template)/template/(main)/dashboard/finance/page";
import DashboardIndex from "@/app/(template)/template/(main)/dashboard/page";
import DashboardInfrastructure from "@/app/(template)/template/(main)/dashboard/infrastructure/page";
import DashboardInvoice from "@/app/(template)/template/(main)/dashboard/invoice/page";
import DashboardKanban from "@/app/(template)/template/(main)/dashboard/kanban/page";
import DashboardLogistics from "@/app/(template)/template/(main)/dashboard/logistics/page";
import DashboardMail from "@/app/(template)/template/(main)/dashboard/mail/page";
import DashboardPatientMonitoring from "@/app/(template)/template/(main)/dashboard/patient-monitoring/page";
import DashboardProductivity from "@/app/(template)/template/(main)/dashboard/productivity/page";
import DashboardProfile from "@/app/(template)/template/(main)/dashboard/profile/page";
import DashboardRoles from "@/app/(template)/template/(main)/dashboard/roles/page";
import DashboardUsers from "@/app/(template)/template/(main)/dashboard/users/page";

import LegacyAnalyticsV1 from "@/app/(template)/template/(main)/dashboard/(legacy)/analytics-v1/page";
import LegacyCrmV1 from "@/app/(template)/template/(main)/dashboard/(legacy)/crm-v1/page";
import LegacyDefaultV1 from "@/app/(template)/template/(main)/dashboard/(legacy)/default-v1/page";
import LegacyFinanceV1 from "@/app/(template)/template/(main)/dashboard/(legacy)/finance-v1/page";

/**
 * Application routes.
 *
 * The file layout is deliberately identical to the old `src/app` tree — route
 * groups such as `(app)`, `(template)` and `(main)` simply stop appearing in
 * URLs, and each `layout.tsx` becomes a nested route element.
 *
 * A hash router is used because the built app is loaded from Tauri's custom
 * protocol, where there is no server to resolve a deep path like `/settings`
 * back to `index.html`. With hashes, every route reloads safely.
 */

/** Stashly's own pages, plus the template's dashboard demos, share the shell. */
const shellRoutes = [
  { index: true, element: <StashlyInventory /> },
  { path: "settings", element: <StashlySettings /> },
  { path: "template/dashboard", element: <DashboardIndex /> },
  { path: "template/dashboard/default", element: <DashboardDefault /> },
  { path: "template/dashboard/crm", element: <DashboardCrm /> },
  { path: "template/dashboard/finance", element: <DashboardFinance /> },
  { path: "template/dashboard/analytics", element: <DashboardAnalytics /> },
  { path: "template/dashboard/productivity", element: <DashboardProductivity /> },
  { path: "template/dashboard/ecommerce", element: <DashboardEcommerce /> },
  { path: "template/dashboard/academy", element: <DashboardAcademy /> },
  { path: "template/dashboard/logistics", element: <DashboardLogistics /> },
  { path: "template/dashboard/infrastructure", element: <DashboardInfrastructure /> },
  { path: "template/dashboard/file-manager", element: <DashboardFileManager /> },
  { path: "template/dashboard/patient-monitoring", element: <DashboardPatientMonitoring /> },
  { path: "template/dashboard/calendar", element: <DashboardCalendar /> },
  { path: "template/dashboard/chat", element: <DashboardChatDemo /> },
  { path: "template/dashboard/kanban", element: <DashboardKanban /> },
  { path: "template/dashboard/invoice", element: <DashboardInvoice /> },
  { path: "template/dashboard/profile", element: <DashboardProfile /> },
  { path: "template/dashboard/users", element: <DashboardUsers /> },
  { path: "template/dashboard/roles", element: <DashboardRoles /> },
  { path: "template/dashboard/mail", element: <DashboardMail /> },
  { path: "template/dashboard/coming-soon", element: <DashboardComingSoon /> },
  { path: "template/dashboard/default-v1", element: <LegacyDefaultV1 /> },
  { path: "template/dashboard/crm-v1", element: <LegacyCrmV1 /> },
  { path: "template/dashboard/finance-v1", element: <LegacyFinanceV1 /> },
  { path: "template/dashboard/analytics-v1", element: <LegacyAnalyticsV1 /> },
];

export const router = createHashRouter([
  {
    element: (
      <RootLayout>
        <Outlet />
      </RootLayout>
    ),
    children: [
      // Full-bleed template screens: they carry their own layouts and no sidebar.
      { path: "template", element: <TemplateExternal /> },
      { path: "template/unauthorized", element: <TemplateUnauthorized /> },
      {
        element: <ChatLayout>
          <Outlet />
        </ChatLayout>,
        children: [{ path: "template/chat", element: <TemplateChat /> }],
      },
      {
        element: <MailLayout>
          <Outlet />
        </MailLayout>,
        children: [{ path: "template/mail", element: <TemplateMail /> }],
      },
      { path: "template/auth/v1/login", element: <AuthV1Login /> },
      { path: "template/auth/v1/register", element: <AuthV1Register /> },
      {
        element: <AuthV2Layout>
          <Outlet />
        </AuthV2Layout>,
        children: [
          { path: "template/auth/v2/login", element: <AuthV2Login /> },
          { path: "template/auth/v2/register", element: <AuthV2Register /> },
        ],
      },

      // Stashly's pages and the template dashboard demos, inside the sidebar shell.
      {
        element: <DashboardShell>
          <Outlet />
        </DashboardShell>,
        children: shellRoutes,
      },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
