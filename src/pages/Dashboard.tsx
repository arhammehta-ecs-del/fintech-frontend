import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_SEED_CONFIG, runFrontendSeed, type SeedSummary } from "@/services/seed.service";

export default function Dashboard() {
  const { toast } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [summary, setSummary] = useState<SeedSummary | null>(null);

  const handleSeed = async () => {
    setIsSeeding(true);
    setSummary(null);
    setProgressText("Preparing seed run...");

    try {
      const result = await runFrontendSeed(DEFAULT_SEED_CONFIG, (message) => {
        setProgressText(message);
      });
      setSummary(result);
      toast({
        title: "Seed completed",
        description: `Companies created: ${result.companiesCreated}, Users created: ${result.usersCreated}, Org nodes created: ${result.orgNodesCreated}`,
      });
    } catch (error) {
      toast({
        title: "Seed failed",
        description: error instanceof Error ? error.message : "Unable to seed data",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4">
      <Card className="w-full max-w-2xl border border-slate-200 shadow-sm">
        <CardContent className="py-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Web coming soon!
          </h1>
          <p className="mt-3 text-base text-slate-600">Stay tuned</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button onClick={() => setIsConfirmOpen(true)} disabled={isSeeding}>
              {isSeeding ? "Seeding..." : "Seed"}
            </Button>
          </div>
          {progressText ? (
            <p className="mt-4 text-sm text-slate-600">{progressText}</p>
          ) : null}
          {summary ? (
            <div className="mt-5 space-y-1 text-sm text-slate-700">
              <p>Companies: created {summary.companiesCreated}, approved {summary.companiesApproved}, failed {summary.failedCompanies}</p>
              <p>Users: created {summary.usersCreated}, approved {summary.usersApproved}, failed {summary.failedUsers}</p>
              <p>Org nodes: created {summary.orgNodesCreated}, approved {summary.orgNodesApproved}, failed {summary.failedOrgNodes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Frontend Seed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create demo companies, users, signatories, and org nodes using frontend API calls.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSeeding}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleSeed} disabled={isSeeding}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
