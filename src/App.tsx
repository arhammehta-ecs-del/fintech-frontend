import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { DashboardLayout } from "@/features/dashboard-layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CompanyList from "@/pages/CompanyList";
import ApiMonitoring from "@/pages/ApiMonitoring";
import CompanySettings from "@/pages/CompanySettings";
import Profile from "@/pages/Profile";


function AppRoutes() {
  const { isAuthenticated, isAuthLoading } = useAppContext();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Validating session...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/companies" element={<CompanyList />} />
        <Route path="/monitoring" element={<ApiMonitoring />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<CompanySettings />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <AppProvider>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </AppProvider>
);

export default App;
