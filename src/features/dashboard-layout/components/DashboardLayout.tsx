import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/features/dashboard-layout/components/AppSidebar";
import { AppTopBar } from "@/features/dashboard-layout/components/AppTopBar";
import { SessionTimeoutDialog } from "@/features/dashboard-layout/components/SessionTimeoutDialog";
import { useSessionTimeout } from "@/features/dashboard-layout/hooks/useSessionTimeout";
import { useAppContext } from "@/contexts/AppContext";
import { logout } from "@/services/auth.service";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "dashboard-sidebar-collapsed";
const settingsTabTitles: Record<string, string> = {
  org: "Org Structure",
  users: "User Management",
  roles: "Roles",
  workflows: "Workflows",
};

const getPageTitle = (pathname: string, search: string) => {
  if (pathname === "/") return "Seed Control Panel";
  if (pathname === "/companies") return "Company List";
  if (pathname === "/monitoring") return "API Monitoring";
  if (pathname === "/profile") return "My Profile";
  if (pathname === "/settings") {
    const activeTab = new URLSearchParams(search).get("tab") ?? "org";
    const activeTabTitle = settingsTabTitles[activeTab];
    return activeTabTitle ? `Company Settings / ${activeTabTitle}` : "Company Settings";
  }
  return "Admin Portal";
};

export default function DashboardLayout() {
  const { setIsAuthenticated, setCurrentUser, users, currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isCompanyListRoute = location.pathname === "/companies";
  const pageTitle = getPageTitle(location.pathname, location.search);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Continue local logout even if the server session cleanup fails.
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      navigate("/login");
    }
  }, [navigate, setCurrentUser, setIsAuthenticated]);

  const { showWarning, countdown, resetTimer, logoutNow } = useSessionTimeout({
    onTimeout: handleLogout,
  });

  return (
    <div className="min-h-screen bg-background xl:bg-muted/20">
      <div className="flex min-h-screen w-full">
        <AppSidebar
          collapsed={collapsed}
          locationPathname={location.pathname}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
          onLogout={logoutNow}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <AppTopBar
            mobileNavOpen={mobileNavOpen}
            onMobileNavOpenChange={setMobileNavOpen}
            onToggleCollapsed={() => setCollapsed((current) => !current)}
            locationPathname={location.pathname}
            pageTitle={pageTitle}
            users={users}
            currentUser={currentUser}
            navigate={navigate}
            onLogout={logoutNow}
          />

          <main className={`min-h-0 flex-1 ${isCompanyListRoute ? "overflow-hidden" : "overflow-auto"}`}>
            <div
              className={isCompanyListRoute
                ? "flex h-full min-h-0 w-full flex-col overflow-hidden p-3 pb-0 sm:p-4 sm:pb-0 lg:p-5 lg:pb-0 xl:p-6 xl:pb-0"
                : "w-full p-3 pb-6 sm:p-4 sm:pb-7 lg:p-5 lg:pb-8 xl:p-6"}
              data-sidebar-state={collapsed ? "collapsed" : "expanded"}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <SessionTimeoutDialog
        open={showWarning}
        countdown={countdown}
        onLogoutNow={logoutNow}
        onStaySignedIn={resetTimer}
      />
    </div>
  );
}



