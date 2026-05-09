import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/services/auth.service";
import { getAllCompanies } from "@/services/company.service";
import {
  approveAllPendingOrgNodesForCompany,
  approveAllPendingUsersForCompany,
  DEFAULT_SEED_CONFIG,
  runFrontendSeed,
  seedAllForCompany,
  seedCompanies,
  seedOrgForCompany,
  seedUsersForCompany,
  type SeedSummary,
} from "@/services/seed.service";

type SeedAction = "companies" | "org" | "users" | "approve-users" | "approve-org" | "all" | null;

type ApprovedCompanyOption = {
  id: string;
  label: string;
  companyCode: string;
  brand: string;
  companyIndex: number | null;
};

const MAX_LOG_LINES = 5;

const parseSeedIndex = (brand: string) => {
  const match = brand.trim().toUpperCase().match(/^SEED COMPANY\s+(\d{1,3})$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed - 1;
};

const buildCompanyOptionsFromSession = (
  sessionUser: Awaited<ReturnType<typeof getCurrentUser>>["user"],
): ApprovedCompanyOption[] => {
  const options = new Map<string, ApprovedCompanyOption>();
  for (const group of sessionUser.groups) {
    for (const company of group.companies) {
      const companyCode = company.companyCode?.trim().toUpperCase();
      if (!companyCode) continue;
      const brand = company.brandName?.trim() || company.companyName?.trim() || companyCode;
      if (options.has(companyCode)) continue;
      options.set(companyCode, {
        id: `session-${companyCode}`,
        companyCode,
        brand,
        label: `${brand} (${companyCode})`,
        companyIndex: parseSeedIndex(brand),
      });
    }
  }

  if (options.size === 0 && sessionUser.companyCode?.trim()) {
    const companyCode = sessionUser.companyCode.trim().toUpperCase();
    const brand = sessionUser.brand?.trim() || sessionUser.company?.trim() || companyCode;
    options.set(companyCode, {
      id: `session-${companyCode}`,
      companyCode,
      brand,
      label: `${brand} (${companyCode})`,
      companyIndex: parseSeedIndex(brand),
    });
  }

  return Array.from(options.values());
};

const emptySummary = (): SeedSummary => ({
  companiesCreated: 0,
  companiesApproved: 0,
  orgNodesCreated: 0,
  orgNodesApproved: 0,
  usersCreated: 0,
  usersApproved: 0,
  failedCompanies: 0,
  failedOrgNodes: 0,
  failedUsers: 0,
  errors: [],
});

const mergeSummary = (base: SeedSummary, delta: SeedSummary): SeedSummary => ({
  companiesCreated: base.companiesCreated + delta.companiesCreated,
  companiesApproved: base.companiesApproved + delta.companiesApproved,
  orgNodesCreated: base.orgNodesCreated + delta.orgNodesCreated,
  orgNodesApproved: base.orgNodesApproved + delta.orgNodesApproved,
  usersCreated: base.usersCreated + delta.usersCreated,
  usersApproved: base.usersApproved + delta.usersApproved,
  failedCompanies: base.failedCompanies + delta.failedCompanies,
  failedOrgNodes: base.failedOrgNodes + delta.failedOrgNodes,
  failedUsers: base.failedUsers + delta.failedUsers,
  errors: [...base.errors, ...delta.errors],
});

export default function Dashboard() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [runningAction, setRunningAction] = useState<SeedAction>(null);
  const [summary, setSummary] = useState<SeedSummary | null>(null);
  const [approvedCompanies, setApprovedCompanies] = useState<ApprovedCompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  const selectedCompany = useMemo(
    () => approvedCompanies.find((company) => company.id === selectedCompanyId) ?? null,
    [approvedCompanies, selectedCompanyId],
  );

  const appendProgress = (line: string) => {
    setProgressLines((previous) => {
      const next = [...previous, line];
      return next.slice(-MAX_LOG_LINES);
    });
  };

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progressLines]);

  const loadApprovedCompanies = async () => {
    let options: ApprovedCompanyOption[] = [];
    try {
      const groups = await getAllCompanies();
      for (const group of groups) {
        for (const company of group.subsidiaries) {
          if (company.status !== "Approved" || !company.companyCode) continue;
          const brand = company.brand || company.companyName || company.companyCode;
          options.push({
            id: company.id,
            companyCode: company.companyCode,
            brand,
            label: `${brand} (${company.companyCode})`,
            companyIndex: parseSeedIndex(brand),
          });
        }
      }
    } catch {
      // Non-admin sessions may fail on /admin/groups. Fall back to current-session company access.
    }

    if (options.length === 0) {
      try {
        const session = await getCurrentUser();
        options = buildCompanyOptionsFromSession(session.user);
      } catch {
        options = [];
      }
    }

    setApprovedCompanies(options);
    setSelectedCompanyId((current) => (options.some((option) => option.id === current) ? current : options[0]?.id ?? ""));
  };

  useEffect(() => {
    void loadApprovedCompanies();
  }, []);

  const runAction = async (action: SeedAction, fn: () => Promise<SeedSummary>) => {
    setIsRunning(true);
    setRunningAction(action);
    setSummary(null);
    setProgressLines([]);

    try {
      appendProgress("Preparing seed run...");
      const result = await fn();
      setSummary(result);
      toast({
        title: "Seed completed",
        description: `Companies ${result.companiesCreated}/${result.companiesApproved}, Users ${result.usersCreated}/${result.usersApproved}, Org ${result.orgNodesCreated}/${result.orgNodesApproved}`,
      });
    } catch (error) {
      toast({
        title: "Seed failed",
        description: error instanceof Error ? error.message : "Unable to execute seed",
        variant: "destructive",
      });
    } finally {
      await loadApprovedCompanies();
      setIsRunning(false);
      setRunningAction(null);
    }
  };

  const handleSeedCompanies = () =>
    runAction("companies", async () => {
      const result = await seedCompanies(DEFAULT_SEED_CONFIG, appendProgress);
      await loadApprovedCompanies();
      return result;
    });

  const handleSeedOrg = () => {
    if (!selectedCompany?.companyCode) return;
    void runAction("org", () =>
      seedOrgForCompany(
        selectedCompany.companyCode,
        selectedCompany.companyIndex,
        DEFAULT_SEED_CONFIG,
        appendProgress,
      ),
    );
  };

  const handleSeedUsers = () => {
    if (!selectedCompany?.companyCode) return;
    void runAction("users", () =>
      seedUsersForCompany(
        selectedCompany.companyCode,
        selectedCompany.companyIndex,
        selectedCompany.brand,
        DEFAULT_SEED_CONFIG,
        appendProgress,
      ),
    );
  };

  const handleSeedAll = () => {
    if (!selectedCompany?.companyCode) return;
    void runAction("all", () =>
      seedAllForCompany(
        selectedCompany.companyCode,
        selectedCompany.companyIndex,
        selectedCompany.brand,
        DEFAULT_SEED_CONFIG,
        appendProgress,
      ),
    );
  };

  const handleApprovePendingUsers = () => {
    if (!selectedCompany?.companyCode) return;
    void runAction("approve-users", () =>
      approveAllPendingUsersForCompany(selectedCompany.companyCode, appendProgress),
    );
  };

  const handleApprovePendingOrgNodes = () => {
    if (!selectedCompany?.companyCode) return;
    void runAction("approve-org", () =>
      approveAllPendingOrgNodesForCompany(selectedCompany.companyCode, appendProgress),
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-4xl border border-slate-200 shadow-sm">
        <CardContent className="space-y-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Seed Control Panel</h1>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Seed Companies</p>
                <p className="text-xs text-slate-500">Seeds all companies. No company selection needed.</p>
              </div>
              <Button onClick={handleSeedCompanies} disabled={isRunning}>
                {runningAction === "companies" ? "Seeding Companies..." : "🏢 Seed Companies"}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-900" htmlFor="seed-company-select">
              Company
            </label>
            <select
              id="seed-company-select"
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              disabled={isRunning}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              {approvedCompanies.length === 0 ? <option value="">No approved companies</option> : null}
              {approvedCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button onClick={handleSeedOrg} disabled={isRunning || !selectedCompany}>
                {runningAction === "org" ? "Seeding Org..." : "🌿 Seed Org"}
              </Button>
              <Button onClick={handleSeedUsers} disabled={isRunning || !selectedCompany}>
                {runningAction === "users" ? "Seeding Users..." : "👥 Seed Users"}
              </Button>
              <Button onClick={handleSeedAll} disabled={isRunning || !selectedCompany}>
                {runningAction === "all" ? "Seeding All..." : "🚀 Seed All"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button onClick={handleApprovePendingUsers} disabled={isRunning || !selectedCompany} variant="outline" className="w-full">
                {runningAction === "approve-users" ? "Approving Pending Users..." : "✅ Approve All Pending Users"}
              </Button>
              <Button onClick={handleApprovePendingOrgNodes} disabled={isRunning || !selectedCompany} variant="outline" className="w-full">
                {runningAction === "approve-org" ? "Approving Pending Nodes..." : "✅ Approve All Pending Nodes"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-900">Progress</p>
            <div ref={logRef} className="max-h-32 overflow-y-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              {progressLines.length === 0 ? <p>No progress yet.</p> : progressLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            </div>
          </div>

          {summary ? (
            <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <p>Companies: created {summary.companiesCreated}, approved {summary.companiesApproved}, failed {summary.failedCompanies}</p>
              <p>Org nodes: created {summary.orgNodesCreated}, approved {summary.orgNodesApproved}, failed {summary.failedOrgNodes}</p>
              <p>Users: created {summary.usersCreated}, approved {summary.usersApproved}, failed {summary.failedUsers}</p>
              {summary.errors.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-red-600">Errors ({summary.errors.length})</summary>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-red-50 p-2 text-xs text-red-700">
                    {summary.errors.map((error, index) => (
                      <p key={`${error}-${index}`}>{error}</p>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 p-4">
            <Button
              onClick={() =>
                void runAction("all", () => runFrontendSeed(DEFAULT_SEED_CONFIG, appendProgress))
              }
              disabled={isRunning}
              variant="outline"
              className="w-full"
            >
              {runningAction === "all" ? "Running Legacy Seed..." : "Run Legacy Seed (single-button compatibility)"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
