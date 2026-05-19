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

  const formatRelativeTime = (occurredAt: string, nowMs: number) => {
    const timestampMs = new Date(occurredAt).getTime();
    if (!Number.isFinite(timestampMs)) return "";
    const diffMs = Math.max(0, nowMs - timestampMs);
    const minutes = Math.floor(diffMs / (60 * 1000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    return new Date(timestampMs).toLocaleString();
  };

  const mapPacketToNotification = (packet: NotificationSsePacket): NotificationItem => {
    const status = mapTypeToStatus(packet.type);
    const entity = mapRefTypeToEntity(packet.refType);
    const displayName = String(packet.name ?? "").trim();
    const createdAt = String(packet.createat_timestamp ?? "").trim() || new Date().toISOString();
    const unread = String(packet.status ?? "").trim().toUpperCase() === "UNREAD";

    return {
      id: String(packet.id ?? `${createdAt}-${Math.random().toString(36).slice(2, 10)}`),
      status,
      title: `${entity} ${status}`,
      entity,
      userName: displayName,
      userEmail: String(packet.message ?? "").trim(),
      initiatedByName: String(packet.createdByname ?? "").trim() || "-",
      initiatedByEmail: String(packet.createdByemail ?? "").trim() || "-",
      occurredAt: createdAt,
      unread,
    };
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pastNotifications, setPastNotifications] = useState<NotificationItem[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const INITIAL_VISIBLE_NOTIFICATIONS = 7;
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const [notificationsPopoverOpen, setNotificationsPopoverOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: (packet) => {
        const incoming = mapPacketToNotification(packet);
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
  const { yesterdayNotifications, olderNotifications } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    return {
      yesterdayNotifications: pastNotifications.filter((item) => {
        const d = new Date(item.occurredAt);
        return d >= startOfYesterday && d < startOfToday;
      }),
      olderNotifications: pastNotifications.filter((item) => new Date(item.occurredAt) < startOfYesterday),
    };
  }, [pastNotifications]);

  const unreadCount = useMemo(
    () => todaysNotifications.reduce((total, item) => total + (item.unread ? 1 : 0), 0),
    [todaysNotifications]
  );
  const visibleNotifications = useMemo(
    () =>
      showAllNotifications
        ? todaysNotifications
        : todaysNotifications.slice(0, INITIAL_VISIBLE_NOTIFICATIONS),
    [showAllNotifications, todaysNotifications]
  );
  const hasMoreNotifications = todaysNotifications.length > INITIAL_VISIBLE_NOTIFICATIONS;
  const hasPastNotifications = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return notifications.some((item) => new Date(item.occurredAt) < startOfToday);
  }, [notifications]);
  const shouldShowSeeAll = !showAllNotifications && (hasMoreNotifications || hasPastNotifications);

  const notificationCountLabel = notifications.length > 99 ? "99+" : String(notifications.length);
  const todayCountLabel = todaysNotifications.length > 99 ? "99+" : String(todaysNotifications.length);
  const unreadCountLabel = unreadCount === 1 ? "1 unread" : `${unreadCount} unread`;

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

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((item) => {
        const d = new Date(item.occurredAt);
        const now = new Date();
        const isToday =
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
        return isToday ? { ...item, unread: false } : item;
      })
    );
  };

  const markAsRead = async (id: string) => {
    const selected = notifications.find((item) => item.id === id);
    if (!selected || !selected.unread) return;

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );

    try {
      await updateNotificationReadStatus({ id, status: "READ" });
    } catch {
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, unread: true } : item))
      );
    }
  };

  const formatPastTimeline = (occurredAt: string) => {
    const parsed = new Date(occurredAt);
    if (Number.isNaN(parsed.getTime())) return "";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const timeLabel = parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (parsed >= startOfYesterday && parsed < startOfToday) {
      return `Yesterday, ${timeLabel}`;
    }
    const dateLabel = parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
    return `${dateLabel}, ${timeLabel}`;
  };

  const handleSeeAllNotifications = async () => {
    setShowAllNotifications(true);
    setNotificationsPopoverOpen(false);
    setAllNotificationsOpen(true);
    setPastLoading(true);
    try {
      const packets = await fetchNotificationPage({
        status: "ALL",
        limit: 10,
        offset: 0,
      });
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const pastOnly = packets
        .map(mapPacketToNotification)
        .filter((item) => new Date(item.occurredAt) < startOfToday)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setPastNotifications(pastOnly);
    } catch {
      setPastNotifications([]);
    } finally {
      setPastLoading(false);
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
              {notifications.length > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                  {notificationCountLabel}
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
                  Notifications ({todayCountLabel})
                </p>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {unreadCountLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Mark all as read
              </button>
            </div>
            <div className="relative max-h-[520px] bg-slate-50/60">
              <div className="max-h-[520px] overflow-y-auto p-3">
                {todaysNotifications.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">All caught up for today</p>
                      <p className="mt-1 text-xs text-slate-500">No notifications from today.</p>
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
                              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-red-100" />
                            ) : null}
                            <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                          </div>
                          <p className="mb-1 text-[11px] font-medium lowercase tracking-wide text-slate-400">
                            {notification.entity.toLowerCase()}
                          </p>
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
                        {formatRelativeTime(notification.occurredAt, nowMs)}
                      </p>
                    </button>
                  );
                })}
                {shouldShowSeeAll ? (
                  <div className="pb-0 pt-0">
                    <div className="pointer-events-none h-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent" />
                    <div className="mt-0 flex justify-center bg-slate-50 pb-1">
                      <button
                        type="button"
                        onClick={() => void handleSeeAllNotifications()}
                        className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        See all notifications
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
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
                <span>Past Notifications</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {yesterdayNotifications.length + olderNotifications.length}
                  </span>
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
              {pastLoading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-700">Loading past notifications...</p>
                </div>
              ) : null}
              {!pastLoading && yesterdayNotifications.length + olderNotifications.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">No past notifications</p>
                    <p className="mt-1 text-xs text-slate-500">Yesterday and older updates will appear here.</p>
                  </div>
                </div>
              ) : null}

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
                            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-red-100" />
                          ) : null}
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        </div>
                        <p className="mb-1 text-[11px] font-medium lowercase tracking-wide text-slate-400">
                          {notification.entity.toLowerCase()}
                        </p>
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
                            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-red-100" />
                          ) : null}
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        </div>
                        <p className="mb-1 text-[11px] font-medium lowercase tracking-wide text-slate-400">
                          {notification.entity.toLowerCase()}
                        </p>
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
