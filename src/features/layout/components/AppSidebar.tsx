import { Building2, LayoutDashboard, List, LogOut, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

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

type AppSidebarProps = {
  collapsed?: boolean;
  mobile?: boolean;
  locationPathname: string;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  onLogout: () => void;
};

export function AppSidebar({
  collapsed = false,
  mobile = false,
  locationPathname,
  onToggleCollapsed,
  onNavigate,
  onLogout,
}: AppSidebarProps) {
  const renderNavItem = (item: NavItem) => {
    const active = locationPathname === item.path || (item.path !== "/" && locationPathname.startsWith(item.path));

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
          {!collapsed && <span>{item.label}</span>}
        </Link>
      </div>
    );
  };

  const navContent = (
    <>
      <div className={cn("h-14 flex items-center gap-2 border-b border-border", collapsed ? "px-4" : "px-4 xl:px-5")}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed ? <span className="font-semibold text-foreground text-sm">Admin Portal</span> : null}
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
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed ? <span>Logout</span> : null}
        </button>
      </div>
    </>
  );

  if (mobile) {
    return (
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(220_35%_96%)_55%,hsl(228_55%_94%)_100%)]">
        {navContent}
      </div>
    );
  }

  return (
    <aside
      onClick={onToggleCollapsed}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-border bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(220_35%_96%)_55%,hsl(228_55%_94%)_100%)] transition-all duration-200 md:flex md:flex-col",
        collapsed ? "md:w-14" : "md:w-52 xl:w-60",
      )}
    >
      {navContent}
    </aside>
  );
}

export default AppSidebar;
