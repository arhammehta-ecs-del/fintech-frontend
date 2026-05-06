import { useMemo } from "react";
import { X } from "lucide-react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { ValidationErrors } from "@/features/user-management/types";
import {
  getBranchAppearance,
  getNodeAccentBackground,
  getNodeAccentBorderLeft,
} from "@/features/org-structure/nodeTheme.utils";

type StepSelectNodeProps = {
  orgStructure: OrgNode | null;
  selectedNodeId: string | null;
  selectedNodes: OrgNode[];
  errors: ValidationErrors;
  onNodeSelect: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
};

type BranchMeta = {
  branchIndex: number | null;
  branchDepth: number;
};

const buildNodeBreadcrumbMap = (root: OrgNode | null) => {
  const map = new Map<string, string>();
  if (!root) return map;

  const nodeLabel = (node: OrgNode) => {
    const name = typeof node.name === "string" ? node.name.trim() : "";
    if (name) return name;
    const type = typeof node.nodeType === "string" ? node.nodeType.trim() : "";
    return type || "Unnamed Node";
  };

  const walk = (node: OrgNode, trail: string[]) => {
    const nextTrail = [...trail, nodeLabel(node)].filter(Boolean);
    map.set(node.id, nextTrail.join(" > "));
    node.children.forEach((child) => walk(child, nextTrail));
  };

  walk(root, []);
  return map;
};

const BRANCH_BADGE_BY_ACCENT: Record<string, string> = {
  "bg-slate-400": "border-indigo-300 bg-indigo-50 text-indigo-700",
  "bg-orange-500": "border-orange-300 bg-orange-50 text-orange-700",
  "bg-orange-300": "border-orange-200 bg-orange-50 text-orange-600",
  "bg-orange-200": "border-orange-200 bg-orange-50 text-orange-600",
  "bg-orange-100": "border-orange-200 bg-orange-50 text-orange-600",
  "bg-sky-500": "border-sky-300 bg-sky-50 text-sky-700",
  "bg-sky-300": "border-sky-200 bg-sky-50 text-sky-600",
  "bg-sky-200": "border-sky-200 bg-sky-50 text-sky-600",
  "bg-sky-100": "border-sky-200 bg-sky-50 text-sky-600",
  "bg-emerald-500": "border-emerald-300 bg-emerald-50 text-emerald-700",
  "bg-emerald-300": "border-emerald-200 bg-emerald-50 text-emerald-600",
  "bg-emerald-200": "border-emerald-200 bg-emerald-50 text-emerald-600",
  "bg-emerald-100": "border-emerald-200 bg-emerald-50 text-emerald-600",
  "bg-rose-500": "border-rose-300 bg-rose-50 text-rose-700",
  "bg-rose-300": "border-rose-200 bg-rose-50 text-rose-600",
  "bg-rose-200": "border-rose-200 bg-rose-50 text-rose-600",
  "bg-rose-100": "border-rose-200 bg-rose-50 text-rose-600",
  "bg-amber-500": "border-amber-300 bg-amber-50 text-amber-700",
  "bg-amber-300": "border-amber-200 bg-amber-50 text-amber-600",
  "bg-amber-200": "border-amber-200 bg-amber-50 text-amber-600",
  "bg-amber-100": "border-amber-200 bg-amber-50 text-amber-600",
  "bg-cyan-500": "border-cyan-300 bg-cyan-50 text-cyan-700",
  "bg-cyan-300": "border-cyan-200 bg-cyan-50 text-cyan-600",
  "bg-cyan-200": "border-cyan-200 bg-cyan-50 text-cyan-600",
  "bg-cyan-100": "border-cyan-200 bg-cyan-50 text-cyan-600",
};

const isPendingNode = (node: OrgNode) => node.status?.trim().toUpperCase() === "PENDING";

const filterPendingNodes = (node: OrgNode | null): OrgNode | null => {
  if (!node || isPendingNode(node)) return null;

  return {
    ...node,
    children: node.children.map((child) => filterPendingNodes(child)).filter((child): child is OrgNode => Boolean(child)),
  };
};

const getBadgeClassByAccent = (accentClass: string) =>
  BRANCH_BADGE_BY_ACCENT[accentClass] ?? "border-slate-200 bg-slate-50 text-slate-700";

const getNodeBorderLeftClass = (branchIndex: number | null, branchDepth: number, isRoot: boolean) =>
  isRoot ? "border-l-indigo-500" : getNodeAccentBorderLeft(branchIndex, branchDepth, isRoot);

const getSelectedNodeClass = (
  isRoot: boolean,
  isSelected: boolean,
  appearance: ReturnType<typeof getBranchAppearance>,
  branchIndex: number | null,
  branchDepth: number,
) => {
  const borderLeftClass = getNodeBorderLeftClass(branchIndex, branchDepth, isRoot);

  return isSelected
    ? isRoot
      ? "border border-indigo-200 bg-indigo-50/70 text-slate-800 shadow-[0_10px_22px_rgba(99,102,241,0.16)] border-l-[4px] border-l-indigo-400"
      : cn(
        "border-[rgb(53,83,233)] shadow-[0_0_0_3px_rgba(53,83,233,0.08)] bg-[rgb(53,83,233,0.02)] border-l-[4px]",
        borderLeftClass,
      )
    : cn(
      isRoot ? "border border-indigo-100 bg-indigo-50/35 text-slate-800 shadow-[0_6px_16px_rgba(99,102,241,0.1)]" : appearance.defaultSurfaceClass,
      appearance.hoverBorderClass,
      "border-l-[4px]",
      borderLeftClass,
    );
};

function buildBranchMetaMap(root: OrgNode | null): Map<string, BranchMeta> {
  const branchMap = new Map<string, BranchMeta>();
  if (!root) return branchMap;

  const walk = (node: OrgNode, branchIndex: number | null, branchDepth: number) => {
    branchMap.set(node.id, { branchIndex, branchDepth });

    node.children.forEach((child, childIdx) => {
      const nextBranchIndex = node.nodeType.trim().toUpperCase() === "ROOT"
        ? childIdx
        : branchIndex;
      const nextBranchDepth = node.nodeType.trim().toUpperCase() === "ROOT"
        ? 0
        : branchDepth + 1;
      walk(child, nextBranchIndex, nextBranchDepth);
    });
  };

  walk(root, null, 0);
  return branchMap;
}

type FlowNode = {
  node: OrgNode;
  branchIndex: number | null;
  branchDepth: number;
  depth: number;
  level: number;
};

const getFlowNodes = (root: OrgNode | null, branchMetaMap: Map<string, BranchMeta>): FlowNode[] => {
  if (!root) return [];

  const linearNodes: Array<{ node: OrgNode; depth: number }> = [];
  const walk = (node: OrgNode, depth: number) => {
    linearNodes.push({ node, depth });
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 0);

  return linearNodes.map(({ node, depth }, index) => {
    const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };

    return {
      node,
      branchIndex: meta.branchIndex,
      branchDepth: meta.branchDepth,
      depth,
      level: index + 1,
    };
  });
};

export function UserOnboardingStepSelectNode({
  orgStructure,
  selectedNodeId,
  selectedNodes,
  errors,
  onNodeSelect,
  onRemoveNode,
}: StepSelectNodeProps) {
  const filteredStructure = useMemo(() => filterPendingNodes(orgStructure), [orgStructure]);
  const branchMetaMap = useMemo(() => buildBranchMetaMap(filteredStructure), [filteredStructure]);
  const breadcrumbByNodeId = useMemo(() => buildNodeBreadcrumbMap(filteredStructure), [filteredStructure]);
  const selectedNodeIds = useMemo(() => new Set(selectedNodes.map((node) => node.id)), [selectedNodes]);

  const flowNodes = useMemo(() => getFlowNodes(filteredStructure, branchMetaMap), [branchMetaMap, filteredStructure]);

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
            <p className="mt-1 text-xs text-slate-500">Click node rows to toggle selection.</p>
          </div>

          {flowNodes.length > 0 ? (
            <div className="max-h-[31rem] overflow-auto rounded-xl border border-slate-200 bg-white/80">
              <div className="space-y-2 p-3">
                {flowNodes.map((item) => {
                  const isRoot = item.node.nodeType.trim().toUpperCase() === "ROOT";
                  const isSelected = selectedNodeIds.has(item.node.id);
                  const isFocusedSelection = selectedNodeId === item.node.id;
                  const appearance = getBranchAppearance(item.branchIndex, item.branchDepth, isRoot);
                  const borderLeftClass = getNodeBorderLeftClass(item.branchIndex, item.branchDepth, isRoot);
                  const parentSubtitle = breadcrumbByNodeId.get(item.node.id) || "";

                  return (
                    <div key={item.node.id} style={{ paddingLeft: `${item.depth * 20}px` }}>
                      <button
                        type="button"
                        onClick={() => onNodeSelect(item.node.id)}
                        className={cn(
                          "group relative w-full overflow-hidden rounded-xl border bg-white px-3 py-2.5 text-left transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          getSelectedNodeClass(isRoot, isSelected, appearance, item.branchIndex, item.branchDepth),
                          isFocusedSelection && "ring-2 ring-[rgb(53,83,233)]/25 ring-offset-1",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-0 h-full w-[4px] rounded-r-full",
                            isRoot ? "bg-indigo-400" : borderLeftClass,
                          )}
                          aria-hidden="true"
                        />
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold", isRoot ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                              L{item.level}
                            </div>
                            {!isRoot ? (
                              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.node.nodeType}</span>
                            ) : null}
                          </div>
                          <span className={cn("text-xs font-semibold", isRoot ? "text-slate-500" : "text-slate-400")}>{isSelected ? "Selected" : "Select"}</span>
                        </div>
                        <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", isRoot ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200 bg-white")}>
                          <div className="min-w-0 flex-1">
                            <div className={cn("truncate text-[13px] font-semibold", isRoot ? "text-slate-800" : "text-slate-800")}>{item.node.name}</div>
                            {!isRoot ? (
                              <div className={cn("truncate text-[10px]", "text-slate-500")}>
                                {parentSubtitle || item.node.nodeType}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
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
                (() => {
                  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
                  const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };
                  const appearance = getBranchAppearance(meta.branchIndex, meta.branchDepth, isRoot);
                  const edgeBg = getNodeAccentBackground(meta.branchIndex, meta.branchDepth, isRoot);
                  const borderLeftClass = getNodeBorderLeftClass(meta.branchIndex, meta.branchDepth, isRoot);

                  return (
                    <div
                      key={node.id}
                      className={cn(
                        "relative flex items-start gap-3 overflow-hidden rounded-xl border border-l-[4px] bg-white px-4 py-3",
                        isRoot
                          ? "border border-indigo-100 bg-indigo-50/35 shadow-[0_6px_16px_rgba(99,102,241,0.1)]"
                          : appearance.defaultSurfaceClass,
                        borderLeftClass,
                      )}
                    >
                      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", getBadgeClassByAccent(edgeBg))}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className={cn("truncate text-[16px] font-semibold", isRoot ? "text-slate-800" : "text-slate-800")}>{node.name}</div>
                        {!isRoot && breadcrumbByNodeId.get(node.id) ? (
                          <div className={cn("truncate text-[10px] font-medium", "text-slate-500")}>
                            {breadcrumbByNodeId.get(node.id)}
                          </div>
                        ) : null}
                        {!isRoot ? (
                          <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">{node.nodeType}</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveNode(node.id)}
                        className={cn(
                          "ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          isRoot
                            ? "text-slate-500 hover:bg-indigo-100 hover:text-slate-700"
                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
                        )}
                        aria-label={`Remove ${node.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })()
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

export default UserOnboardingStepSelectNode;
