import { X } from "lucide-react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { ValidationErrors } from "@/features/user-management/types";
import { getOrgNodeBadgeTheme, getOrgNodeTheme } from "@/features/user-management/utils";
import {
  getBranchAppearance,
  getNodeAccentBackground,
} from "@/features/org-structure/nodeTheme.utils";

type StepSelectNodeProps = {
  orgStructure: OrgNode | null;
  selectedNodeId: string | null;
  selectedNodes: OrgNode[];
  errors: ValidationErrors;
  onNodeSelect: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
};

function OrgNodeTree({
  node,
  selectedNodeId,
  onSelect,
  depth = 0,
  branchIndex = null,
  branchDepth = 0,
}: {
  node: OrgNode;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  depth?: number;
  branchIndex?: number | null;
  branchDepth?: number;
}) {
  const isSelected = selectedNodeId === node.id;
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const appearance = getBranchAppearance(branchIndex, branchDepth, isRoot);
  const edgeBg = getNodeAccentBackground(branchIndex, branchDepth, isRoot);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "relative flex w-full items-center justify-between overflow-hidden rounded-xl bg-white px-4 py-3 text-left border transition-all",
          isSelected
            ? "border-[rgb(53,83,233)] shadow-[0_0_0_3px_rgba(53,83,233,0.08)] bg-[rgb(53,83,233,0.02)]"
            : cn(appearance.defaultSurfaceClass, appearance.hoverBorderClass)
        )}
        style={{ marginLeft: depth * 16 }}
      >
        {!isRoot && (
          <span
            className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", edgeBg)}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 pl-1 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
        </div>
        {isSelected && (
          <span className="ml-2 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(53,83,233)] text-white">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        )}
      </button>

      {node.children.length > 0 && (
        <div className="space-y-2">
          {node.children.map((child, childIdx) => (
            <OrgNodeTree
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              depth={depth + 1}
              branchIndex={isRoot ? childIdx : branchIndex}
              branchDepth={isRoot ? 0 : branchDepth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}


export function StepSelectNode({
  orgStructure,
  selectedNodeId,
  selectedNodes,
  errors,
  onNodeSelect,
  onRemoveNode,
}: StepSelectNodeProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {errors.nodeSelection ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errors.nodeSelection}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-800">Select Node</h3>
          </div>
          {orgStructure ? (
            <div className="max-h-[26rem] overflow-y-auto overflow-x-hidden pr-4 [scrollbar-gutter:stable]">
              <OrgNodeTree node={orgStructure} selectedNodeId={selectedNodeId} onSelect={onNodeSelect} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Org structure is not available yet.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Selected Node</h4>
          <div className="mt-4 min-h-[22rem] space-y-3">
            {selectedNodes.length > 0 ? (
              selectedNodes.map((node, index) => (
                <div key={node.id} className={cn("relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3", getOrgNodeTheme(node.nodeType).card)}>
                  {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                    <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                  ) : null}
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveNode(node.id)}
                    className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={`Remove ${node.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                Selected nodes will appear here in preference order.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StepSelectNode;
