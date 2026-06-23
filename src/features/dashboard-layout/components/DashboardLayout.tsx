import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/features/dashboard-layout/components/AppSidebar";
import { AppTopBar } from "@/features/dashboard-layout/components/AppTopBar";
import { SessionTimeoutDialog } from "@/features/dashboard-layout/components/SessionTimeoutDialog";
import { useSessionTimeout } from "@/features/dashboard-layout/hooks/useSessionTimeout";
import { useAppContext } from "@/contexts/AppContext";
import { logout } from "@/services/auth.service";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "dashboard-sidebar-collapsed";

export default function DashboardLayout() {
  const { setIsAuthenticated, setCurrentUser, users, currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
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

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <AppTopBar
            mobileNavOpen={mobileNavOpen}
            onMobileNavOpenChange={setMobileNavOpen}
            onToggleCollapsed={() => setCollapsed((current) => !current)}
            locationPathname={location.pathname}
            users={users}
            currentUser={currentUser}
            navigate={navigate}
            onLogout={logoutNow}
          />

          <main className="flex-1 overflow-auto">
            <div
              className="w-full p-3 pb-6 sm:p-4 sm:pb-7 lg:p-5 lg:pb-8 xl:p-6"
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
