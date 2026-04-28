import { Bell, LogOut, Menu, Settings, ShieldCheck, User, UserPlus } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";
import type { AppUser } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/features/dashboard-layout/components/AppSidebar";

type AppTopBarProps = {
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  onToggleCollapsed: () => void;
  locationPathname: string;
  users: AppUser[];
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
  users,
  currentUser,
  navigate,
  onLogout,
}: AppTopBarProps) {
  const pendingMembers = users.filter((user) => user.status === "Pending");
  const totalNotifications = pendingMembers.length;

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {totalNotifications > 0 ? (
                <span className="absolute top-0 right-0 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center transform translate-x-1/4 -translate-y-1/4">
                  {totalNotifications > 99 ? "99+" : totalNotifications}
                </span>
              ) : null}
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
                  {pendingMembers.length > 0 ? (
                    <div className="px-3 py-2 border-t border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Member Requests</h4>
                      <div className="space-y-1">
                        {pendingMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => navigate("/companies", { state: { statusFilter: "Pending" } })}
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
                  ) : null}
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
