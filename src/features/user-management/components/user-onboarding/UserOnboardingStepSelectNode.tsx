import { useMemo } from "react";
import { X } from "lucide-react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { ValidationErrors } from "@/features/user-management/types";
import {
  getBranchAppearance,
  getNodeAccentBackground,
  getNodeAccentBorderLeft,
  getNodeIcon
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

const CONNECTOR_ARROW_ID = "onboarding-step2-connector-arrow";
const FLOW_CARD_WIDTH = 338;
const FLOW_CARD_HEIGHT = 118;
const FLOW_LEFT_X = 70;
const FLOW_RIGHT_X = 508;
const FLOW_TOP_Y = 56;
const FLOW_ROW_GAP = 176;

const formatPathSegment = (segment: string) =>
  segment
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getNodeParentSubtitle = (nodePath?: string) => {
  const rawSegments = (nodePath || "").split(".").map((segment) => segment.trim()).filter(Boolean);
  if (rawSegments.length <= 1) return "";
  const segments = rawSegments.map(formatPathSegment);
  const parentSegments = segments.slice(0, -1);
  if (parentSegments.length === 0) return "";
  const trimmedParents = parentSegments.length > 1 ? parentSegments.slice(1) : parentSegments;
  return trimmedParents.join(" > ");
};

const BRANCH_BADGE_BY_ACCENT: Record<string, string> = {
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
  "bg-slate-400": "border-slate-300 bg-slate-100 text-slate-700",
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
      ? "border-2 border-indigo-700 bg-indigo-700 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] border-l-[4px] border-l-indigo-500"
      : cn(
        "border-[rgb(53,83,233)] shadow-[0_0_0_3px_rgba(53,83,233,0.08)] bg-[rgb(53,83,233,0.02)] border-l-[4px]",
        borderLeftClass,
      )
    : cn(
      appearance.defaultSurfaceClass,
      appearance.hoverBorderClass,
      "border-l-[4px]",
      borderLeftClass,
      isRoot && "text-white",
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
  x: number;
  y: number;
  level: number;
};

const getFlowNodes = (root: OrgNode | null, branchMetaMap: Map<string, BranchMeta>): FlowNode[] => {
  if (!root) return [];

  const linearNodes: OrgNode[] = [];
  const walk = (node: OrgNode) => {
    linearNodes.push(node);
    node.children.forEach(walk);
  };
  walk(root);

  return linearNodes.map((node, index) => {
    const row = Math.floor(index / 2);
    const positionInRow = index % 2;
    const isEvenRow = row % 2 === 0;
    const isLeft = isEvenRow ? positionInRow === 0 : positionInRow === 1;
    const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };

    return {
      node,
      branchIndex: meta.branchIndex,
      branchDepth: meta.branchDepth,
      x: isLeft ? FLOW_LEFT_X : FLOW_RIGHT_X,
      y: FLOW_TOP_Y + row * FLOW_ROW_GAP,
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
  const selectedNodeIds = useMemo(() => new Set(selectedNodes.map((node) => node.id)), [selectedNodes]);

  const canvasLayout = useMemo(() => {
    const flowNodes = getFlowNodes(filteredStructure, branchMetaMap);
    if (flowNodes.length === 0) return null;
    const maxBottom = flowNodes[flowNodes.length - 1].y + FLOW_CARD_HEIGHT + 56;
    const canvasWidth = FLOW_RIGHT_X + FLOW_CARD_WIDTH + 74;
    const canvasHeight = Math.max(520, maxBottom);

    return {
      flowNodes,
      canvasWidth,
      canvasHeight,
    };
  }, [branchMetaMap, filteredStructure]);

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
            <p className="mt-1 text-xs text-slate-500">Click cards on the canvas to toggle node selection.</p>
          </div>

          {canvasLayout ? (
            <div className="max-h-[31rem] overflow-auto rounded-xl border border-slate-200 bg-white/80">
              <div
                className="relative"
                style={{
                  width: `${canvasLayout.canvasWidth}px`,
                  height: `${canvasLayout.canvasHeight}px`,
                }}
              >
                <svg
                  className="absolute inset-0"
                  width={canvasLayout.canvasWidth}
                  height={canvasLayout.canvasHeight}
                  viewBox={`0 0 ${canvasLayout.canvasWidth} ${canvasLayout.canvasHeight}`}
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id={CONNECTOR_ARROW_ID}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0 0L10 5L0 10Z" fill="#c7d2e5" />
                    </marker>
                  </defs>
                  <g
                    stroke="#9eb1c9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="6 6"
                  >
                    {canvasLayout.flowNodes.map((item, index) => {
                      const next = canvasLayout.flowNodes[index + 1];
                      if (!next) return null;

                      const sameRow = item.y === next.y;
                      if (sameRow) {
                        const itemCenterY = item.y + FLOW_CARD_HEIGHT / 2;
                        const fromX = item.x < next.x ? item.x + FLOW_CARD_WIDTH : item.x;
                        const toX = item.x < next.x ? next.x : next.x + FLOW_CARD_WIDTH;

                        return (
                          <line
                            key={`${item.node.id}-${next.node.id}`}
                            x1={fromX}
                            y1={itemCenterY}
                            x2={toX}
                            y2={itemCenterY}
                            markerEnd={`url(#${CONNECTOR_ARROW_ID})`}
                          />
                        );
                      }

                      const itemCenterX = item.x + FLOW_CARD_WIDTH / 2;
                      const nextCenterX = next.x + FLOW_CARD_WIDTH / 2;
                      const fromY = item.y + FLOW_CARD_HEIGHT;
                      const toY = next.y;

                      return (
                        <path
                          key={`${item.node.id}-${next.node.id}`}
                          d={`M ${itemCenterX} ${fromY} L ${itemCenterX} ${(fromY + toY) / 2} L ${nextCenterX} ${(fromY + toY) / 2} L ${nextCenterX} ${toY}`}
                          fill="none"
                          markerEnd={`url(#${CONNECTOR_ARROW_ID})`}
                        />
                      );
                    })}
                  </g>
                </svg>

                {canvasLayout.flowNodes.map((item) => {
                  const isRoot = item.node.nodeType.trim().toUpperCase() === "ROOT";
                  const isSelected = selectedNodeIds.has(item.node.id);
                  const isFocusedSelection = selectedNodeId === item.node.id;
                  const appearance = getBranchAppearance(item.branchIndex, item.branchDepth, isRoot);
                  const borderLeftClass = getNodeBorderLeftClass(item.branchIndex, item.branchDepth, isRoot);
                  const parentSubtitle = getNodeParentSubtitle(item.node.nodePath);
                  const Icon = getNodeIcon(item.node.nodeType);

                  return (
                    <div
                      key={item.node.id}
                      className="absolute"
                      style={{
                        left: `${item.x}px`,
                        top: `${item.y}px`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onNodeSelect(item.node.id)}
                        className={cn(
                          "group relative w-[338px] overflow-hidden rounded-[22px] border bg-white px-4 py-4 text-left shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          getSelectedNodeClass(isRoot, isSelected, appearance, item.branchIndex, item.branchDepth),
                          isFocusedSelection && "ring-2 ring-[rgb(53,83,233)]/25 ring-offset-1",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-0 h-full w-[4px] rounded-r-full",
                            isRoot ? "bg-indigo-500" : borderLeftClass,
                          )}
                          aria-hidden="true"
                        />
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold", isRoot ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>
                              L{item.level}
                            </div>
                            <span className={cn("text-[11px] font-bold uppercase tracking-[0.14em]", isRoot ? "text-white/80" : "text-slate-500")}>Approvers</span>
                          </div>
                          <span className={cn("text-lg leading-none", isRoot ? "text-white/90" : "text-[rgb(53,83,233)]")}>+</span>
                        </div>
                        <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", isRoot ? "border-white/30 bg-white/10" : "border-slate-200 bg-white")}>
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded-full", isRoot ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-500")}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={cn("truncate text-[13px] font-semibold", isRoot ? "text-white" : "text-slate-800")}>{item.node.name}</div>
                            <div className={cn("truncate text-[10px]", isRoot ? "text-white/80" : "text-slate-500")}>{parentSubtitle || item.node.nodeType}</div>
                          </div>
                          <span className={cn("text-sm", isRoot ? "text-white/80" : "text-slate-400")}>v</span>
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
                        appearance.defaultSurfaceClass,
                        borderLeftClass,
                      )}
                    >
                      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", getBadgeClassByAccent(edgeBg))}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[16px] font-semibold text-slate-800">{node.name}</div>
                        {getNodeParentSubtitle(node.nodePath) ? (
                          <div className="truncate text-[10px] font-medium text-slate-500">{getNodeParentSubtitle(node.nodePath)}</div>
                        ) : null}
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">{node.nodeType}</div>
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
