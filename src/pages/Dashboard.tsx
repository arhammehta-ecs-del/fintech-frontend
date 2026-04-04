import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { CompanyPreviewDialog, type ApprovalEvent } from "@/components/CompanyPreviewDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, XCircle, Clock } from "lucide-react";

type AuditEntry = {
  approvalHistory: ApprovalEvent[];
};

const approvalStatusLabel = {
  Approved: "Approved",
  Pending: "Pending",
  Inactive: "Inactive",
} as const;

export default function Dashboard() {
  const { groups, setGroups } = useAppContext();
  const navigate = useNavigate();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const totalCompanies = groups.reduce((acc, g) => acc + g.subsidiaries.length, 0);
  const pending = groups.reduce((acc, g) => acc + g.subsidiaries.filter(c => c.status === "Pending").length, 0);
  const inactive = groups.reduce((acc, g) => acc + g.subsidiaries.filter(c => c.status === "Inactive").length, 0);

  const stats = [
    { label: "Total Companies", value: totalCompanies, icon: Building2, color: "text-primary", onClick: () => navigate("/corporates", { state: { statusFilter: "Approved" } }) },
    ...(pending > 0 ? [{ label: "Pending", value: pending, icon: Clock, color: "text-warning", onClick: () => navigate("/corporates", { state: { statusFilter: "Pending" } }) }] : []),
    ...(inactive > 0 ? [{ label: "Inactive", value: inactive, icon: XCircle, color: "text-destructive", onClick: () => navigate("/corporates", { state: { statusFilter: "Inactive" } }) }] : []),
  ];

  // Flatten all companies for the recent list
  const allCompanies = groups.flatMap(g => g.subsidiaries);
  const selectedCompany = groups.flatMap((g) => g.subsidiaries).find((company) => company.id === selectedCompanyId) ?? null;
  const selectedGroupName = groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompanyId))?.groupName ?? "";
  const selectedGroupCode = groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompanyId))?.code ?? "";
  const selectedCompanyAudit = useMemo(
    () => (selectedCompany ? ({ approvalHistory: [] } satisfies AuditEntry) : undefined),
    [selectedCompany],
  );

  const handleOpenPreview = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setIsPreviewOpen(true);
  };

  const handleSaveCompany = (updatedCompany: typeof selectedCompany extends null ? never : NonNullable<typeof selectedCompany>) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        subsidiaries: group.subsidiaries.map((company) =>
          company.id === updatedCompany.id ? updatedCompany : company,
        ),
      })),
    );
  };

  const handleToggleCompanyActive = (companyId: string, isActive: boolean) => {
    const selected = groups.flatMap((group) => group.subsidiaries).find((company) => company.id === companyId);
    const nextStatus = isActive ? "Approved" : "Inactive";
    if (!selected || selected.status === nextStatus) return;

    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        subsidiaries: group.subsidiaries.map((company) =>
          company.id === companyId
            ? { ...company, status: nextStatus }
            : company,
        ),
      })),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Saas admin board</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your corporate onboarding portal</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {stats.map(s => (
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
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                    c.status === "Approved" ? "bg-success/10 text-success border-success/20" :
                    c.status === "Pending" ? "bg-warning/10 text-warning border-warning/20" :
                    "bg-destructive/10 text-destructive border-destructive/20"
                  }`}>{c.status}</span>
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
                {allCompanies.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleOpenPreview(c.id)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary hover:underline">{c.companyName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        c.status === "Approved" ? "bg-success/10 text-success border-success/20" :
                        c.status === "Pending" ? "bg-warning/10 text-warning border-warning/20" :
                        "bg-destructive/10 text-destructive border-destructive/20"
                      }`}>{c.status}</span>
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
        companyCode={selectedCompany?.companyCode ?? ""}
        groupName={selectedGroupName}
        groupCode={selectedGroupCode}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSave={handleSaveCompany}
        onToggleActive={handleToggleCompanyActive}
        approvalHistory={selectedCompanyAudit?.approvalHistory ?? []}
        approvalStatusLabel={selectedCompany ? approvalStatusLabel[selectedCompany.status] : undefined}
        onAuditEvent={() => {}}
      />
    </div>
  );
}
