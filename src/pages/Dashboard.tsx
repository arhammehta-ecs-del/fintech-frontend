import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { CompanyPreviewDialog, type ApprovalEvent } from "@/components/CompanyPreviewDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, XCircle, Clock } from "lucide-react";

type AuditEntry = {
  approvalHistory: ApprovalEvent[];
};

const COMPANY_AUDIT: Record<string, AuditEntry> = {
  "1a": {
    approvalHistory: [
      { name: "Priya M.", action: "Approved", at: "2026-03-28T08:30:00.000Z" },
      { name: "Rohit S.", action: "Risk cleared", at: "2026-03-27T12:00:00.000Z" },
      { name: "Ananya G.", action: "Submitted", at: "2026-03-26T09:10:00.000Z" },
    ],
  },
  "1b": {
    approvalHistory: [
      { name: "Mehul V.", action: "Pending review", at: "2026-03-30T09:10:00.000Z" },
      { name: "Tata Motors Ops", action: "Submitted", at: "2026-03-29T16:20:00.000Z" },
    ],
  },
  "1c": {
    approvalHistory: [
      { name: "Compliance Board", action: "Rejected", at: "2026-03-25T14:40:00.000Z" },
      { name: "Nidhi K.", action: "Returned for corrections", at: "2026-03-24T11:05:00.000Z" },
      { name: "Tata Chemicals", action: "Company created", at: "2026-03-23T07:45:00.000Z" },
    ],
  },
  "2a": {
    approvalHistory: [
      { name: "Rahul D.", action: "Approved", at: "2026-03-29T13:25:00.000Z" },
      { name: "Aparna J.", action: "Financials verified", at: "2026-03-28T10:15:00.000Z" },
      { name: "Jio Platforms", action: "Company created", at: "2026-03-27T15:55:00.000Z" },
    ],
  },
};

const getAuditEntry = (companyName: string): AuditEntry => ({
  approvalHistory: [
    { name: companyName, action: "Company created", at: "2026-03-31T00:00:00.000Z" },
    { name: companyName, action: "Draft reviewed", at: "2026-03-31T08:30:00.000Z" },
  ],
});

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
  const [auditEntries, setAuditEntries] = useState<Record<string, AuditEntry>>(COMPANY_AUDIT);
  const totalCompanies = groups.reduce((acc, g) => acc + g.subsidiaries.length, 0);
  const pending = groups.reduce((acc, g) => acc + g.subsidiaries.filter(c => c.status === "Pending").length, 0);
  const inactive = groups.reduce((acc, g) => acc + g.subsidiaries.filter(c => c.status === "Inactive").length, 0);

  const stats = [
    { label: "Total Companies", value: totalCompanies, icon: Building2, color: "text-primary", onClick: () => navigate("/corporates", { state: { statusFilter: "Approved" } }) },
    ...(pending > 0 ? [{ label: "Pending", value: pending, icon: Clock, color: "text-warning", onClick: () => navigate("/corporates", { state: { statusFilter: "Pending" } }) }] : []),
    ...(inactive > 0 ? [{ label: "Inactive", value: inactive, icon: XCircle, color: "text-destructive", onClick: () => navigate("/corporates", { state: { statusFilter: "Inactive" } }) }] : []),
  ];

  // Flatten all companies for the recent list
  const allCompanies = groups.flatMap(g => g.subsidiaries.map(s => ({ ...s, groupName: g.groupName })));
  const selectedCompany = groups.flatMap((g) => g.subsidiaries).find((company) => company.id === selectedCompanyId) ?? null;
  const selectedGroupName = groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompanyId))?.groupName ?? "";
  const selectedCompanyAudit = useMemo(
    () => (selectedCompany ? auditEntries[selectedCompany.id] ?? getAuditEntry(selectedCompany.companyName) : undefined),
    [auditEntries, selectedCompany],
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

    const event = {
      name: "Admin Portal",
      action: isActive ? "Approved" : "Marked inactive",
      at: new Date().toISOString(),
    };
    setAuditEntries((previous) => {
      const baseEntry = previous[companyId] ?? getAuditEntry(selected.companyName);
      return {
        ...previous,
        [companyId]: {
          approvalHistory: [event, ...baseEntry.approvalHistory],
        },
      };
    });
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
                    <p className="mt-1 text-sm text-muted-foreground">{c.groupName}</p>
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Group</th>
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.groupName}</td>
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
        groupName={selectedGroupName}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSave={handleSaveCompany}
        onToggleActive={handleToggleCompanyActive}
        approvalHistory={selectedCompanyAudit?.approvalHistory ?? []}
        approvalStatusLabel={selectedCompany ? approvalStatusLabel[selectedCompany.status] : undefined}
        onAuditEvent={(event) => {
          if (!selectedCompany) return;
          setAuditEntries((previous) => {
            const baseEntry = previous[selectedCompany.id] ?? getAuditEntry(selectedCompany.companyName);
            return {
              ...previous,
              [selectedCompany.id]: {
                approvalHistory: [event, ...baseEntry.approvalHistory],
              },
            };
          });
        }}
      />
    </div>
  );
}
