import { ChevronLeft, ChevronRight, Eye, GripVertical, Maximize2, Minimize2, Pencil, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RoleRecord } from "@/services/role.service";
import type {
  UserOnboardingFormData,
  NodePermissionBuckets,
  PermissionAction,
  PermissionBucket,
  PermissionCategory,
  ValidationErrors,
} from "@/features/user-management/types";
import { PERMISSION_ACTIONS, formatRoleTokenLabel, getPermissionActionLabel } from "@/features/user-management/roleLabels";
import { getNodeAccentBackground, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";

type StepAccessRightsProps = {
  orgStructure: OrgNode | null;
  selectedNodes: OrgNode[];
  roles: RoleRecord[];
  errors: ValidationErrors;
  expandedAccessNodeIds: string[];
  primaryNodeId: string | null;
  infoNodeId: string | null;
  nodePermissions: Record<string, NodePermissionBuckets>;
  onSetExpandedAccessNodeIds: (ids: string[] | ((current: string[]) => string[])) => void;
  onSetPrimaryNodeId: (nodeId: string) => void;
  onReorderSelectedNodes: (draggedNodeId: string, targetNodeId: string) => void;
  onSetInfoNodeId: (nodeId: string | null) => void;
  onTogglePermission: (
    nodeId: string,
    bucket: keyof NodePermissionBuckets,
    category: string,
    item: string,
    action: PermissionAction,
  ) => void;
};

type ActivePermissionSelection = {
  categoryKey: PermissionCategory;
  itemKey: string;
  action: PermissionAction;
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

const BRANCH_SURFACE_BY_ACCENT: Record<string, string> = {
  "bg-slate-400": "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50/70",
  "bg-orange-500": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-orange-300": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-orange-200": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-orange-100": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-sky-500": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-sky-300": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-sky-200": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-sky-100": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-emerald-500": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-emerald-300": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-emerald-200": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-emerald-100": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-rose-500": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-rose-300": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-rose-200": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-rose-100": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-amber-500": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-amber-300": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-amber-200": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-amber-100": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-cyan-500": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
  "bg-cyan-300": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
  "bg-cyan-200": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
  "bg-cyan-100": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
};

const buildBranchMetaMap = (root: OrgNode | null): Map<string, BranchMeta> => {
  const branchMap = new Map<string, BranchMeta>();
  if (!root) return branchMap;

  const walk = (node: OrgNode, branchIndex: number | null, branchDepth: number) => {
    branchMap.set(node.id, { branchIndex, branchDepth });

    node.children.forEach((child, childIdx) => {
      const nextBranchIndex = node.nodeType.trim().toUpperCase() === "ROOT" ? childIdx : branchIndex;
      const nextBranchDepth = node.nodeType.trim().toUpperCase() === "ROOT" ? 0 : branchDepth + 1;
      walk(child, nextBranchIndex, nextBranchDepth);
    });
  };

  walk(root, null, 0);
  return branchMap;
};

const getNodeAccentClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) => {
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };
  return getNodeAccentBackground(meta.branchIndex, meta.branchDepth, isRoot);
};

const getNodeBorderLeftClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) => {
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };
  return isRoot ? "border-l-indigo-500" : getNodeAccentBorderLeft(meta.branchIndex, meta.branchDepth, isRoot);
};

const getNodeBadgeClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) =>
  BRANCH_BADGE_BY_ACCENT[getNodeAccentClass(node, branchMetaMap)] ?? "border-slate-200 bg-slate-50 text-slate-700";

const getNodeSurfaceClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) =>
  BRANCH_SURFACE_BY_ACCENT[getNodeAccentClass(node, branchMetaMap)] ?? "border-slate-200 bg-white hover:bg-slate-50/60";

const getPermissionActionTheme = (action: PermissionAction) => {
  if (action === "manager") {
    return {
      Icon: ShieldCheck,
      active: "border-violet-300 bg-violet-50 text-violet-700",
      idle: "border-slate-200 bg-white text-transparent hover:border-violet-200 hover:bg-violet-50",
    };
  }

  if (action === "user") {
    return {
      Icon: Pencil,
      active: "border-amber-300 bg-amber-50 text-amber-700",
      idle: "border-slate-200 bg-white text-transparent hover:border-amber-200 hover:bg-amber-50",
    };
  }

  return {
    Icon: Eye,
    active: "border-slate-300 bg-slate-50 text-slate-700",
    idle: "border-slate-200 bg-white text-transparent hover:border-slate-300 hover:bg-slate-50",
  };
};

function PermissionRow({
  category,
  itemKey,
  label,
  checked,
  variant,
  selectedChoice,
  occupiedChoice,
  hasPrimarySelection = true,
  onToggle,
}: {
  category: string;
  itemKey: string;
  label: string;
  checked: PermissionBucket;
  variant: "primary" | "secondary";
  selectedChoice?: ActivePermissionSelection | null;
  occupiedChoice?: ActivePermissionSelection | null;
  hasPrimarySelection?: boolean;
  onToggle: (category: string, itemKey: string, action: PermissionAction) => void;
}) {
  return (
    <div className="grid grid-cols-4 items-center border-b border-slate-100 px-4 py-2.5 transition-colors hover:bg-slate-50/50 last:border-b-0">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {PERMISSION_ACTIONS.map((action) => (
        <div key={action} className="flex justify-center">
          {(() => {
            const isSelected =
              selectedChoice?.categoryKey === category &&
              String(selectedChoice.itemKey) === String(itemKey) &&
              selectedChoice.action === action;
            const isOccupied =
              occupiedChoice?.categoryKey === category &&
              String(occupiedChoice.itemKey) === String(itemKey) &&
              occupiedChoice.action === action;
            const isPrimaryDisabled = variant === "primary" && Boolean(selectedChoice) && !isSelected;
            const isSecondaryBlocked = variant === "secondary" && !hasPrimarySelection;
            const shouldDisable = isPrimaryDisabled || isOccupied || isSecondaryBlocked;
            const isFilled = checked[action] || isSelected;
            const theme = getPermissionActionTheme(action);
            const Icon = theme.Icon;

            const button = (
              <button
                type="button"
                aria-pressed={isFilled || isOccupied}
                aria-label={`${label} ${getPermissionActionLabel(action)}`}
                disabled={shouldDisable}
                onClick={() => onToggle(category, itemKey, action)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-sm border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(53,83,233)]/20",
                  isFilled ? theme.active : theme.idle,
                  shouldDisable && !isFilled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 hover:border-slate-200 hover:bg-slate-100" : "",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 transition-transform duration-150", isFilled ? "scale-100" : "scale-95")} />
              </button>
            );

            if (isOccupied) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex" aria-label={`${label} ${action} PRIMARY`}>
                      {button}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">PRIMARY</TooltipContent>
                </Tooltip>
              );
            }

            if (isSecondaryBlocked) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex" aria-label={`${label} ${action} disabled until primary is selected`}>
                      {button}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Select one PRIMARY right first</TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })()}
        </div>
      ))}
    </div>
  );
}

export function UserOnboardingStepAccessRights({
  orgStructure,
  selectedNodes,
  roles,
  errors,
  expandedAccessNodeIds,
  primaryNodeId,
  infoNodeId,
  nodePermissions,
  onSetExpandedAccessNodeIds,
  onSetPrimaryNodeId,
  onReorderSelectedNodes,
  onSetInfoNodeId,
  onTogglePermission,
}: StepAccessRightsProps) {
  const branchMetaMap = buildBranchMetaMap(orgStructure);
  const breadcrumbByNodeId = useMemo(() => buildNodeBreadcrumbMap(orgStructure), [orgStructure]);
  const primarySelectedNode = selectedNodes.find((node) => node.id === primaryNodeId) ?? selectedNodes[0] ?? null;
  const secondarySelectedNodes = selectedNodes;
  const selectedNodeIndexMap = new Map(selectedNodes.map((node, index) => [node.id, index + 1] as const));
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll, selectedNodes.length]);

  const scrollListLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollListRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  // Build dynamic section structure from live roles
  const roleCategories = Array.from(
    roles.reduce((acc, role) => {
      if (!acc.has(role.category)) acc.set(role.category, new Map());
      const mods = acc.get(role.category)!;
      if (!mods.has(role.subCategory)) {
        const label = formatRoleTokenLabel(role.subCategory);
        mods.set(role.subCategory, label);
      }
      return acc;
    }, new Map<string, Map<string, string>>()),
    ([category, mods]) => ({
      categoryKey: category,
      label: formatRoleTokenLabel(category),
      items: Array.from(mods, ([key, label]) => ({ key, label })),
    }),
  );

  const getPrimarySelection = (permissions: NodePermissionBuckets["primary"]): ActivePermissionSelection | null => {
    for (const { categoryKey, items } of roleCategories) {
      for (const item of items) {
        const rights = permissions[categoryKey]?.[item.key];
        if (!rights) continue;
        for (const action of PERMISSION_ACTIONS) {
          if (rights[action]) return { categoryKey, itemKey: item.key, action };
        }
      }
    }
    return null;
  };

  const renderNodePermissions = (
    node: OrgNode,
    bucketKeys: Array<keyof NodePermissionBuckets>,
  ) => {
    const buckets = nodePermissions[node.id];
    if (!buckets) return null;
    const primaryChoice = getPrimarySelection(buckets.primary);
    const primarySelectedNodePrimaryChoice =
      primarySelectedNode ? getPrimarySelection(nodePermissions[primarySelectedNode.id]?.primary ?? createInitialPermissions(roles)) : null;
    const hasAnyPrimarySelection = Boolean(primarySelectedNodePrimaryChoice);
    const occupiedPrimaryChoice = node.id === primarySelectedNode?.id ? primaryChoice : null;

    return bucketKeys.map((bucketKey) => (
      <div key={`${node.id}-${bucketKey}`} className="overflow-hidden bg-white">
        <div className="grid grid-cols-4 bg-[rgba(30,66,189,1)] px-4 py-2.5 text-[11px] font-semibold text-white">
          <div>Module</div>
          <div className="text-center">{getPermissionActionLabel("manager")}</div>
          <div className="text-center">{getPermissionActionLabel("user")}</div>
          <div className="text-center">{getPermissionActionLabel("viewer")}</div>
        </div>
        <div className="flex flex-col">
          {roleCategories.map(({ categoryKey, label, items }) => (
            <div key={`${node.id}-${bucketKey}-${categoryKey}`} className="flex flex-col">
              <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                {label}
              </div>
              <div className="flex flex-col">
                {items.map((item) => {
                  const currentItem = buckets[bucketKey][categoryKey]?.[item.key] ?? { manager: false, user: false, viewer: false };
                  const selectedChoice = bucketKey === "primary" ? primaryChoice : null;
                  const occupiedChoice = bucketKey === "secondary" ? occupiedPrimaryChoice : null;
                  return (
                    <PermissionRow
                      key={item.key}
                      category={categoryKey}
                      itemKey={item.key}
                      label={item.label}
                      checked={currentItem}
                      variant={bucketKey}
                      selectedChoice={selectedChoice}
                      occupiedChoice={occupiedChoice}
                      hasPrimarySelection={bucketKey === "secondary" ? hasAnyPrimarySelection : Boolean(primaryChoice)}
                      onToggle={(cat, key, action) => onTogglePermission(node.id, bucketKey, cat, key, action)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  const toggleNodeExpansion = (nodeId: string) => {
    onSetExpandedAccessNodeIds((current) =>
      current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId]
    );
  };

  const areAllExpanded = selectedNodes.length > 0 && selectedNodes.every((node) => expandedAccessNodeIds.includes(node.id));

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      onSetExpandedAccessNodeIds([]);
    } else {
      onSetExpandedAccessNodeIds(selectedNodes.map(n => n.id));
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:space-y-5">
        {errors.accessRights ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errors.accessRights}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Selected Nodes</h3>
              <p className="mt-0.5 text-xs text-slate-500">Drag to reorder or click to select.</p>
            </div>
          </div>

          {selectedNodes.length > 0 ? (
            <div className="space-y-3">
              <div className="group relative">
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-0 left-[-8px] top-0 z-10 flex w-20 items-center justify-start bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent pb-2 pl-2 transition-opacity duration-300",
                    canScrollLeft ? "opacity-100" : "opacity-0"
                  )}
                >
                  <button
                    type="button"
                    onClick={scrollListLeft}
                    disabled={!canScrollLeft}
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[rgb(53,83,233)]/30 hover:bg-slate-50 hover:text-[rgb(53,83,233)] focus-visible:outline-none"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>

                <div
                  ref={scrollContainerRef}
                  onScroll={checkScroll}
                  className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-pl-14 scroll-pr-14"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {selectedNodes.map((node, index) => (
                    (() => {
                      const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
                      return (
                        <div
                          key={node.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onSetExpandedAccessNodeIds((current) => current.includes(node.id) ? current : [...current, node.id]);
                            onSetPrimaryNodeId(node.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSetExpandedAccessNodeIds((current) => current.includes(node.id) ? current : [...current, node.id]);
                              onSetPrimaryNodeId(node.id);
                            }
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggedNodeId && draggedNodeId !== node.id) {
                              setDropTargetNodeId(node.id);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (draggedNodeId && draggedNodeId !== node.id) {
                              onReorderSelectedNodes(draggedNodeId, node.id);
                            }
                            setDraggedNodeId(null);
                            setDropTargetNodeId(null);
                          }}
                          onDoubleClick={() => onSetInfoNodeId(infoNodeId === node.id ? null : node.id)}
                          className={cn(
                            "snap-start relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl border border-l-[4px] bg-white px-4 py-3 text-left shadow-sm transition-all",
                            getNodeBorderLeftClass(node, branchMetaMap),
                            getNodeSurfaceClass(node, branchMetaMap),
                            draggedNodeId === node.id ? "opacity-50" : "",
                            dropTargetNodeId === node.id ? "border-[rgb(53,83,233)] ring-2 ring-[rgb(53,83,233)]/10" : "",
                            expandedAccessNodeIds.includes(node.id) ? "ring-1 ring-[rgb(53,83,233)]/15" : "",
                          )}
                        >
                          <button
                            type="button"
                            draggable
                            aria-label={`Drag ${node.name} to reorder`}
                            onClick={(event) => event.stopPropagation()}
                            onDragStart={(event) => {
                              event.stopPropagation();
                              setDraggedNodeId(node.id);
                            }}
                            onDragEnd={() => {
                              setDraggedNodeId(null);
                              setDropTargetNodeId(null);
                            }}
                            className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold", getNodeBadgeClass(node, branchMetaMap))}>
                            P{index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                            </div>
                            {!isRoot && breadcrumbByNodeId.get(node.id) ? (
                              <div className="truncate text-[11px] font-medium text-slate-500">{breadcrumbByNodeId.get(node.id)}</div>
                            ) : null}
                            {!isRoot ? (
                              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                            ) : null}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </div>
                      );
                    })()
                  ))}
                </div>

                <div
                  className={cn(
                    "pointer-events-none absolute bottom-0 right-[-8px] top-0 z-10 flex w-20 items-center justify-end bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent pb-2 pr-2 transition-opacity duration-300",
                    canScrollRight ? "opacity-100" : "opacity-0"
                  )}
                >
                  <button
                    type="button"
                    onClick={scrollListRight}
                    disabled={!canScrollRight}
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[rgb(53,83,233)]/30 hover:bg-slate-50 hover:text-[rgb(53,83,233)] focus-visible:outline-none"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {infoNodeId ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  {(() => {
                    const infoNode = selectedNodes.find((node) => node.id === infoNodeId);
                    if (!infoNode) return null;
                    const infoIndex = selectedNodes.findIndex((node) => node.id === infoNodeId);
                    const isInfoRoot = infoNode.nodeType.trim().toUpperCase() === "ROOT";

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold", getNodeBadgeClass(infoNode, branchMetaMap))}>
                              {infoIndex + 1}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{infoNode.name}</div>
                              {!isInfoRoot && breadcrumbByNodeId.get(infoNode.id) ? (
                                <div className="text-[11px] font-medium text-slate-500">{breadcrumbByNodeId.get(infoNode.id)}</div>
                              ) : null}
                              {!isInfoRoot ? (
                                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{infoNode.nodeType}</div>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSetInfoNodeId(null)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Close node info"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preference</div>
                            <div className="mt-1 font-semibold text-slate-700">{infoIndex + 1}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Type</div>
                            <div className="mt-1 font-semibold text-slate-700">{isInfoRoot ? "-" : infoNode.nodeType}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Path</div>
                            <div className="mt-1 break-all font-semibold text-slate-700">{isInfoRoot ? "-" : (infoNode.nodePath || "-")}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              No nodes selected yet.
            </div>
          )}
        </div>

        {selectedNodes.length > 0 ? (
          <div className="relative space-y-8">
            <button
              type="button"
              onClick={toggleExpandAll}
              className="absolute right-0 -top-4 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-[rgb(53,83,233)]/30 hover:text-[rgb(53,83,233)]"
              title={areAllExpanded ? "Collapse All" : "Expand All"}
            >
              {areAllExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-800">Primary Access</h4>
                  <p className="mt-1 text-xs text-slate-500">Selected node assigned as the primary access scope.</p>
                </div>
                {primarySelectedNode ? (
                  <div
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                      getNodeBadgeClass(primarySelectedNode, branchMetaMap),
                    )}
                  >
                    1 node
                  </div>
                ) : null}
              </div>
              {primarySelectedNode ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleNodeExpansion(primarySelectedNode.id)}
                    className={cn(
                      "relative flex w-full items-center justify-between gap-4 overflow-hidden border-b border-slate-200 border-l-[4px] bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                      getNodeBorderLeftClass(primarySelectedNode, branchMetaMap),
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          "border",
                          getNodeBadgeClass(primarySelectedNode, branchMetaMap),
                        )}
                      >
                        P1
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">{primarySelectedNode.name}</div>
                        {primarySelectedNode.nodeType.trim().toUpperCase() !== "ROOT" && breadcrumbByNodeId.get(primarySelectedNode.id) ? (
                          <div className="truncate text-[11px] font-medium text-slate-500">{breadcrumbByNodeId.get(primarySelectedNode.id)}</div>
                        ) : null}
                        {primarySelectedNode.nodeType.trim().toUpperCase() !== "ROOT" ? (
                          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                            {primarySelectedNode.nodeType}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expandedAccessNodeIds.includes(primarySelectedNode.id) ? "rotate-90" : "")} />
                  </button>
                  {expandedAccessNodeIds.includes(primarySelectedNode.id) ? (
                    <div className="bg-white">
                      <div className="border-t border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600">
                        Select a primary access right.
                      </div>
                      {renderNodePermissions(primarySelectedNode, ["primary"])}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-800">Secondary Access</h4>
                  <p className="mt-1 text-xs text-slate-500">All selected nodes are grouped here automatically.</p>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                    secondarySelectedNodes[0] ? getNodeBadgeClass(secondarySelectedNodes[0], branchMetaMap) : "border-slate-200 bg-slate-100 text-slate-500",
                  )}
                >
                  {secondarySelectedNodes.length} nodes
                </div>
              </div>

              <div className="space-y-3">
                {secondarySelectedNodes.length > 0 ? (
                  secondarySelectedNodes.map((node) => {
                    const isExpanded = expandedAccessNodeIds.includes(node.id);
                    const nodeIndex = selectedNodeIndexMap.get(node.id) ?? 0;

                    return (
                      <div key={node.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleNodeExpansion(node.id)}
                          className={cn(
                            "relative flex w-full items-center justify-between gap-4 overflow-hidden border-b border-slate-200 border-l-[4px] bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                            getNodeBorderLeftClass(node, branchMetaMap),
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                "border",
                                getNodeBadgeClass(node, branchMetaMap),
                              )}
                            >
                              {`S${nodeIndex}`}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                              {node.nodeType.trim().toUpperCase() !== "ROOT" && breadcrumbByNodeId.get(node.id) ? (
                                <div className="truncate text-[11px] font-medium text-slate-500">{breadcrumbByNodeId.get(node.id)}</div>
                              ) : null}
                              {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                                  {node.nodeType}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isExpanded ? "rotate-90" : "")} />
                        </button>
                        {isExpanded ? <div className="border-t border-slate-200 bg-white">{renderNodePermissions(node, ["secondary"])}</div> : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
                    No secondary nodes selected.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
            Select at least one node to configure access rights.
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default UserOnboardingStepAccessRights;
