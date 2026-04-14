import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DepartmentSidebarDepartment = {
  id: string;
  name: string;
  parentId?: string | null;
  nodeType?: string;
  nodePath?: string;
  companyId?: string;
  childCount?: number;
  breadcrumbs?: string[];
  parentName?: string | null;
  children?: Array<{ id: string; name: string; nodeType?: string; childCount?: number }>;
  siblings?: Array<{ id: string; name: string; nodeType?: string; childCount?: number }>;
};

type TeamMember = {
  initials: string;
  name: string;
  designation: string;
  reportees?: number;
  depth?: number;
};

type DepartmentRoster = {
  lead: {
    initials: string;
    name: string;
    designation: string;
    reportees: number;
  };
  groups: Array<{
    label: string;
    users: TeamMember[];
  }>;
};

function buildFallbackRoster(department: DepartmentSidebarDepartment): DepartmentRoster {
  const groups =
    department.children?.length
      ? department.children.map((child) => ({
          label: child.name.toUpperCase(),
          users: [
            {
              initials: child.name.slice(0, 1).toUpperCase(),
              name: child.name,
              designation: child.nodeType ?? "Department Node",
              reportees: child.childCount,
              depth: 0,
            },
          ],
        }))
      : [];

  return {
    lead: {
      initials: department.name
        .split(/\s+/)
        .map((part) => part[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      name: department.name,
      designation: department.nodeType ?? "Lead",
      reportees: department.childCount ?? 0,
    },
    groups,
  };
}

function Avatar({ initials, large = false }: { initials: string; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-[#f4efe6] font-medium text-[#7a6f61]",
        large ? "h-12 w-12 text-xl" : "h-10 w-10 text-lg",
      )}
    >
      <span>{initials}</span>
    </div>
  );
}

function LeadCard({ roster }: { roster: DepartmentRoster["lead"] }) {
  return (
    <div className="rounded-[16px] bg-[#2e69ad] px-4 py-4 text-white shadow-[0_14px_28px_rgba(46,105,173,0.2)]">
      <div className="flex items-center gap-4">
        <Avatar initials={roster.initials} large />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{roster.name}</p>
              <p className="mt-0.5 text-[12px] text-white/75">{roster.designation}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full bg-[#23558f] px-3 py-1 text-xs font-medium text-white/85 transition hover:bg-[#1d4979]"
            >
              {roster.reportees} reportees {"›"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({ user }: { user: TeamMember }) {
  return (
    <div
      className="flex items-center gap-4 py-3"
      style={{ paddingLeft: `${(user.depth ?? 0) * 28}px` }}
    >
      <Avatar initials={user.initials} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-slate-900">{user.name}</p>
        <p className="mt-0.5 text-[12px] text-[#87837d]">
          {user.designation}
        </p>
      </div>
    </div>
  );
}

function DepartmentSidebarContent({
  department,
  breadcrumbs,
  roster,
  onClose,
}: {
  department: DepartmentSidebarDepartment | null;
  breadcrumbs: string[];
  roster: DepartmentRoster | null;
  onClose: () => void;
}) {
  const showBreadcrumbs = breadcrumbs.length > 1 || breadcrumbs[0] !== (department?.name ?? "Organisation");

  return (
    <div className="flex h-full min-h-full w-full flex-col">
      <div className="flex shrink-0 items-start justify-between border-b border-black/10 px-6 py-8 lg:py-10">
        <div className="min-w-0">
          {showBreadcrumbs ? (
            <div className="flex items-center gap-1.5 text-[11px] text-[#9a988f]">
              {breadcrumbs.map((crumb, index) => (
                <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#c8c6bc]" /> : null}
                  <span className="truncate">{crumb}</span>
                </div>
              ))}
            </div>
          ) : null}
          <h2 className="mt-3 text-[24px] font-medium leading-none tracking-[-0.03em] text-[#1b1b1b] lg:text-[28px]">
            {department?.name ?? "Organisation"}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close department sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {department && roster ? (
        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
          <LeadCard roster={roster.lead} />

          {roster.groups.map((group) => (
            <section key={group.label} className="mt-8">
              <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-[#a29f96]">{group.label}</p>
              <div className="space-y-1">
                {group.users.map((user) => (
                  <UserRow key={`${group.label}-${user.name}`} user={user} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
          Select a node to inspect the organisation panel.
        </div>
      )}
    </div>
  );
}

export function DepartmentSidebar({
  open,
  onOpenChange,
  department,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentSidebarDepartment | null;
}) {
  const breadcrumbs = department?.breadcrumbs?.length ? department.breadcrumbs : [department?.name ?? "Organisation"];
  const roster = department ? buildFallbackRoster(department) : null;

  return (
    <aside
      className={cn(
        "h-full min-w-0 self-stretch overflow-hidden border-l border-slate-200 bg-white transition-[opacity,transform] duration-500",
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      aria-hidden={!open}
    >
      <DepartmentSidebarContent
        department={department}
        breadcrumbs={breadcrumbs}
        roster={roster}
        onClose={() => onOpenChange(false)}
      />
    </aside>
  );
}

export default DepartmentSidebar;
