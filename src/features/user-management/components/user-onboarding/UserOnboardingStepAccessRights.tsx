import { Check, ChevronLeft, ChevronRight, GripVertical, Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { getOrgNodeBadgeTheme, getOrgNodeTheme } from "@/features/user-management/utils";

type StepAccessRightsProps = {
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

function PermissionRow({
  category,
  itemKey,
  label,
  checked,
  variant,
  selectedChoice,
  occupiedChoice,
  onToggle,
}: {
  category: string;
  itemKey: string;
  label: string;
  checked: PermissionBucket;
  variant: "primary" | "secondary";
  selectedChoice?: ActivePermissionSelection | null;
  occupiedChoice?: ActivePermissionSelection | null;
  onToggle: (category: string, itemKey: string, action: PermissionAction) => void;
}) {
  const activeAction = (["manager", "user", "viewer"] as PermissionAction[]).find((action) => checked[action]) ?? null;

  return (
    <div className="grid grid-cols-4 items-center border-b border-slate-100 px-4 py-2.5 transition-colors hover:bg-slate-50/50 last:border-b-0">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {(["manager", "user", "viewer"] as PermissionAction[]).map((action) => (
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
            const shouldDisable = isPrimaryDisabled || isOccupied;
            const isFilled = checked[action] || isSelected;

            const button = (
              <button
                type="button"
                aria-pressed={isFilled || isOccupied}
                aria-label={`${label} ${action}`}
                disabled={shouldDisable}
                onClick={() => onToggle(category, itemKey, action)}
                className={cn(
                  "flex h-6.5 w-6.5 items-center justify-center rounded-sm border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(53,83,233)]/30",
                  isFilled
                    ? "border-[rgb(53,83,233)] bg-[rgb(53,83,233)] text-white shadow-[0_6px_14px_rgba(53,83,233,0.28)]"
                    : "border-slate-300 bg-white text-transparent hover:border-slate-400 hover:bg-slate-50",
                  shouldDisable ? "cursor-not-allowed border-slate-200 bg-slate-100 text-transparent hover:border-slate-200 hover:bg-slate-100" : "",
                )}
              >
                {variant === "primary" ? (
                  <span
                    className={cn("text-[10px] font-black uppercase tracking-[0.08em] transition-transform duration-150", isFilled ? "scale-100" : "scale-0")}
                  >
                    P
                  </span>
                ) : (
                  <Check className={cn("h-3.5 w-3.5 transition-transform duration-150", isFilled ? "scale-100" : "scale-0")} />
                )}
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

            return button;
          })()}
        </div>
      ))}
    </div>
  );
}

export function UserOnboardingStepAccessRights({
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
        const label = role.subCategory
          .split("_")
          .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
        mods.set(role.subCategory, label);
      }
      return acc;
    }, new Map<string, Map<string, string>>()),
    ([category, mods]) => ({
      categoryKey: category,
      label: category
        .split("_")
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(" "),
      items: Array.from(mods, ([key, label]) => ({ key, label })),
    }),
  );

  const getPrimarySelection = (permissions: NodePermissionBuckets["primary"]): ActivePermissionSelection | null => {
    for (const { categoryKey, items } of roleCategories) {
      for (const item of items) {
        const rights = permissions[categoryKey]?.[item.key];
        if (!rights) continue;
        for (const action of ["manager", "user", "viewer"] as PermissionAction[]) {
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
    const occupiedPrimaryChoice = node.id === primarySelectedNode?.id ? primaryChoice : null;

    return bucketKeys.map((bucketKey) => (
      <div key={`${node.id}-${bucketKey}`} className="overflow-hidden bg-white">
        <div className="grid grid-cols-4 bg-[rgba(30,66,189,1)] px-4 py-2.5 text-[11px] font-semibold text-white">
          <div>Module</div>
          <div className="text-center">Manager</div>
          <div className="text-center">User</div>
          <div className="text-center">Viewer</div>
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
                        "snap-start relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-all",
                        draggedNodeId === node.id ? "opacity-50" : "",
                        dropTargetNodeId === node.id ? "border-[rgb(53,83,233)] ring-2 ring-[rgb(53,83,233)]/10" : "",
                        expandedAccessNodeIds.includes(node.id) ? "border-slate-300 bg-slate-50/80" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
                      )}
                    >
                      {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                        <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                      ) : null}
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
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </div>
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

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(infoNode.nodeType))}>
                              {infoIndex + 1}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{infoNode.name}</div>
                              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{infoNode.nodeType}</div>
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
                            <div className="mt-1 font-semibold text-slate-700">{infoNode.nodeType}</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Path</div>
                            <div className="mt-1 break-all font-semibold text-slate-700">{infoNode.nodePath || "-"}</div>
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
                  <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    1 node
                  </div>
                ) : null}
              </div>
              {primarySelectedNode ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleNodeExpansion(primarySelectedNode.id)}
                    className="relative flex w-full items-center justify-between gap-4 overflow-hidden border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    {primarySelectedNode.nodeType.trim().toUpperCase() !== "ROOT" ? (
                      <span
                        className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(primarySelectedNode.nodeType).edge)}
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          getOrgNodeBadgeTheme(primarySelectedNode.nodeType),
                        )}
                      >
                        {selectedNodeIndexMap.get(primarySelectedNode.id)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">{primarySelectedNode.name}</div>
                        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                          {primarySelectedNode.nodeType}
                        </div>
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
                <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                          className="relative flex w-full items-center justify-between gap-4 overflow-hidden border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                        >
                          {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                            <span
                              className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)}
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                getOrgNodeBadgeTheme(node.nodeType),
                              )}
                            >
                              {nodeIndex}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                                {node.nodeType}
                              </div>
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
