import { ChevronRight, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentSidebarDepartment } from "@/features/org-structure/types";
import type { AppUser } from "@/contexts/AppContext";

export type { DepartmentSidebarDepartment };

type PermissionAction = "checker" | "maker" | "viewer";
type PermissionMatrixRow = {
  label: string;
  counts: Record<PermissionAction, number>;
};
type BreadcrumbItem = {
  label: string;
  isEllipsis?: boolean;
};

const ACTIONS: PermissionAction[] = ["checker", "maker", "viewer"];
const SYSTEM_ROWS: Array<{ key: string; label: string }> = [
  { key: "ORG_STR", label: "Org Structure" },
  { key: "USER_ACC", label: "User Access" },
  { key: "WORK_FLOW", label: "Workflow" },
];

const normalizeSubCategory = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ORG_STRUCTURE") return "ORG_STR";
  if (normalized === "USER_ACCESS" || normalized === "USER_MANAGEMENT") return "USER_ACC";
  if (normalized === "WORKFLOW") return "WORK_FLOW";
  return normalized;
};

const getActionFromRoleName = (roleName: string): PermissionAction | null => {
  const normalized = roleName.trim().toLowerCase();
  if (normalized.endsWith("manager") || normalized.endsWith("checker")) return "checker";
  if (normalized.endsWith("user") || normalized.endsWith("maker")) return "maker";
  if (normalized.endsWith("viewer")) return "viewer";
  return null;
};

const initRowCounts = (): Record<PermissionAction, number> => ({
  checker: 0,
  maker: 0,
  viewer: 0,
});

const buildCompactBreadcrumbs = (breadcrumbs: string[]): BreadcrumbItem[] => {
  const clean = breadcrumbs.map((crumb) => crumb.trim()).filter(Boolean);
  if (clean.length <= 4) return clean.map((label) => ({ label }));

  return [
    { label: clean[0] },
    { label: "...", isEllipsis: true },
    ...clean.slice(-3).map((label) => ({ label })),
  ];
};

const buildPermissionMatrix = (
  users: AppUser[],
  department: DepartmentSidebarDepartment | null,
): PermissionMatrixRow[] => {
  const defaultRows = SYSTEM_ROWS.map((row) => ({ label: row.label, counts: initRowCounts() }));
  if (!department?.nodePath) return defaultRows;

  const matrixBySubCategory = new Map<string, Record<PermissionAction, Set<string>>>();
  SYSTEM_ROWS.forEach((row) => {
    matrixBySubCategory.set(row.key, { checker: new Set<string>(), maker: new Set<string>(), viewer: new Set<string>() });
  });

  users
    .filter((user) => (user.status || "").trim().toUpperCase() === "ACTIVE")
    .forEach((user) => {
      const userKey = (user.email || user.id || "").trim();
      if (!userKey) return;

      (user.accessDetails || []).forEach((entry) => {
        if ((entry.roleCategory || "").trim().toUpperCase() !== "SYSTEM_ACCESS") return;
        if ((entry.nodePath || "").trim() !== department.nodePath) return;

        const subCategory = normalizeSubCategory(entry.roleSubCategory || "");
        const action = getActionFromRoleName(entry.roleName || "");
        if (!action) return;
        const countsByAction = matrixBySubCategory.get(subCategory);
        if (!countsByAction) return;
        countsByAction[action].add(userKey);
      });
    });

  return SYSTEM_ROWS.map((row) => {
    const countsByAction = matrixBySubCategory.get(row.key);
    return {
      label: row.label,
      counts: {
        checker: countsByAction?.checker.size ?? 0,
        maker: countsByAction?.maker.size ?? 0,
        viewer: countsByAction?.viewer.size ?? 0,
      },
    };
  });
};

function NodeSidebarContent({
  department,
  breadcrumbs,
  users,
  usersLoading,
  onNavigateToUsers,
  onClose,
  onOpenHistory,
}: {
  department: DepartmentSidebarDepartment | null;
  breadcrumbs: string[];
  users: AppUser[];
  usersLoading: boolean;
  onNavigateToUsers: (input: { nodeName: string; category: string; subCategory: string; action: PermissionAction }) => void;
  onClose: () => void;
  onOpenHistory: () => void;
}) {
  const showBreadcrumbs = breadcrumbs.length > 1 || breadcrumbs[0] !== (department?.name ?? "Organisation");
  const compactBreadcrumbs = buildCompactBreadcrumbs(breadcrumbs);
  const permissionRows = buildPermissionMatrix(users, department);

  return (
    <div className="flex h-full min-h-full w-full flex-col">
      <div className="shrink-0 border-b border-black/10 px-6 pb-6 pt-4 lg:pt-5">
        <div className="mb-3 flex items-start justify-end gap-2">
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

        <div className="min-w-0">
          {showBreadcrumbs ? (
            <div className="flex items-center gap-1.5 text-[11px] text-[#9a988f]">
              {compactBreadcrumbs.map((crumb, index) => (
                <div key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#c8c6bc]" /> : null}
                  <span className={cn("truncate", crumb.isEllipsis ? "text-[#b6b4aa]" : undefined)}>{crumb.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] gap-2 border-b border-slate-200 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <span>System Access</span>
            <span className="text-center">Checker</span>
            <span className="text-center">Maker</span>
            <span className="text-center">Viewer</span>
          </div>

          {usersLoading ? (
            <div className="px-3 py-4 text-xs text-slate-500">Loading access counts...</div>
          ) : (
            permissionRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-center gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0"
              >
                <span className="truncate text-sm font-medium text-slate-700">{row.label}</span>
                {ACTIONS.map((action) => (
                  <button
                    type="button"
                    key={`${row.label}-${action}`}
                    disabled={row.counts[action] === 0}
                    onClick={() => {
                      if (!department?.name || row.counts[action] === 0) return;
                      const subCategory = SYSTEM_ROWS.find((item) => item.label === row.label)?.key || "";
                      if (!subCategory) return;
                      onNavigateToUsers({
                        nodeName: department.name,
                        category: "SYSTEM_ACCESS",
                        subCategory,
                        action,
                      });
                    }}
                    className={cn(
                      "mx-auto inline-flex min-w-[28px] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold transition",
                      row.counts[action] === 0
                        ? "cursor-not-allowed border-slate-200 bg-white text-slate-500/70"
                        : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                    )}
                  >
                    {row.counts[action]}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function NodeSidebar({
  open,
  onOpenChange,
  department,
  users,
  usersLoading,
  onNavigateToUsers,
  onOpenHistory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentSidebarDepartment | null;
  users: AppUser[];
  usersLoading: boolean;
  onNavigateToUsers: (input: { nodeName: string; category: string; subCategory: string; action: PermissionAction }) => void;
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
        users={users}
        usersLoading={usersLoading}
        onNavigateToUsers={onNavigateToUsers}
        onClose={() => onOpenChange(false)}
        onOpenHistory={onOpenHistory}
      />
    </aside>
  );
}

export default NodeSidebar;
