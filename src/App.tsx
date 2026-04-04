import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import DashboardLayout from "@/components/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import CorporateList from "@/pages/CorporateList";
import OnboardingWizard from "@/pages/OnboardingWizard";
import CompanySettings from "@/pages/CompanySettings";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAppContext();
  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AuthGate><DashboardLayout /></AuthGate>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/corporates" element={<CorporateList />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<CompanySettings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
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
