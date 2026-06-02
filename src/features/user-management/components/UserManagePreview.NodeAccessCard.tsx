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
  previousCategories?: Record<string, Array<{
    roleSubCategory: string;
    roleName: string;
    nodeType?: string;
    accessCategory?: "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null;
  }>>;
  isRemovedNode?: boolean;
  onClose?: () => void;
};

export function NodeAccessCard({
  nodeName,
  parentSubtitle,
  nodeIndex,
  categories,
  previousCategories,
  isPrimary,
  isRemovedNode = false,
  onClose,
}: NodeAccessCardProps) {
  const edgeCls = getNodeEdgeBorderClass(nodeIndex, isPrimary);
  const badgeCls = getNodeBadgeClass(nodeIndex, isPrimary);
  const badgeLabel = `${isPrimary ? "P" : "S"}${nodeIndex + 1}`;

  const categoryHasRows = (cat: string) =>
    (categories[cat]?.length ?? 0) > 0 || (previousCategories?.[cat]?.length ?? 0) > 0;
  const orderedCats = CATEGORY_ORDER.filter(categoryHasRows);
  const extraCats = Object.keys(categories).filter(
    (cat) => !CATEGORY_ORDER.includes(cat) && categoryHasRows(cat),
  );
  const previousExtraCats = Object.keys(previousCategories ?? {}).filter(
    (cat) => !CATEGORY_ORDER.includes(cat) && !extraCats.includes(cat) && categoryHasRows(cat),
  );
  const presentCats = [...orderedCats, ...extraCats, ...previousExtraCats];
  const getBadgeStyle = (label: string) => {
    if (label === "Global Access") return "bg-emerald-50 text-emerald-700";
    if (label === "Checker") return "bg-violet-50 text-violet-700";
    if (label === "Maker") return "bg-amber-50 text-amber-700";
    if (label === "Corp Admin") return "bg-emerald-50 text-emerald-700";
    return "bg-slate-100 text-slate-600";
  };
  const getRemovedBadgeStyle = (label: string) => {
    const base = getBadgeStyle(label);
    return `${base} border border-rose-200 bg-rose-50 text-rose-600 line-through`;
  };

  const getBadgeIcon = (label: string) => {
    if (label === "Global Access") return ShieldCheck;
    if (label === "Checker") return ShieldCheck;
    if (label === "Maker") return Pencil;
    if (label === "Corp Admin") return ShieldCheck;
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
        isRemovedNode && "border-dashed !bg-slate-50/80 opacity-75",
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
          <div className={cn("truncate text-[18px] font-semibold leading-tight text-slate-800", isRemovedNode && "text-slate-500 line-through")}>
            {nodeName}
          </div>
          {parentSubtitle ? <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{parentSubtitle}</div> : null}
        </div>
        {isRemovedNode ? (
          <span className="ml-auto shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600">
            Removed
          </span>
        ) : null}
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

          const prevRows = previousCategories?.[cat] ?? [];
          const groupedPrevRows = prevRows.reduce<Map<string, Set<string>>>((acc, row) => {
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

          return (
            <div key={cat} className="space-y-2">
              <div className="border-b border-slate-200 pb-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {formatKey(cat)}
              </div>
              {Array.from(new Set([...Array.from(groupedRows.keys()), ...Array.from(groupedPrevRows.keys())])).map((roleSubCategory, i) => {
                const labels = groupedRows.get(roleSubCategory) ?? new Set<string>();
                const previousLabels = groupedPrevRows.get(roleSubCategory) ?? new Set<string>();
                const allBadgeTokens = Array.from(new Set([...Array.from(labels), ...Array.from(previousLabels)]));
                const labelPriority = ["Global Access", "Corp Admin", "Checker", "Maker", "Viewer"];
                const orderedBadgeTokens = labelPriority.flatMap((label) =>
                  allBadgeTokens.filter((token) => token.startsWith(`${label}::`)),
                );
                const remainingBadgeTokens = allBadgeTokens
                  .filter((token) => !labelPriority.some((label) => token.startsWith(`${label}::`)))
                  .sort((left, right) => {
                    const leftLabel = left.split("::")[0] || "";
                    const rightLabel = right.split("::")[0] || "";
                    return leftLabel.localeCompare(rightLabel);
                  });
                const finalBadgeTokens = [...orderedBadgeTokens, ...remainingBadgeTokens];
                return (
                  <div key={i} className="grid grid-cols-1 items-start gap-2 text-[15px] leading-[1.35] sm:grid-cols-[minmax(120px,1fr)_minmax(0,2fr)] sm:gap-x-5">
                    <span className="min-w-0 break-words pt-0.5 pr-1 font-medium text-slate-600">{formatKey(roleSubCategory)}</span>
                    <span className="flex min-w-0 flex-nowrap gap-2 sm:justify-end">
                      {finalBadgeTokens.map((token) => {
                        const [label, scope] = token.split("::");
                        const BadgeIcon = getBadgeIcon(label || "Viewer");
                        const existsInCurrent = labels.has(token);
                        const existsInPrevious = previousLabels.has(token);
                        const isRemoved = existsInPrevious && !existsInCurrent;
                        return (
                          <span
                            key={`${roleSubCategory}-${token}`}
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium whitespace-nowrap",
                              isRemoved ? getRemovedBadgeStyle(label || "Viewer") : getBadgeStyle(label || "Viewer"),
                            )}
                          >
                            <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{`${label || "Viewer"} - ${scope || "Node"}`}</span>
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
