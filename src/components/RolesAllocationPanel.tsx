import { CreditCard, Database, Eye, ShieldCheck, UserCheck, Workflow } from "lucide-react";

const roleGlossary = [
  {
    department: "Transactional Operations",
    icon: CreditCard,
    description: "Primary cash flow and procurement lifecycle.",
    tiers: [
      {
        label: "Admin",
        icon: ShieldCheck,
        rights: [
          "Manage global payout limits & roots",
          "Approve system-wide exceptions",
          "View master audit trails",
        ],
      },
      {
        label: "Manager",
        icon: UserCheck,
        rights: [
          "Approve high-value invoices",
          "Manage vendor terms & batches",
          "View real-time cash flows",
        ],
      },
      {
        label: "Viewer",
        icon: Eye,
        rights: ["View transaction receipts", "Monitor payment statuses"],
      },
    ],
  },
  {
    department: "Master Data & Inventory",
    icon: Database,
    description: "Records and logistics supply chain maintenance.",
    tiers: [
      {
        label: "Admin",
        icon: ShieldCheck,
        rights: [
          "Manage node mapping & hierarchy",
          "Approve bulk record imports",
          "View system data architecture",
        ],
      },
      {
        label: "Manager",
        icon: UserCheck,
        rights: [
          "Manage stock & product catalogs",
          "Approve inventory adjustments",
          "View active node listings",
        ],
      },
      {
        label: "Viewer",
        icon: Eye,
        rights: ["View stock availability", "Search product directories"],
      },
    ],
  },
  {
    department: "Work Management",
    icon: Workflow,
    description: "Team logic and approval hierarchy control.",
    tiers: [
      {
        label: "Admin",
        icon: ShieldCheck,
        rights: [
          "Manage workflow engine & rules",
          "Approve root policy changes",
          "View security policy logs",
        ],
      },
      {
        label: "Manager",
        icon: UserCheck,
        rights: [
          "Manage onboarding & assignments",
          "Approve routing requests",
          "View department org-tree",
        ],
      },
      {
        label: "Viewer",
        icon: Eye,
        rights: ["View team structure", "Monitor workflow status"],
      },
    ],
  },
] as const;

type RolesAllocationPanelProps = {
  userName?: string;
  showUserNote?: boolean;
};

export function RolesAllocationPanel({
  userName,
  showUserNote = false,
}: RolesAllocationPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="space-y-1">
          <h2 className="text-[16px] font-bold text-slate-800 uppercase tracking-tight">
            Functional Rights Mapping
          </h2>
          <p className="text-[12px] text-slate-500">
            Core action guide by departmental access levels.
          </p>
        </div>
      </div>

      {roleGlossary.map((department) => (
        <div
          key={department.department}
          className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm group"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-4 transition-colors group-hover:bg-slate-50">
            <div className="rounded-lg border border-slate-100 bg-white p-2 text-blue-500 shadow-sm">
              <department.icon size={16} />
            </div>
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-800">
                {department.department}
              </h3>
              <p className="text-[11px] font-medium text-slate-400">
                {department.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
            {department.tiers.map((tier) => (
              <div
                key={`${department.department}-${tier.label}`}
                className="p-5 transition-colors hover:bg-slate-50/30"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <div
                    className={`rounded p-1 ${
                      tier.label === "Admin"
                        ? "bg-blue-50 text-blue-600"
                        : tier.label === "Manager"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <tier.icon size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                    {tier.label}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {tier.rights.map((right) => (
                    <li key={right} className="group/li flex items-start gap-2">
                      <div className="mt-1 flex-shrink-0">
                        <div className="h-1 w-1 rounded-full bg-slate-300 transition-colors group-hover/li:bg-blue-500" />
                      </div>
                      <span className="text-[12px] font-medium leading-snug text-slate-600">
                        {right}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showUserNote && userName ? (
        <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="mx-auto max-w-md text-[11px] font-medium leading-relaxed text-slate-500">
            This mapping describes global roles. Active capabilities for{" "}
            <strong>{userName}</strong> are defined specifically within the{" "}
            <span className="font-bold text-blue-600">Access Rights</span> tab.
          </p>
        </div>
      ) : null}
    </div>
  );
}
