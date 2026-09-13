"use client";

import { useMemo, useState } from "react";

import { Archive, Bell, BellOff, CheckCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type AppNotification, notifications as initialNotifications } from "@/data/notifications";
import { cn } from "@/lib/utils";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface NotificationItemProps {
  notification: AppNotification;
  onArchive: (id: string) => void;
  onMarkRead: (id: string) => void;
}

function NotificationItem({ notification, onArchive, onMarkRead }: NotificationItemProps) {
  const isUnread = notification.status === "unread";
  const isArchived = notification.status === "archived";

  return (
    <Item
      size="xs"
      variant={isUnread ? "muted" : "default"}
      onClick={() => {
        if (isUnread) onMarkRead(notification.id);
      }}
      className={cn(isUnread && "cursor-pointer hover:bg-muted")}
    >
      <ItemMedia>
        <span className={cn("size-2 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {notification.title}
          <span className="font-normal text-muted-foreground text-xs">{formatTimeAgo(notification.timestamp)}</span>
        </ItemTitle>
        <ItemDescription className={cn(isUnread && "text-foreground/75")}>{notification.description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {!isArchived && (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Archive notification"
            onClick={(event) => {
              event.stopPropagation();
              onArchive(notification.id);
            }}
          >
            <Archive />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);

  const { active, archived, unreadCount } = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return {
      active: sorted.filter((n) => n.status !== "archived"),
      archived: sorted.filter((n) => n.status === "archived"),
      unreadCount: sorted.filter((n) => n.status === "unread").length,
    };
  }, [notifications]);

  const handleArchive = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "archived" } : n)));
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id && n.status === "unread" ? { ...n, status: "read" } : n)));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative" aria-label={`Notifications (${unreadCount} unread)`}>
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm leading-none">Notifications</h4>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400"
              >
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck />
              Mark all as read
            </Button>
          )}
        </div>
        <Tabs defaultValue="all" className="px-4 pb-4">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            {active.length > 0 ? (
              <ScrollArea className="h-80">
                <ItemGroup className="gap-1 pr-3">
                  {active.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onArchive={handleArchive}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </ItemGroup>
              </ScrollArea>
            ) : (
              <Empty className="mt-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BellOff />
                  </EmptyMedia>
                  <EmptyTitle>You&apos;re all caught up</EmptyTitle>
                  <EmptyDescription>No new notifications to show.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>
          <TabsContent value="archived">
            {archived.length > 0 ? (
              <ScrollArea className="h-80">
                <ItemGroup className="gap-1 pr-3">
                  {archived.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onArchive={handleArchive}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </ItemGroup>
              </ScrollArea>
            ) : (
              <Empty className="mt-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Archive />
                  </EmptyMedia>
                  <EmptyTitle>Nothing archived</EmptyTitle>
                  <EmptyDescription>Notifications you archive will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
