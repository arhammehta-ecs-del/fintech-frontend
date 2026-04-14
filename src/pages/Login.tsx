import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import { getAllCompanies, login } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForceLoginDialog, setShowForceLoginDialog] = useState(false);
  const { setIsAuthenticated, setCurrentUser, setGroups } = useAppContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password.trim()) e.password = "Password is required";
    else if (password.length < 6) e.password = "Min 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getLoginErrorMessage = (error: unknown) => {
    if (!(error instanceof Error)) {
      return "Unable to sign in right now. Please try again.";
    }

    const match = error.message.match(/Request failed:\s*(\d{3})/);
    const statusCode = match ? Number(match[1]) : null;

    switch (statusCode) {
      case 400:
      case 401:
        return "Please check your email and password and try again.";
      case 403:
        return "Your account does not have access to sign in here.";
      case 429:
        return "Too many login attempts. Please wait a moment and try again.";
      case 500:
      case 502:
      case 503:
      case 504:
        return "Server is unavailable right now. Please try again shortly.";
      default:
        return "Unable to sign in right now. Please try again.";
    }
  };

  const submitLogin = async (action = false) => {
    try {
      setIsSubmitting(true);
      const response = await login(email, password, action);
      const companyGroups = await getAllCompanies();
      setIsAuthenticated(true);
      setCurrentUser(response.user);
      setGroups(companyGroups);
      setShowForceLoginDialog(false);
      toast({ title: "Welcome back!", description: "You have been logged in." });
      navigate("/");
    } catch (error) {
      const statusMatch = error instanceof Error ? error.message.match(/Request failed:\s*(\d{3})/) : null;
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;

      if (statusCode === 409 && !action) {
        setShowForceLoginDialog(true);
        return;
      }

      setIsAuthenticated(false);
      setCurrentUser(null);
      setGroups([]);
      toast({
        title: "Login failed",
        description: getLoginErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await submitLogin(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/50 px-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold">Login</CardTitle>
          <CardDescription>Enter your credentials to access the portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showForceLoginDialog} onOpenChange={setShowForceLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User already logged in</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This user is already logged in. Do you want to force login and continue?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForceLoginDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitLogin(true)} disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Force Login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
