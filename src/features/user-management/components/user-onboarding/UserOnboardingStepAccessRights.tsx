import { ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RoleRecord } from "@/services/role.service";
import type {
  NodePermissionBuckets,
  NodePermissionScopeBuckets,
  PermissionAction,
  SystemAccessScope,
  ValidationErrors,
} from "@/features/user-management/types";
import { PERMISSION_ACTIONS, formatRoleTokenLabel, getPermissionActionLabel } from "@/features/user-management/roleLabels";
import { createInitialPermissions } from "@/features/user-management/utils";
import {
  buildRoleCategoriesFromRoles,
  buildBranchMetaMap,
  buildNodeBreadcrumbMap,
  getPrimarySelectionFromPermissions,
  getNodeBadgeClass,
  getNodeBorderLeftClass,
  getNodeSubtitle,
  isRootOrgNode,
  isSystemAccessScopeItem,
} from "./UserOnboardingStepAccessRights.utils";
import { PermissionRow, type ActivePermissionSelection } from "./access-rights/PermissionRow";
import { SelectedNodesPanel } from "./access-rights/SelectedNodesPanel";

type StepAccessRightsProps = {
  orgStructure: OrgNode | null;
  selectedNodes: OrgNode[];
  roles: RoleRecord[];
  errors: ValidationErrors;
  expandedAccessNodeIds: string[];
  primaryNodeId: string | null;
  infoNodeId: string | null;
  nodePermissions: Record<string, NodePermissionBuckets>;
  nodePermissionScopes: Record<string, NodePermissionScopeBuckets>;
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
  onSetPermissionScope: (
    nodeId: string,
    bucket: keyof NodePermissionScopeBuckets,
    category: string,
    item: string,
    action: PermissionAction,
    scope: SystemAccessScope,
  ) => void;
};


export function UserOnboardingStepAccessRights({
  orgStructure,
  selectedNodes,
  roles,
  errors,
  expandedAccessNodeIds,
  primaryNodeId,
  infoNodeId,
  nodePermissions,
  nodePermissionScopes,
  onSetExpandedAccessNodeIds,
  onSetPrimaryNodeId,
  onReorderSelectedNodes,
  onSetInfoNodeId,
  onTogglePermission,
  onSetPermissionScope,
}: StepAccessRightsProps) {
  const branchMetaMap = buildBranchMetaMap(orgStructure);
  const breadcrumbByNodeId = useMemo(() => buildNodeBreadcrumbMap(orgStructure), [orgStructure]);
  const primarySelectedNode = selectedNodes.find((node) => node.id === primaryNodeId) ?? selectedNodes[0] ?? null;
  const secondarySelectedNodes = selectedNodes;
  const selectedNodeIndexMap = new Map(selectedNodes.map((node, index) => [node.id, index + 1] as const));
  const getAccessBadgeLabel = useCallback(
    (nodeId: string) => {
      const nodeOrder = selectedNodeIndexMap.get(nodeId) ?? 0;
      return primarySelectedNode?.id === nodeId ? "P1" : `S${nodeOrder}`;
    },
    [primarySelectedNode?.id, selectedNodeIndexMap],
  );
  const [expandedScopeRows, setExpandedScopeRows] = useState<string[]>([]);
  const roleCategories = buildRoleCategoriesFromRoles(roles);

  const renderNodePermissions = (
    node: OrgNode,
    bucketKeys: Array<keyof NodePermissionBuckets>,
  ) => {
    const buckets = nodePermissions[node.id];
    if (!buckets) return null;
    const primaryChoice = getPrimarySelectionFromPermissions(buckets.primary, roleCategories);
    const primarySelectedNodePrimaryChoice =
      primarySelectedNode ? getPrimarySelectionFromPermissions(nodePermissions[primarySelectedNode.id]?.primary ?? createInitialPermissions(roles), roleCategories) : null;
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
                  const scopeValues = nodePermissionScopes[node.id]?.[bucketKey]?.[categoryKey]?.[item.key] ?? {};
                  const showScopePicker = categoryKey.trim().toUpperCase() === "SYSTEM_ACCESS" && isSystemAccessScopeItem(item.key);
                  const scopeRowKey = `${node.id}::${bucketKey}::${categoryKey}::${item.key}`;

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
                      scopeByAction={scopeValues}
                      showScopePicker={showScopePicker}
                      scopeExpanded={expandedScopeRows.includes(scopeRowKey)}
                      onToggle={(cat, key, action) => {
                        const nextValue = !currentItem[action];
                          onTogglePermission(node.id, bucketKey, cat, key, action);

                        if (!showScopePicker) return;

                        if (nextValue) {
                          onSetPermissionScope(node.id, bucketKey, cat, key, action, "ALL_CHILD");
                          setExpandedScopeRows((current) => (current.includes(scopeRowKey) ? current : [...current, scopeRowKey]));
                        } else {
                          const remainingCount = PERMISSION_ACTIONS.filter((permAction) =>
                            permAction === action ? false : Boolean(currentItem[permAction]),
                          ).length;
                          if (remainingCount === 0) {
                            setExpandedScopeRows((current) => current.filter((id) => id !== scopeRowKey));
                          }
                        }
                      }}
                      onScopeChange={(cat, key, action, scope) => onSetPermissionScope(node.id, bucketKey, cat, key, action, scope)}
                      onToggleScopeExpanded={(cat, key) => {
                        const rowKey = `${node.id}::${bucketKey}::${cat}::${key}`;
                        setExpandedScopeRows((current) =>
                          current.includes(rowKey) ? current.filter((id) => id !== rowKey) : [...current, rowKey],
                        );
                      }}
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

        <SelectedNodesPanel
          selectedNodes={selectedNodes}
          infoNodeId={infoNodeId}
          branchMetaMap={branchMetaMap}
          breadcrumbByNodeId={breadcrumbByNodeId}
          expandedAccessNodeIds={expandedAccessNodeIds}
          onSetExpandedAccessNodeIds={onSetExpandedAccessNodeIds}
          onSetPrimaryNodeId={onSetPrimaryNodeId}
          onReorderSelectedNodes={onReorderSelectedNodes}
          onSetInfoNodeId={onSetInfoNodeId}
          getAccessBadgeLabel={getAccessBadgeLabel}
        />

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
                        {!isRootOrgNode(primarySelectedNode) ? (
                          <div className="truncate text-[11px] font-medium text-slate-500">{getNodeSubtitle(primarySelectedNode, breadcrumbByNodeId)}</div>
                        ) : null}
                        {!isRootOrgNode(primarySelectedNode) ? (
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
                              {!isRootOrgNode(node) ? (
                                <div className="truncate text-[11px] font-medium text-slate-500">{getNodeSubtitle(node, breadcrumbByNodeId)}</div>
                              ) : null}
                              {!isRootOrgNode(node) ? (
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
