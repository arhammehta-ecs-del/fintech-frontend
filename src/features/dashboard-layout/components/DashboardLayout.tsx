import { useCallback, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/features/dashboard-layout/components/AppSidebar";
import { AppTopBar } from "@/features/dashboard-layout/components/AppTopBar";
import { SessionTimeoutDialog } from "@/features/dashboard-layout/components/SessionTimeoutDialog";
import { useSessionTimeout } from "@/features/dashboard-layout/hooks/useSessionTimeout";
import { useAppContext } from "@/contexts/AppContext";
import { logout } from "@/services/auth.service";
import { cn } from "@/lib/utils";

export default function DashboardLayout() {
  const { setIsAuthenticated, setCurrentUser, users, currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isSaasOrganisationPage = location.pathname.startsWith("/saas-organisation");

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
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px]">
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

      <SessionTimeoutDialog
        open={showWarning}
        countdown={countdown}
        onLogoutNow={logoutNow}
        onStaySignedIn={resetTimer}
      />
    </div>
  );
}
