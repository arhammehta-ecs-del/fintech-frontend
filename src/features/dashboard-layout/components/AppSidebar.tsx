import { useEffect, useRef, useState } from "react";
import { Activity, Building2, LayoutDashboard, List, LogOut, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Company List", icon: List, path: "/companies" },
  { label: "API Monitoring", icon: Activity, path: "/monitoring" },
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
  const [tooltipsEnabled, setTooltipsEnabled] = useState(!collapsed);
  const previousCollapsedRef = useRef(collapsed);

  useEffect(() => {
    const wasCollapsed = previousCollapsedRef.current;
    previousCollapsedRef.current = collapsed;

    if (!collapsed) {
      setTooltipsEnabled(false);
      return;
    }

    if (wasCollapsed === collapsed) {
      setTooltipsEnabled(true);
      return;
    }

    setTooltipsEnabled(false);
    const timer = window.setTimeout(() => {
      setTooltipsEnabled(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [collapsed]);

  const handleInteractiveClick = () => {
    onNavigate?.();
  };

  const renderNavItem = (item: NavItem) => {
    const active =
      locationPathname === item.path ||
      (item.path !== "/" && locationPathname.startsWith(item.path));

    const linkContent = (
      <Link
        to={item.path}
        onClick={(event) => {
          event.stopPropagation();
          handleInteractiveClick();
        }}
        className={cn(
          "group relative flex items-center rounded-[10px]",
          "text-[13px] font-medium tracking-[0.01em]",
          "transition-all duration-250 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
          /* collapsed: center the icon, tighter padding */
          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
          active
            ? [
                "sidebar-active-item",
                "bg-white/[0.12] text-white",
                collapsed
                  ? "shadow-[0_1px_3px_rgba(0,0,0,0.15),0_2px_8px_rgba(79,70,229,0.12)]"
                  : "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_3px_rgba(0,0,0,0.15),0_4px_16px_rgba(79,70,229,0.15)]",
                "backdrop-blur-xl",
              ].join(" ")
            : cn(
                "text-white/[0.78] hover:text-white hover:bg-white/[0.06]",
                collapsed ? "" : "hover:translate-x-[2px] hover:shadow-[0_0_20px_rgba(99,102,241,0.06)]",
              ),
        )}
      >
        {/* Active left indicator bar — only when expanded */}
        {active && !collapsed && (
          <span
            aria-hidden
            className="sidebar-active-bar absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-300 via-white to-indigo-300"
          />
        )}

        {/* Icon */}
        <span
          className={cn(
            "flex flex-shrink-0 items-center justify-center rounded-lg transition-all duration-250",
            collapsed ? "h-9 w-9" : "h-8 w-8",
            active
              ? "bg-white/[0.15] shadow-[0_0_10px_rgba(255,255,255,0.06)]"
              : "bg-white/[0.04] group-hover:bg-white/[0.08]",
          )}
        >
          <item.icon
            className={cn(
              "h-4 w-4 transition-all duration-250",
              active
                ? "text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                : "text-white/[0.65] group-hover:text-white/90",
            )}
          />
        </span>

        {/* Label — only when expanded */}
        {!collapsed && (
          <span className={cn("truncate transition-colors duration-200", active ? "font-semibold" : "")}>
            {item.label}
          </span>
        )}
      </Link>
    );

    /* Wrap in tooltip when collapsed */
    return (
      <div key={item.path} className="sidebar-nav-item">
        {collapsed ? (
          <Tooltip delayDuration={0} disableHoverableContent open={tooltipsEnabled ? undefined : false}>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="rounded-lg border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xl"
            >
              {item.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          linkContent
        )}
      </div>
    );
  };

  /* ── Section label ───────────────────────────────────────────────────── */
  const SectionLabel = ({ children }: { children: string }) =>
    collapsed ? null : (
      <div className="px-4 pb-1 pt-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">
          {children}
        </span>
      </div>
    );

  /* ── Logout button ───────────────────────────────────────────────────── */
  const logoutButton = (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onNavigate?.();
        onLogout();
      }}
      className={cn(
        "group relative flex w-full items-center rounded-[10px]",
        "text-[13px] font-medium tracking-[0.01em]",
        "transition-all duration-250 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        "text-white/[0.78] hover:text-red-300 hover:bg-red-500/[0.08]",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5 hover:translate-x-[2px]",
      )}
    >
      <span
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.04] transition-all duration-250 group-hover:bg-red-500/[0.1]",
          collapsed ? "h-9 w-9" : "h-8 w-8",
        )}
      >
        <LogOut className="h-4 w-4 text-white/[0.65] transition-all duration-250 group-hover:text-red-300" />
      </span>
      {!collapsed && <span>Logout</span>}
    </button>
  );

  /* ── Sidebar content ─────────────────────────────────────────────────── */
  const navContent = (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <div className="relative z-10 flex h-full flex-col">
        {/* ── Brand header ────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex h-[60px] items-center gap-3 border-b border-white/[0.06]",
            collapsed ? "justify-center px-2" : "px-4 xl:px-5",
          )}
        >
          <div className="sidebar-logo-mark relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400/30 via-white/[0.12] to-violet-500/20 shadow-[0_0_16px_rgba(99,102,241,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm">
            <Building2 className="h-[18px] w-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
          </div>
          {!collapsed && (
            <span className="text-[13px] font-bold tracking-[0.02em] text-white">
              Admin Portal
            </span>
          )}
        </div>

        {/* ── Main navigation ────────────────────────────────────────── */}
        <SectionLabel>Menu</SectionLabel>
        <nav className={cn("flex-1 space-y-0.5", collapsed ? "px-1.5" : "px-2.5")}>
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* ── Footer: settings + logout ───────────────────────────────── */}
        <div className={cn("border-t border-white/[0.06] pb-3 pt-1", collapsed ? "px-1.5" : "px-2.5")}>
          <SectionLabel>System</SectionLabel>
          <div className="space-y-0.5">
            {renderNavItem(settingsNavItem)}
            {collapsed ? (
              <Tooltip delayDuration={0} disableHoverableContent open={tooltipsEnabled ? undefined : false}>
                <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="rounded-lg border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xl"
                >
                  Logout
                </TooltipContent>
              </Tooltip>
            ) : (
              logoutButton
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );

  /* ── Decorative mesh orbs (background visual depth) ──────────────────── */
  const meshOrbs = (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="sidebar-orb-1 absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-400/[0.08] blur-2xl" />
      <div className="sidebar-orb-2 absolute -left-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-violet-500/[0.06] blur-3xl" />
      <div className="sidebar-orb-3 absolute -bottom-4 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-cyan-400/[0.04] blur-2xl" />
    </div>
  );

  /* ── Surface gradient ────────────────────────────────────────────────── */
  const surfaceClasses = [
    "sidebar-shell relative overflow-hidden",
    "bg-[linear-gradient(165deg,hsl(235_45%_22%)_0%,hsl(237_50%_16%)_45%,hsl(240_55%_12%)_100%)]",
    "text-white",
  ].join(" ");

  /* ── Mobile variant ─────────────────────────────────────────────────── */
  if (mobile) {
    return (
      <div className={cn("flex h-full flex-col", surfaceClasses)}>
        {meshOrbs}
        {navContent}
      </div>
    );
  }

  /* ── Desktop variant ────────────────────────────────────────────────── */
  return (
    <aside
      onClick={() => onToggleCollapsed?.()}
      className={cn(
        surfaceClasses,
        "sticky top-0 hidden h-screen shrink-0",
        "border-r border-white/[0.06]",
        "transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] md:flex md:flex-col",
        onToggleCollapsed ? "cursor-pointer" : "",
        collapsed ? "md:w-[60px]" : "md:w-[220px] xl:w-[250px]",
      )}
    >
      {meshOrbs}
      {navContent}
    </aside>
  );
}

export default AppSidebar;
