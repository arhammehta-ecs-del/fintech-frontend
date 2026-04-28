import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Company, type CompanyStatus, type GroupCompany } from "@/contexts/AppContext";
import { CompanyPreviewDialog, } from "@/components/CompanyPreviewDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, XCircle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAllCompanies } from "@/services/company.service";

// Exported/shared types
type CompanyUpdate = Company;

// Internal helper types
type StatCard = {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
};

// Constants
const approvalStatusLabel = {
  Approved: "Approved",
  Pending: "Pending",
  Inactive: "Inactive",
} as const satisfies Record<CompanyStatus, string>;

const statusBadgeClasses: Record<CompanyStatus, string> = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Inactive: "bg-destructive/10 text-destructive border-destructive/20",
};

// Helper functions
const countCompanies = (groups: GroupCompany[]) =>
  groups.reduce((acc, group) => acc + group.subsidiaries.length, 0);

const countByStatus = (groups: GroupCompany[], status: CompanyStatus) =>
  groups.reduce(
    (acc, group) => acc + group.subsidiaries.filter((company) => company.status === status).length,
    0,
  );

const buildStats = (
  totalCompanies: number,
  pending: number,
  inactive: number,
  onNavigateToStatus: (status: CompanyStatus) => void,
): StatCard[] => [
  {
    label: "Total Companies",
    value: totalCompanies,
    icon: Building2,
    color: "text-primary",
    onClick: () => onNavigateToStatus("Approved"),
  },
  ...(pending > 0
    ? [
        {
          label: "Pending",
          value: pending,
          icon: Clock,
          color: "text-warning",
          onClick: () => onNavigateToStatus("Pending"),
        },
      ]
    : []),
  ...(inactive > 0
    ? [
        {
          label: "Inactive",
          value: inactive,
          icon: XCircle,
          color: "text-destructive",
          onClick: () => onNavigateToStatus("Inactive"),
        },
      ]
    : []),
];

const getSelectedContext = (groups: GroupCompany[], selectedCompanyId: string | null) => {
  const selectedParentGroup =
    groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompanyId)) ?? null;
  const selectedCompany =
    selectedParentGroup?.subsidiaries.find((company) => company.id === selectedCompanyId) ?? null;

  return {
    selectedCompany,
    selectedGroupName: selectedParentGroup?.groupName ?? "",
    selectedGroupCode: selectedParentGroup?.code ?? "",
  };
};

const replaceCompanyInGroups = (groups: GroupCompany[], updatedCompany: CompanyUpdate) =>
  groups.map((group) => ({
    ...group,
    subsidiaries: group.subsidiaries.map((company) =>
      company.id === updatedCompany.id ? updatedCompany : company,
    ),
  }));

const updateCompanyStatusInGroups = (
  groups: GroupCompany[],
  companyId: string,
  nextStatus: CompanyStatus,
) =>
  groups.map((group) => ({
    ...group,
    subsidiaries: group.subsidiaries.map((company) =>
      company.id === companyId
        ? { ...company, status: nextStatus }
        : company,
    ),
  }));

// Exported functions
export default function Dashboard() {
  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const navigate = useNavigate();
  const [selectedCompanyId, setSelectedCompanyLocalId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadCompanies() {
      try {
        setIsLoading(true);
        setError(null);
        const companyGroups = await getAllCompanies();
        if (!ignore) {
          setGroups(companyGroups);
        }
      } catch (error) {
        if (!ignore) {
          const statusMatch = error instanceof Error ? error.message.match(/Request failed:\s*(\d{3})/) : null;
          const statusCode = statusMatch ? Number(statusMatch[1]) : null;
          if (statusCode === 401 || statusCode === 403) {
            navigate("/login", { replace: true });
            return;
          }
          setGroups([]);
          setError(error instanceof Error ? error.message : "Failed to load dashboard data");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadCompanies();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  const totalCompanies = countCompanies(groups);
  const pending = countByStatus(groups, "Pending");
  const inactive = countByStatus(groups, "Inactive");
  const stats = buildStats(totalCompanies, pending, inactive, (status) =>
    navigate("/companies", { state: { statusFilter: status } }),
  );

  // Flatten all companies for the recent list
  const allCompanies = groups.flatMap((group) => group.subsidiaries);
  const { selectedCompany, selectedGroupName, selectedGroupCode } = getSelectedContext(
    groups,
    selectedCompanyId,
  );

  const handleOpenPreview = (companyId: string) => {
    setSelectedCompanyLocalId(companyId);
    setIsPreviewOpen(true);
  };

  const handleSaveCompany = (updatedCompany: CompanyUpdate) => {
    setGroups((prevGroups) => replaceCompanyInGroups(prevGroups, updatedCompany));
  };

  const handleToggleCompanyActive = (companyId: string, isActive: boolean) => {
    const selected = groups.flatMap((group) => group.subsidiaries).find((company) => company.id === companyId);
    const nextStatus = isActive ? "Approved" : "Inactive";
    if (!selected || selected.status === nextStatus) return;

    setGroups((prevGroups) => updateCompanyStatusInGroups(prevGroups, companyId, nextStatus));
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
        <Building2 className="mb-4 h-12 w-12 animate-pulse text-muted-foreground/40" />
        <h3 className="text-lg font-medium text-foreground">Loading dashboard</h3>
        <p className="mt-1 text-sm text-muted-foreground">Fetching the latest company overview.</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
        <Building2 className="mb-4 h-12 w-12 text-destructive/40" />
        <h3 className="text-lg font-medium text-foreground">Unable to load dashboard</h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">SaaS admin board</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your corporate onboarding portal</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={s.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Companies */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Recent Companies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {allCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full flex-col gap-3 rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/30"
                onClick={() => handleOpenPreview(c.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">{c.companyName}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusBadgeClasses[c.status]}`}>{c.status}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[640px] w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {allCompanies.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleOpenPreview(c.id)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary hover:underline">{c.companyName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClasses[c.status]}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CompanyPreviewDialog
        company={selectedCompany}
        companyCode={selectedCompany?.companyCode}
        groupName={selectedGroupName}
        groupCode={selectedGroupCode}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSave={handleSaveCompany}
        onToggleActive={handleToggleCompanyActive}
        approvalStatusLabel={selectedCompany?.status}
      />
    </div>
  );
}
