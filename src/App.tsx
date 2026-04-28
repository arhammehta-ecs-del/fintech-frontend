import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { DashboardLayout } from "@/features/dashboard-layout";
import { CompanyOnboardingWizard } from "@/features/company-list";
import { SaasOrganisationScreen } from "@/features/org-structure";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CompanyList from "@/pages/CompanyList";
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
        <Route path="/saas-organisation" element={<SaasOrganisationScreen />} />
        <Route path="/companies" element={<CompanyList />} />
        <Route path="/onboarding" element={<CompanyOnboardingWizard />} />
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
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </AppProvider>
);

export default App;
