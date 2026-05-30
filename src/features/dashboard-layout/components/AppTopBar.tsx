import { useEffect, useMemo, useState } from "react";
import { Bell, LogOut, Menu, Settings, ShieldCheck, User } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/features/dashboard-layout/components/AppSidebar";
import {
  connectNotificationStream,
  fetchNotificationPage,
  type NotificationSsePacket,
  updateNotificationReadStatus,
} from "@/services/notification.service";

type AppTopBarProps = {
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  onToggleCollapsed: () => void;
  locationPathname: string;
  currentUser: {
    name?: string;
    email?: string;
    role?: string;
  } | null;
  navigate: NavigateFunction;
  onLogout: () => void;
};

export function AppTopBar({
  mobileNavOpen,
  onMobileNavOpenChange,
  onToggleCollapsed,
  locationPathname,
  currentUser,
  navigate,
  onLogout,
}: AppTopBarProps) {
  type NotificationStatus = "Initiated" | "Rejected" | "Approved";
  type NotificationEntity = "User" | "Workflow" | "Org" | "Company List";
  type NotificationItem = {
    id: string;
    status: NotificationStatus;
    title: string;
    entity: NotificationEntity;
    userName: string;
    userEmail: string;
    initiatedByName: string;
    initiatedByEmail: string;
    occurredAt: string;
    unread: boolean;
  };

  const mapTypeToStatus = (value?: string): NotificationStatus => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "APPROVE" || normalized === "APPROVED") return "Approved";
    if (normalized === "REJECT" || normalized === "REJECTED") return "Rejected";
    return "Initiated";
  };

  const mapRefTypeToEntity = (value?: string): NotificationEntity => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (normalized === "WORKFLOW") return "Workflow";
    if (normalized === "ORG") return "Org";
    if (normalized === "COMPANYLIST" || normalized === "COMPANY LIST") return "Company List";
    return "User";
  };

  const formatRelativeTime = (occurredAt: string) => {
    const parsed = new Date(occurredAt);
    if (Number.isNaN(parsed.getTime())) return "";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const timeLabel = parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    if (parsed >= startOfToday && parsed < startOfTomorrow) return `Today, ${timeLabel}`;
    if (parsed >= startOfYesterday && parsed < startOfToday) return `Yesterday, ${timeLabel}`;
    return `${parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}, ${timeLabel}`;
  };

  const mapPacketToNotification = (packet: NotificationSsePacket): NotificationItem => {
    const status = mapTypeToStatus(packet.type);
    const entity = mapRefTypeToEntity(packet.refType);
    const title = String(packet.name ?? "").trim();
    const message = String(packet.message ?? "").trim();
    const createdAt = String(packet.createat_timestamp ?? "").trim() || new Date().toISOString();
    const unread = String(packet.status ?? "").trim().toUpperCase() === "UNREAD";

    return {
      id: String(packet.id ?? `${createdAt}-${Math.random().toString(36).slice(2, 10)}`),
      status,
      title: title || `${entity} ${status}`,
      entity,
      userName: message,
      userEmail: "",
      initiatedByName: String(packet.createdByname ?? "").trim() || "-",
      initiatedByEmail: String(packet.createdByemail ?? "").trim() || "-",
      occurredAt: createdAt,
      unread,
    };
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dialogNotifications, setDialogNotifications] = useState<NotificationItem[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogLoadingMore, setDialogLoadingMore] = useState(false);
  const [dialogOffset, setDialogOffset] = useState(0);
  const [dialogHasNextPage, setDialogHasNextPage] = useState(false);
  const [unreadTotalCount, setUnreadTotalCount] = useState(0);
  const [allNotificationCount, setAllNotificationCount] = useState(0);
  const INITIAL_VISIBLE_NOTIFICATIONS = 10;
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const [notificationsPopoverOpen, setNotificationsPopoverOpen] = useState(false);
  const COMPACT_NOTIFICATIONS_LIMIT = 10;
  const DIALOG_PAGE_SIZE = 50;
  const TODAY_ONLY_THRESHOLD = 3;

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: (packet) => {
        const incoming = mapPacketToNotification(packet);
        if (incoming.unread) {
          setUnreadTotalCount((current) => current + 1);
        }
        setNotifications((current) => {
          const withoutDuplicate = current.filter((item) => item.id !== incoming.id);
          return [incoming, ...withoutDuplicate].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
          );
        });
      },
    });

    return disconnect;
  }, []);

  useEffect(() => {
    if (!currentUser?.email) return;

    let isActive = true;
    const loadUnreadNotifications = async () => {
      try {
        const response = await fetchNotificationPage({
          status: "UNREAD",
          limit: COMPACT_NOTIFICATIONS_LIMIT,
          offset: 0,
        });
        if (!isActive) return;
        const nextNotifications = response.data
          .map(mapPacketToNotification)
          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        setNotifications(nextNotifications);
        setUnreadTotalCount(response.count || nextNotifications.length);
      } catch {
        if (!isActive) return;
      }
    };

    void loadUnreadNotifications();

    return () => {
      isActive = false;
    };
  }, [currentUser?.email]);

  const todaysNotifications = useMemo(() => {
    const now = new Date();
    return notifications.filter((item) => {
      const d = new Date(item.occurredAt);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
  }, [notifications]);
  const { todayDialogNotifications, yesterdayNotifications, olderNotifications, upcomingNotifications } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    return {
      todayDialogNotifications: dialogNotifications.filter((item) => {
        const d = new Date(item.occurredAt);
        return d >= startOfToday && d < startOfTomorrow;
      }),
      yesterdayNotifications: dialogNotifications.filter((item) => {
        const d = new Date(item.occurredAt);
        return d >= startOfYesterday && d < startOfToday;
      }),
      olderNotifications: dialogNotifications.filter((item) => new Date(item.occurredAt) < startOfYesterday),
      upcomingNotifications: dialogNotifications.filter((item) => new Date(item.occurredAt) >= startOfTomorrow),
    };
  }, [dialogNotifications]);

  const compactNotifications = useMemo(() => {
    const nonTodayNotifications = notifications.filter((item) => !todaysNotifications.some((today) => today.id === item.id));
    if (todaysNotifications.length <= TODAY_ONLY_THRESHOLD) {
      return [...todaysNotifications, ...nonTodayNotifications].slice(0, COMPACT_NOTIFICATIONS_LIMIT);
    }
    return todaysNotifications.slice(0, COMPACT_NOTIFICATIONS_LIMIT);
  }, [notifications, todaysNotifications]);
  const visibleNotifications = useMemo(
    () => compactNotifications.slice(0, INITIAL_VISIBLE_NOTIFICATIONS),
    [compactNotifications],
  );
  const remainingNotificationCount = Math.max(0, unreadTotalCount - compactNotifications.length);
  const shouldShowSeeAll = unreadTotalCount > compactNotifications.length;

  const unreadCountBadgeLabel = unreadTotalCount > 99 ? "99+" : String(unreadTotalCount);
  const notificationCountLabel = unreadTotalCount > 99 ? "99+" : String(unreadTotalCount || notifications.length);
  const unreadCountLabel = unreadTotalCount === 1 ? "1 unread" : `${unreadTotalCount} unread`;

  const statusStyles: Record<
    NotificationStatus,
    { unreadBorder: string; readBorder: string; badge: string }
  > = {
    Initiated: {
      unreadBorder: "border-l-blue-500",
      readBorder: "border-l-blue-500/40",
      badge: "bg-blue-100/70 text-blue-700 border-transparent",
    },
    Rejected: {
      unreadBorder: "border-l-red-500",
      readBorder: "border-l-red-500/40",
      badge: "bg-red-100/70 text-red-700 border-transparent",
    },
    Approved: {
      unreadBorder: "border-l-emerald-500",
      readBorder: "border-l-emerald-500/40",
      badge: "bg-emerald-100/70 text-emerald-700 border-transparent",
    },
  };

  const markAllAsRead = async () => {
    const unreadIds = Array.from(
      new Set([...notifications, ...dialogNotifications].filter((item) => item.unread).map((item) => item.id))
    );
    if (unreadIds.length === 0) return;

    const previousNotifications = notifications;
    const previousDialogNotifications = dialogNotifications;
    const previousUnreadTotalCount = unreadTotalCount;
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
    setDialogNotifications((current) => current.map((item) => ({ ...item, unread: false })));
    setUnreadTotalCount(0);

    try {
      await Promise.all(
        unreadIds.map((id) =>
          updateNotificationReadStatus({
            id,
            status: "READ",
          })
        )
      );
    } catch {
      setNotifications(previousNotifications);
      setDialogNotifications(previousDialogNotifications);
      setUnreadTotalCount(previousUnreadTotalCount);
    }
  };

  const markAsRead = async (id: string) => {
    const selected = notifications.find((item) => item.id === id) || dialogNotifications.find((item) => item.id === id);
    if (!selected || !selected.unread) return;

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );
    setDialogNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );
    setUnreadTotalCount((current) => Math.max(0, current - 1));

    try {
      await updateNotificationReadStatus({ id, status: "READ" });
    } catch {
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, unread: true } : item))
      );
      setDialogNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, unread: true } : item))
      );
      setUnreadTotalCount((current) => current + 1);
    }
  };

  const formatPastTimeline = (occurredAt: string) => {
    const parsed = new Date(occurredAt);
    if (Number.isNaN(parsed.getTime())) return "";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const timeLabel = parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    if (parsed >= startOfToday && parsed < startOfTomorrow) {
      return `Today, ${timeLabel}`;
    }
    if (parsed >= startOfYesterday && parsed < startOfToday) {
      return `Yesterday, ${timeLabel}`;
    }
    const dateLabel = parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
    return `${dateLabel}, ${timeLabel}`;
  };

  const handleSeeAllNotifications = async () => {
    setNotificationsPopoverOpen(false);
    setAllNotificationsOpen(true);
    setDialogLoading(true);
    setDialogLoadingMore(false);
    try {
      const response = await fetchNotificationPage({
        status: "ALL",
        limit: DIALOG_PAGE_SIZE,
        offset: compactNotifications.length,
      });
      const compactIds = new Set(compactNotifications.map((item) => item.id));
      const pagedNotifications = response.data
        .map(mapPacketToNotification)
        .filter((item) => !compactIds.has(item.id))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setDialogNotifications(
        [...compactNotifications, ...pagedNotifications]
          .filter((item, index, array) => array.findIndex((match) => match.id === item.id) === index)
          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      );
      setAllNotificationCount(response.count || compactNotifications.length + response.data.length);
      setDialogOffset(compactNotifications.length + response.data.length);
      setDialogHasNextPage(
        response.hasNextPage || compactNotifications.length + response.data.length < (response.count || allNotificationCount)
      );
    } catch {
      setDialogNotifications([...compactNotifications]);
      setDialogHasNextPage(false);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleSeeMoreNotifications = async () => {
    if (dialogLoadingMore || !dialogHasNextPage) return;
    setDialogLoadingMore(true);
    try {
      const response = await fetchNotificationPage({
        status: "ALL",
        limit: DIALOG_PAGE_SIZE,
        offset: dialogOffset,
      });
      const nextBatch = response.data
        .map(mapPacketToNotification)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setDialogNotifications((current) =>
        [...current, ...nextBatch]
          .filter((item, index, array) => array.findIndex((match) => match.id === item.id) === index)
          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      );
      const nextOffset = dialogOffset + response.data.length;
      setDialogOffset(nextOffset);
      setDialogHasNextPage(response.hasNextPage || nextOffset < (response.count || allNotificationCount));
      setAllNotificationCount((current) => Math.max(current, response.count || current));
    } finally {
      setDialogLoadingMore(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <Sheet open={mobileNavOpen} onOpenChange={onMobileNavOpenChange}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebar
              mobile
              locationPathname={locationPathname}
              onNavigate={() => onMobileNavOpenChange(false)}
              onLogout={onLogout}
            />
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={onToggleCollapsed}>
          <Menu className="h-4 w-4" />
        </Button>
        <div className="md:hidden">
          <p className="text-sm font-semibold text-foreground">Admin Portal</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Popover open={notificationsPopoverOpen} onOpenChange={setNotificationsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadTotalCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                  {unreadCountBadgeLabel}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="mr-0 w-[min(460px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:mr-2"
            align="end"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <p className="text-[1.05rem] font-semibold tracking-tight text-slate-900">
                  Notifications ({notificationCountLabel})
                </p>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {unreadCountLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Mark all as read
              </button>
            </div>
            <div className="flex h-[520px] flex-col bg-slate-50/60">
              <div className="flex-1 overflow-y-auto p-3">
                {compactNotifications.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">All caught up</p>
                      <p className="mt-1 text-xs text-slate-500">No recent notifications available.</p>
                    </div>
                  </div>
                ) : visibleNotifications.map((notification, index) => {
                  const styles = statusStyles[notification.status];
                  const isLastVisibleNotification = index === visibleNotifications.length - 1;
                  return (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => void markAsRead(notification.id)}
                      className={`w-full overflow-hidden rounded-xl border border-l-4 ${
                        notification.unread ? styles.unreadBorder : styles.readBorder
                      } bg-transparent px-4 py-4 text-left shadow-sm transition-colors ${
                        notification.unread
                          ? "border-slate-300 bg-slate-100/70 hover:bg-slate-100"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${isLastVisibleNotification ? "" : "mb-3"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            {notification.unread ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                            ) : null}
                            <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                          </div>
                          <p className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">
                            <span>{notification.userName}</span>{" "}
                            <span className="font-normal text-slate-500">{notification.userEmail}</span>
                          </p>
                          <p className="mt-1 text-xs leading-[1.35] text-slate-500">Initiated by {notification.initiatedByName}</p>
                          <p className="mt-0.5 text-xs leading-[1.35] text-slate-500">({notification.initiatedByEmail})</p>
                        </div>
                        <div className="shrink-0">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
                          >
                            {notification.status}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-right text-xs font-medium text-slate-500">
                        {formatRelativeTime(notification.occurredAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
              {shouldShowSeeAll ? (
                <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => void handleSeeAllNotifications()}
                    className="w-full rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    See all notifications {remainingNotificationCount > 0 ? `+${remainingNotificationCount}` : ""}
                  </button>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
        <Dialog open={allNotificationsOpen} onOpenChange={setAllNotificationsOpen}>
          <DialogContent
            showCloseButton={false}
            className="h-[88vh] w-[min(94vw,720px)] max-w-[720px] overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl"
          >
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className="flex items-center justify-between text-slate-900">
                <span>
                  All Notifications ({allNotificationCount || (todayDialogNotifications.length + yesterdayNotifications.length + olderNotifications.length + upcomingNotifications.length)})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    Mark all as read
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllNotificationsOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close notifications"
                  >
                    ×
                  </button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
              {dialogLoading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-700">Loading past notifications...</p>
                </div>
              ) : null}
              {!dialogLoading &&
              todayDialogNotifications.length + yesterdayNotifications.length + olderNotifications.length + upcomingNotifications.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">No notifications</p>
                    <p className="mt-1 text-xs text-slate-500">Latest updates will appear here.</p>
                  </div>
                </div>
              ) : null}

              {todayDialogNotifications.length > 0 ? (
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Today</p>
              ) : null}
              {todayDialogNotifications.map((notification) => {
                const styles = statusStyles[notification.status];
                return (
                  <button
                    type="button"
                    key={`today-${notification.id}`}
                    onClick={() => void markAsRead(notification.id)}
                    className={`w-full overflow-hidden rounded-xl border border-l-4 ${
                      notification.unread ? styles.unreadBorder : styles.readBorder
                    } bg-transparent px-4 py-4 text-left shadow-sm transition-colors ${
                      notification.unread
                        ? "border-slate-300 bg-slate-100/70 hover:bg-slate-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {notification.unread ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                          ) : null}
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        </div>
                        <p className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">
                          <span>{notification.userName}</span>{" "}
                          <span className="font-normal text-slate-500">{notification.userEmail}</span>
                        </p>
                        <p className="mt-1 text-xs leading-[1.35] text-slate-500">
                          Initiated by {notification.initiatedByName}
                        </p>
                        <p className="mt-0.5 text-xs leading-[1.35] text-slate-500">
                          ({notification.initiatedByEmail})
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
                        >
                          {notification.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-right text-xs font-medium text-slate-500">{formatPastTimeline(notification.occurredAt)}</p>
                  </button>
                );
              })}

              {yesterdayNotifications.length > 0 ? (
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Yesterday</p>
              ) : null}
              {yesterdayNotifications.map((notification) => {
                const styles = statusStyles[notification.status];
                return (
                  <button
                    type="button"
                    key={`yesterday-${notification.id}`}
                    onClick={() => void markAsRead(notification.id)}
                    className={`w-full overflow-hidden rounded-xl border border-l-4 ${
                      notification.unread ? styles.unreadBorder : styles.readBorder
                    } bg-transparent px-4 py-4 text-left shadow-sm transition-colors ${
                      notification.unread
                        ? "border-slate-300 bg-slate-100/70 hover:bg-slate-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {notification.unread ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                          ) : null}
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        </div>
                        <p className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">
                          <span>{notification.userName}</span>{" "}
                          <span className="font-normal text-slate-500">{notification.userEmail}</span>
                        </p>
                        <p className="mt-1 text-xs leading-[1.35] text-slate-500">
                          Initiated by {notification.initiatedByName}
                        </p>
                        <p className="mt-0.5 text-xs leading-[1.35] text-slate-500">
                          ({notification.initiatedByEmail})
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
                        >
                          {notification.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-right text-xs font-medium text-slate-500">{formatPastTimeline(notification.occurredAt)}</p>
                  </button>
                );
              })}

              {olderNotifications.length > 0 ? (
                <p className="pt-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Earlier</p>
              ) : null}
              {olderNotifications.map((notification) => {
                const styles = statusStyles[notification.status];
                return (
                  <button
                    type="button"
                    key={`older-${notification.id}`}
                    onClick={() => void markAsRead(notification.id)}
                    className={`w-full overflow-hidden rounded-xl border border-l-4 ${
                      notification.unread ? styles.unreadBorder : styles.readBorder
                    } bg-transparent px-4 py-4 text-left shadow-sm transition-colors ${
                      notification.unread
                        ? "border-slate-300 bg-slate-100/70 hover:bg-slate-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {notification.unread ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                          ) : null}
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        </div>
                        <p className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">
                          <span>{notification.userName}</span>{" "}
                          <span className="font-normal text-slate-500">{notification.userEmail}</span>
                        </p>
                        <p className="mt-1 text-xs leading-[1.35] text-slate-500">
                          Initiated by {notification.initiatedByName}
                        </p>
                        <p className="mt-0.5 text-xs leading-[1.35] text-slate-500">
                          ({notification.initiatedByEmail})
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
                        >
                          {notification.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-right text-xs font-medium text-slate-500">{formatPastTimeline(notification.occurredAt)}</p>
                  </button>
                );
              })}

              {upcomingNotifications.length > 0 ? (
                <p className="pt-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Upcoming</p>
              ) : null}
              {upcomingNotifications.map((notification) => {
                const styles = statusStyles[notification.status];
                return (
                  <button
                    type="button"
                    key={`upcoming-${notification.id}`}
                    onClick={() => void markAsRead(notification.id)}
                    className={`w-full overflow-hidden rounded-xl border border-l-4 ${
                      notification.unread ? styles.unreadBorder : styles.readBorder
                    } bg-transparent px-4 py-4 text-left shadow-sm transition-colors ${
                      notification.unread
                        ? "border-slate-300 bg-slate-100/70 hover:bg-slate-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {notification.unread ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                          ) : null}
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        </div>
                        <p className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">
                          <span>{notification.userName}</span>{" "}
                          <span className="font-normal text-slate-500">{notification.userEmail}</span>
                        </p>
                        <p className="mt-1 text-xs leading-[1.35] text-slate-500">
                          Initiated by {notification.initiatedByName}
                        </p>
                        <p className="mt-0.5 text-xs leading-[1.35] text-slate-500">
                          ({notification.initiatedByEmail})
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
                        >
                          {notification.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-right text-xs font-medium text-slate-500">{formatPastTimeline(notification.occurredAt)}</p>
                  </button>
                );
              })}
              {dialogHasNextPage ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSeeMoreNotifications()}
                    disabled={dialogLoadingMore}
                    className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {dialogLoadingMore ? "Loading..." : "See more"}
                  </button>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
              aria-label="Open profile details"
            >
              {(currentUser?.name || currentUser?.email || "U").charAt(0).toUpperCase()}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border-border bg-white p-0 text-foreground shadow-2xl"
          >
            <div className="border-b border-border bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {(currentUser?.name || currentUser?.email || "User")
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.05rem] font-semibold leading-5 text-foreground">{currentUser?.name || "User"}</p>
                  <p className="truncate pt-0.5 text-sm text-muted-foreground">{currentUser?.email || "No email available"}</p>
                  {currentUser?.role ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      <ShieldCheck className="h-3 w-3" />
                      {currentUser.role}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-muted/20 p-4">
              {[
                { label: "My profile", icon: User, tone: "text-blue-700 bg-blue-50 border-blue-100" },
                { label: "Company Settings", icon: Settings, tone: "text-zinc-700 bg-zinc-100 border-zinc-200" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="rounded-2xl border border-border bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => {
                    if (item.label === "My profile") {
                      navigate("/profile");
                      return;
                    }
                    if (item.label === "Company Settings") {
                      navigate("/settings");
                    }
                  }}
                >
                  <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.tone}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                </button>
              ))}
            </div>

            <div className="border-t border-border bg-white px-4 py-3">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left transition hover:bg-red-50"
                onClick={onLogout}
              >
                <span className="flex items-center gap-3 text-red-400">
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">Log out</span>
                </span>
                <span className="text-xs text-red-300/80">End session</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

export default AppTopBar;
