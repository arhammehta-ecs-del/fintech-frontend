import { X } from "lucide-react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { ValidationErrors } from "@/features/user-management/types";
import { getOrgNodeBadgeTheme, getOrgNodeTheme } from "@/features/user-management/utils";

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
}: {
  node: OrgNode;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  depth?: number;
}) {
  const isSelected = selectedNodeId === node.id;
  const theme = getOrgNodeTheme(node.nodeType);
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "relative flex w-full items-center justify-between overflow-hidden rounded-xl bg-white px-4 py-3 text-left transition-all",
          theme.card,
          isSelected ? theme.selected : cn("border-slate-200", theme.hover),
        )}
        style={{ marginLeft: depth * 16 }}
      >
        {!isRoot ? <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", theme.edge)} aria-hidden="true" /> : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
        </div>
      </button>
      {node.children.length > 0 ? (
        <div className="space-y-2">
          {node.children.map((child) => (
            <OrgNodeTree key={child.id} node={child} selectedNodeId={selectedNodeId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      ) : null}
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
