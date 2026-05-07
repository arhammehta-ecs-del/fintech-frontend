import { ChevronRight, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentSidebarDepartment } from "@/features/org-structure/types";

export type { DepartmentSidebarDepartment };

function NodeSidebarContent({
  department,
  breadcrumbs,
  onClose,
  onOpenHistory,
}: {
  department: DepartmentSidebarDepartment | null;
  breadcrumbs: string[];
  onClose: () => void;
  onOpenHistory: () => void;
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
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open organisation history"
            title="View org history"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close department sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1" />
    </div>
  );
}

export function NodeSidebar({
  open,
  onOpenChange,
  department,
  onOpenHistory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentSidebarDepartment | null;
  onOpenHistory: () => void;
}) {
  const breadcrumbs = department?.breadcrumbs?.length ? department.breadcrumbs : [department?.name ?? "Organisation"];

  return (
    <aside
      className={cn(
        "h-full min-w-0 self-stretch overflow-hidden border-l border-slate-200 bg-white transition-[opacity,transform] duration-500",
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      aria-hidden={!open}
    >
      <NodeSidebarContent
        department={department}
        breadcrumbs={breadcrumbs}
        onClose={() => onOpenChange(false)}
        onOpenHistory={onOpenHistory}
      />
    </aside>
  );
}

export default NodeSidebar;
