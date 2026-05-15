import { ChevronRight, Eye, Pencil, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPermissionActionLabelFromRoleName } from "@/features/user-management/roleLabels";
import {
  CATEGORY_ORDER,
  formatKey,
  getNodeBadgeClass,
  getNodeEdgeBorderClass,
} from "@/features/user-management/components/UserManagePreview.utils";

type NodeAccessCardProps = {
  nodeName: string;
  parentSubtitle?: string;
  nodeIndex: number;
  categories: Record<string, Array<{
    roleSubCategory: string;
    roleName: string;
    nodeType?: string;
    accessCategory?: "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null;
  }>>;
  isPrimary: boolean;
  onClose?: () => void;
};

export function NodeAccessCard({
  nodeName,
  parentSubtitle,
  nodeIndex,
  categories,
  isPrimary,
  onClose,
}: NodeAccessCardProps) {
  const edgeCls = getNodeEdgeBorderClass(nodeIndex, isPrimary);
  const badgeCls = getNodeBadgeClass(nodeIndex, isPrimary);
  const badgeLabel = `${isPrimary ? "P" : "S"}${nodeIndex + 1}`;

  const presentCats = CATEGORY_ORDER.filter((cat) => (categories[cat]?.length ?? 0) > 0);
  const getBadgeStyle = (label: string) => {
    if (label === "Global Access") return "bg-emerald-50 text-emerald-700";
    if (label === "Checker") return "bg-violet-50 text-violet-700";
    if (label === "Maker") return "bg-amber-50 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  const getBadgeIcon = (label: string) => {
    if (label === "Global Access") return ShieldCheck;
    if (label === "Checker") return ShieldCheck;
    if (label === "Maker") return Pencil;
    return Eye;
  };

  const formatScopeLabel = (value?: string | null) => {
    const normalized = (value || "").trim().toUpperCase();
    if (normalized === "ALL_CHILD") return "All Child";
    if (normalized === "IMMEDIATE_CHILD") return "Immediate Child";
    return "Node";
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-l-[4px] bg-white p-4",
        edgeCls,
        isPrimary
          ? "border-slate-200 bg-white shadow-sm"
          : "border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]",
      )}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={`Close ${nodeName}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div className="mb-3 flex items-center gap-3 pl-1">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", badgeCls)}>
          {badgeLabel}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold leading-tight text-slate-800">{nodeName}</div>
          {parentSubtitle ? <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{parentSubtitle}</div> : null}
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-slate-50/30 p-3 pl-4">
        {presentCats.length === 0 ? (
          <div className="text-xs text-slate-400">No permissions assigned.</div>
        ) : presentCats.map((cat) => {
          const rows = categories[cat] ?? [];
          const groupedRows = rows.reduce<Map<string, Set<string>>>((acc, row) => {
            const key = row.roleSubCategory || row.nodeType || "ROOT";
            const labels = acc.get(key) ?? new Set<string>();
            const isGlobalAccessRoleMissing = !row.roleName.trim() && !row.roleSubCategory.trim();
            const actionLabel = isGlobalAccessRoleMissing
              ? "Global Access"
              : getPermissionActionLabelFromRoleName(row.roleName || "Viewer");
            labels.add(`${actionLabel}::${formatScopeLabel(row.accessCategory)}`);
            acc.set(key, labels);
            return acc;
          }, new Map());

          if (cat === "SYSTEM_ACCESS" && groupedRows.has("USER_MANAGEMENT")) {
            const labels = groupedRows.get("USER_MANAGEMENT");
            if (labels) {
              labels.add("Checker::Node");
              labels.add("Maker::Node");
              labels.add("Viewer::Node");
            }
          }

          return (
            <div key={cat} className="space-y-2">
              <div className="border-b border-slate-200 pb-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {formatKey(cat)}
              </div>
              {Array.from(groupedRows.entries()).map(([roleSubCategory, labels], i) => {
                const orderedBadgeTokens = ["Global Access", "Checker", "Maker", "Viewer"].flatMap((label) =>
                  Array.from(labels).filter((token) => token.startsWith(`${label}::`)),
                );
                return (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-7 text-[15px] leading-[1.35]">
                    <span className="min-w-0 truncate pt-0.5 pr-1 font-medium text-slate-600">{formatKey(roleSubCategory)}</span>
                    <span className="flex max-w-[360px] flex-wrap justify-end gap-2">
                      {orderedBadgeTokens.map((token) => {
                        const [label, scope] = token.split("::");
                        const BadgeIcon = getBadgeIcon(label || "Viewer");
                        return (
                          <span
                            key={`${roleSubCategory}-${token}`}
                            className={cn("inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium", getBadgeStyle(label || "Viewer"))}
                          >
                            <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                            {`${label || "Viewer"} - ${scope || "Node"}`}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
