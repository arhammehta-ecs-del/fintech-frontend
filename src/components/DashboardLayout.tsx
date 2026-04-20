import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { Building2, LayoutDashboard, List, Settings, LogOut, Menu, Bell, UserPlus, ShieldCheck, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,} from "@/components/ui/dialog";

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
 
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Corporate List", icon: List, path: "/corporates" },
];

const settingsNavItem: NavItem = {
  label: "Company Settings",
  icon: Settings,
  path: "/settings",
};

const TOTAL_TIME = 15 * 60 * 1000;
const WARNING_TIME = 40 * 1000;
const WARNING_SECONDS = WARNING_TIME / 1000;

export default function DashboardLayout() {
  const { setIsAuthenticated, setCurrentUser, setGroups, groups, users, currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSaasOrganisationPage = location.pathname.startsWith("/saas-organisation");

  // Derived notification data
  const pendingCompanies = groups.flatMap(g => g.subsidiaries).filter(s => s.status === "Pending");
  const pendingMembers = users.filter(u => u.status === "Pending");
  const totalNotifications = pendingCompanies.length + pendingMembers.length;

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    inactivityTimerRef.current = null;
    warningTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    try {
      await logout();
    } catch {
      // Continue local logout even if the server session cleanup fails.
    } finally {
      setShowWarning(false);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setGroups([]);
      navigate("/login");
    }
  }, [clearTimers, navigate, setCurrentUser, setGroups, setIsAuthenticated]);

  const openWarning = useCallback(() => {
    setShowWarning(true);
    setCountdown(WARNING_SECONDS);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    setCountdown(WARNING_SECONDS);

    warningTimerRef.current = setTimeout(openWarning, TOTAL_TIME - WARNING_TIME);
    inactivityTimerRef.current = setTimeout(() => {
      void handleLogout();
    }, TOTAL_TIME);
  }, [clearTimers, handleLogout, openWarning]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll"];
    const onActivity = () => resetTimer();

    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      clearTimers();
    };
  }, [clearTimers, resetTimer]);

  const navContent = (compact = false, onNavigate?: () => void) => {
    const renderNavItem = (item: NavItem) => {
      const active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));

      return (
        <div key={item.path}>
          <Link
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!compact && <span>{item.label}</span>}
          </Link>
        </div>
      );
    };

    return (
      <>
        <div className={cn("h-14 flex items-center gap-2 border-b border-border", compact ? "px-4" : "px-4 xl:px-5")}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!compact && <span className="font-semibold text-foreground text-sm">Admin Portal</span>}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => renderNavItem(item))}
        </nav>
        <div className="space-y-1 border-t border-border p-2">
          {renderNavItem(settingsNavItem)}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onNavigate?.();
              void handleLogout();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!compact && <span>Logout</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background xl:bg-muted/20">
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px]">
        <aside
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-border bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(220_35%_96%)_55%,hsl(228_55%_94%)_100%)] transition-all duration-200 md:flex md:flex-col",
            collapsed ? "md:w-14" : "md:w-52 xl:w-60",
          )}
        >
          {navContent(collapsed)}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-4 lg:px-6">
            <div className="flex items-center gap-2">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <div className="flex h-full flex-col bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(220_35%_96%)_55%,hsl(228_55%_94%)_100%)]">
                    {navContent(false, () => setMobileNavOpen(false))}
                  </div>
                </SheetContent>
              </Sheet>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setCollapsed((c) => !c)}>
                <Menu className="h-4 w-4" />
              </Button>
              <div className="md:hidden">
                <p className="text-sm font-semibold text-foreground">Admin Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {totalNotifications > 0 && (
                    <span className="absolute top-0 right-0 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center transform translate-x-1/4 -translate-y-1/4">
                      {totalNotifications > 99 ? '99+' : totalNotifications}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="mr-0 w-[min(22rem,calc(100vw-1rem))] p-0 sm:mr-2" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="font-semibold text-sm">Notifications</span>
                  <Badge variant="secondary" className="text-xs">{totalNotifications} new</Badge>
                </div>
                <ScrollArea className="h-[300px]">
                  {totalNotifications === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <Bell className="h-8 w-8 mb-2 opacity-20" />
                      <span className="text-sm">You're all caught up!</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {/* Pending Companies */}
                      {pendingCompanies.length > 0 && (
                        <div className="px-3 py-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Company Requests</h4>
                          <div className="space-y-1">
                            {pendingCompanies.map(company => (
                              <button
                                key={company.id}
                                onClick={() => navigate("/corporates", { state: { statusFilter: "Pending" } })}
                                className="w-full flex items-start text-left gap-3 px-2 py-2 hover:bg-muted/50 rounded-md transition-colors"
                              >
                                <div className="mt-0.5 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 p-1.5 rounded-full">
                                  <Building2 className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{company.companyName}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">New company onboarding request</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pending Members */}
                      {pendingMembers.length > 0 && (
                        <div className="px-3 py-2 border-t border-border">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Member Requests</h4>
                          <div className="space-y-1">
                            {pendingMembers.map(member => (
                              <button
                                key={member.id}
                                onClick={() =>
                                  navigate("/corporates", {
                                    state: {
                                    statusFilter: "Pending",
                                     },
                                  })
                                }
                                className="w-full flex items-start text-left gap-3 px-2 py-2 hover:bg-muted/50 rounded-md transition-colors"
                              >
                                <div className="mt-0.5 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 p-1.5 rounded-full">
                                  <UserPlus className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">Pending {member.role.toLowerCase()} request for {member.department}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-2 border-t border-border bg-muted/20">
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">Mark all as read</Button>
                </div>
              </PopoverContent>
            </Popover>

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
                      {currentUser?.role && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <ShieldCheck className="h-3 w-3" />
                          {currentUser.role}
                        </div>
                      )}
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
                    onClick={() => {
                      void handleLogout();
                    }}
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
          <main className="flex-1 overflow-auto">
            <div
              className={cn(
                isSaasOrganisationPage
                  ? "w-full"
                  : "mx-auto w-full max-w-[1600px] p-4 pb-8 sm:p-5 lg:p-6 xl:p-8"
              )}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Dialog open={showWarning}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Session expiring soon</DialogTitle>
            <DialogDescription>
              You will be logged out in {countdown} seconds due to inactivity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => void handleLogout()}>
              Logout now
            </Button>
            <Button onClick={resetTimer}>
              Stay signed in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
