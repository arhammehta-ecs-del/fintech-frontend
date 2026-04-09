import { Building2, ChevronRight, FolderTree, GitBranch, MapPinned, X } from "lucide-react";
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
};

interface DepartmentSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentSidebarDepartment | null;
}

function DetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

export function DepartmentSidebar({
  open,
  onOpenChange,
  department,
}: DepartmentSidebarProps) {
  const breadcrumbs = department?.breadcrumbs?.length
    ? department.breadcrumbs
    : [department?.name ?? "Organization Node"];

  return (
    <aside
      className={cn(
        "hidden h-full min-w-0 self-stretch overflow-hidden border-l border-slate-200 bg-white transition-[opacity,transform,border-color] duration-500 lg:block",
        open ? "translate-x-0 border-l-slate-200 opacity-100" : "pointer-events-none translate-x-6 border-l-transparent opacity-0",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "flex h-full min-h-full w-full flex-col transition-[opacity,transform] duration-500",
          open ? "translate-x-0 opacity-100 delay-75" : "translate-x-3 opacity-0",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-black/10 px-5 py-[18px]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-[#888780]">
              {breadcrumbs.map((crumb, index) => (
                <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#b4b2a9]" /> : null}
                  <span className="truncate">{crumb}</span>
                </div>
              ))}
            </div>
            <h2 className="mt-2 text-[28px] font-medium tracking-tight text-[#1a1a1a]">
              {department?.name ?? "Organization Node"}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close department sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {department ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            <DetailCard icon={Building2} label="Node Name" value={department.name} />
            <DetailCard icon={GitBranch} label="Node Type" value={department.nodeType ?? "—"} />
            <DetailCard icon={MapPinned} label="Node Path" value={department.nodePath ?? "—"} />
            <DetailCard icon={FolderTree} label="Children" value={String(department.childCount ?? 0)} />
            {department.companyId ? <DetailCard icon={Building2} label="Company Id" value={department.companyId} /> : null}
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-full flex-1 items-center justify-center p-8">
              <div className="flex min-h-full flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-slate-900">Select a node</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Click any organization node to inspect its live details.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default DepartmentSidebar;
