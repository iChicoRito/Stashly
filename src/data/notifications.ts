export type NotificationStatus = "unread" | "read" | "archived";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  status: NotificationStatus;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

export const notifications: AppNotification[] = [
  {
    id: "1",
    title: "New message from Ammar",
    description: "Ammar tagged you in a comment on the dashboard redesign.",
    timestamp: minutesAgo(5),
    status: "unread",
  },
  {
    id: "2",
    title: "Deployment successful",
    description: "Production build v2.4.1 deployed successfully in 42s.",
    timestamp: minutesAgo(34),
    status: "unread",
  },
  {
    id: "3",
    title: "Payment received",
    description: "You received a payment of $1,240.00 from Acme Corp.",
    timestamp: minutesAgo(90),
    status: "unread",
  },
  {
    id: "4",
    title: "Weekly report ready",
    description: "Your weekly analytics report for last week is ready to view.",
    timestamp: minutesAgo(60 * 3),
    status: "read",
  },
  {
    id: "5",
    title: "New follower",
    description: "@designguru started following your workspace.",
    timestamp: minutesAgo(60 * 7),
    status: "read",
  },
  {
    id: "6",
    title: "Storage almost full",
    description: "You have used 85% of your 10 GB storage quota.",
    timestamp: minutesAgo(60 * 26),
    status: "read",
  },
  {
    id: "7",
    title: "Welcome to Studio Admin",
    description: "Thanks for joining. Here is a quick tour of your dashboard.",
    timestamp: minutesAgo(60 * 48),
    status: "archived",
  },
  {
    id: "8",
    title: "Password changed",
    description: "Your account password was changed from a new device.",
    timestamp: minutesAgo(60 * 120),
    status: "archived",
  },
];
