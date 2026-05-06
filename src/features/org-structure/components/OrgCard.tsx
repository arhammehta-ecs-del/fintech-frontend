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
  const isPendingNode = node.status?.trim().toUpperCase() === "PENDING";

  return (
    <div className="group relative">
      <button
        type="button"
        data-org-card-body="true"
        onClick={() => onSelect(node)}
        className={cn(
          "relative flex items-center gap-2.5 overflow-hidden rounded-[18px] px-4 text-left transition hover:-translate-y-0.5",
          isRoot ? "text-white" : "text-slate-900",
          isRoot ? "min-h-[70px] min-w-[196px] rounded-2xl py-4 pl-5 pr-5" : compact ? "min-h-[58px] min-w-[160px] py-3" : "min-h-[62px] min-w-[168px] py-3.5",
          appearance.hoverBorderClass,
          active ? appearance.activeBorderClass : appearance.defaultSurfaceClass,
          isRoot ? "border-l-[4px] border-l-indigo-500" : `border-l-[4px] ${accentBorderClass}`,
          node.status === "Pending" && "border-dashed border-amber-300 bg-amber-50/30"
        )}
      >
        <div className={cn("flex items-center justify-center rounded-full", isRoot ? "h-8 w-8 bg-white text-indigo-600 shadow-sm" : "h-7 w-7 bg-white/75")}>
          <Icon className={cn(isRoot ? "h-4 w-4 text-indigo-600" : "h-3.5 w-3.5", !isRoot && theme.iconColor)} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-semibold", isRoot ? "text-[16px] font-bold tracking-[-0.01em] text-white" : "text-[16px]")}>{node.name}</p>
            {node.status === "Pending" && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700">
                Pending
              </span>
            )}
          </div>
          {!isRoot ? <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">{node.nodeType}</p> : null}
        </div>
      </button>

      {!isPendingNode ? (
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
      ) : null}
    </div>
  );
}

export default OrgCard;
