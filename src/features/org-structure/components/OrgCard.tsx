import { Plus } from "lucide-react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  getBranchAppearance,
  getNodeAccentBackground,
  getNodeAccentBorderLeft,
  getNodeIcon,
  getNodeTheme,
  getPlusButtonAccentClass,
} from "@/features/org-structure/nodeTheme.utils";

type OrgCardProps = {
  node: OrgNode;
  branchIndex: number | null;
  branchDepth: number;
  active?: boolean;
  compact?: boolean;
  onSelect: (node: OrgNode) => void;
  onCreateNode: (node: OrgNode) => void;
};

export function OrgCard({
  node,
  branchIndex,
  branchDepth,
  active = false,
  compact = false,
  onSelect,
  onCreateNode,
}: OrgCardProps) {
  const theme = getNodeTheme(node.nodeType);
  const Icon = getNodeIcon(node.nodeType);
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const appearance = getBranchAppearance(branchIndex, branchDepth, isRoot);
  const accentBackgroundClass = getNodeAccentBackground(branchIndex, branchDepth, isRoot);
  const accentBorderClass = getNodeAccentBorderLeft(branchIndex, branchDepth, isRoot);
  const plusButtonAccentClass = getPlusButtonAccentClass(accentBackgroundClass);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          "relative flex items-center gap-2.5 overflow-hidden rounded-[18px] px-4 text-left text-slate-900 transition hover:-translate-y-0.5",
          isRoot ? "min-h-[48px] min-w-[108px] rounded-2xl px-3 py-2.5" : compact ? "min-h-[58px] min-w-[160px] py-3" : "min-h-[62px] min-w-[168px] py-3.5",
          appearance.hoverBorderClass,
          active ? appearance.activeBorderClass : appearance.defaultSurfaceClass,
          !isRoot && `border-l-[4px] ${accentBorderClass}`,
          node.status === "Pending" && "border-dashed border-amber-300 bg-amber-50/30"
        )}
      >
        <div className={cn("flex items-center justify-center rounded-full bg-white/75", isRoot ? "h-5 w-5" : "h-7 w-7")}>
          <Icon className={cn(isRoot ? "h-3 w-3" : "h-3.5 w-3.5", theme.iconColor)} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-semibold", isRoot ? "text-[11px]" : compact ? "text-[13px]" : "text-[14px]")}>{node.name}</p>
            {node.status === "Pending" && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700">
                Pending
              </span>
            )}
          </div>
          {!isRoot ? <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">{node.nodeType}</p> : null}
        </div>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCreateNode(node);
        }}
        className={cn(
          "absolute right-0 top-0 z-20 flex h-8 w-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-[0_6px_14px_rgba(15,23,42,0.16)] transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          plusButtonAccentClass,
        )}
        aria-label={`Add child node under ${node.name}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default OrgCard;
