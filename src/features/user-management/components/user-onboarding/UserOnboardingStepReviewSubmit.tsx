import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { ChevronRight, Eye, Expand, Minimize2, Pencil, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { UserOnboardingFormData, NodePermissionBuckets, NodePermissionScopeBuckets, PermissionAction, UserOnboardingPermissions } from "@/features/user-management/types";
import { formatRoleTokenLabel, getPermissionActionFromText, getPermissionActionLabelFromText } from "@/features/user-management/roleLabels";
import { getNodeAccentBackground, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";
import { formatCollapsedNodePath } from "@/features/user-management/utils";

type StepReviewSubmitProps = {
  orgStructure: OrgNode | null;
  basic: UserOnboardingFormData["basic"];
  isEditMode?: boolean;
  previousReviewSnapshot?: {
    basic: UserOnboardingFormData["basic"];
    selectedNodes: OrgNode[];
    primaryNodeId: string | null;
    nodePermissions: Record<string, NodePermissionBuckets>;
    nodePermissionScopes: Record<string, NodePermissionScopeBuckets>;
    selectedWorkflow: string;
  } | null;
  isGlobalSignatory: boolean;
  selectedNodes: OrgNode[];
  primaryNodeId: string | null;
  nodePermissions: Record<string, NodePermissionBuckets>;
  nodePermissionScopes: Record<string, NodePermissionScopeBuckets>;
  selectedWorkflow: string;
  expandedAccessNodeIds: string[];
  isReviewAccessExpanded: boolean;
  reviewAccessNodeRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSetExpandedAccessNodeIds: (ids: string[] | ((current: string[]) => string[])) => void;
  onSetIsReviewAccessExpanded: (value: boolean) => void;
};

type BranchMeta = {
  branchIndex: number | null;
  branchDepth: number;
};

type NodeDiffStatus = "added" | "removed" | null;

type SecondaryReviewEntry = {
  node: OrgNode;
  nodeId: string;
  diffStatus: NodeDiffStatus;
  ignorePreviousState?: boolean;
};

const EMPTY_NODES: OrgNode[] = [];

const getNodeDiffTheme = (status: NodeDiffStatus) => {
  if (status === "added") {
    return {
      wrapper: "border-emerald-300 bg-white",
    };
  }

  if (status === "removed") {
    return {
      wrapper: "border-rose-200 bg-rose-50/40",
      leftBorder: "border-l-rose-500",
      badge: "border-rose-300 bg-rose-50 text-rose-700",
      title: "text-rose-700",
    };
  }

  return {
    wrapper: "border-slate-200 bg-white",
    leftBorder: "",
    badge: "",
    title: "text-slate-800",
  };
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

const CATEGORY_ORDER = ["TRANSACTIONAL", "OPERATIONAL", "SYSTEM_ACCESS"];

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

const BRANCH_HOVER_BY_ACCENT: Record<string, string> = {
  "bg-orange-500": "hover:border-orange-300 hover:bg-orange-50/70",
  "bg-orange-300": "hover:border-orange-300 hover:bg-orange-50/70",
  "bg-orange-200": "hover:border-orange-200 hover:bg-orange-50/70",
  "bg-orange-100": "hover:border-orange-200 hover:bg-orange-50/70",
  "bg-sky-500": "hover:border-sky-300 hover:bg-sky-50/70",
  "bg-sky-300": "hover:border-sky-300 hover:bg-sky-50/70",
  "bg-sky-200": "hover:border-sky-200 hover:bg-sky-50/70",
  "bg-sky-100": "hover:border-sky-200 hover:bg-sky-50/70",
  "bg-emerald-500": "hover:border-emerald-300 hover:bg-emerald-50/70",
  "bg-emerald-300": "hover:border-emerald-300 hover:bg-emerald-50/70",
  "bg-emerald-200": "hover:border-emerald-200 hover:bg-emerald-50/70",
  "bg-emerald-100": "hover:border-emerald-200 hover:bg-emerald-50/70",
  "bg-rose-500": "hover:border-rose-300 hover:bg-rose-50/70",
  "bg-rose-300": "hover:border-rose-300 hover:bg-rose-50/70",
  "bg-rose-200": "hover:border-rose-200 hover:bg-rose-50/70",
  "bg-rose-100": "hover:border-rose-200 hover:bg-rose-50/70",
  "bg-amber-500": "hover:border-amber-300 hover:bg-amber-50/70",
  "bg-amber-300": "hover:border-amber-300 hover:bg-amber-50/70",
  "bg-amber-200": "hover:border-amber-200 hover:bg-amber-50/70",
  "bg-amber-100": "hover:border-amber-200 hover:bg-amber-50/70",
  "bg-cyan-500": "hover:border-cyan-300 hover:bg-cyan-50/70",
  "bg-cyan-300": "hover:border-cyan-300 hover:bg-cyan-50/70",
  "bg-cyan-200": "hover:border-cyan-200 hover:bg-cyan-50/70",
  "bg-cyan-100": "hover:border-cyan-200 hover:bg-cyan-50/70",
  "bg-slate-400": "hover:border-indigo-200 hover:bg-indigo-50/50",
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

const getNodeHoverClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) =>
  BRANCH_HOVER_BY_ACCENT[getNodeAccentClass(node, branchMetaMap)] ?? "hover:border-slate-300 hover:bg-slate-50";

const getPermissionBadgeTheme = (label: string) => {
  const normalized = label.trim().toLowerCase();
  if (normalized === "checker") {
    return {
      Icon: ShieldCheck,
      className: "bg-violet-50 text-violet-700",
    };
  }
  if (normalized === "maker") {
    return {
      Icon: Pencil,
      className: "bg-amber-50 text-amber-700",
    };
  }
  return {
    Icon: Eye,
    className: "bg-slate-100 text-slate-600",
  };
};

type SelectedPermissionSection = {
  categoryKey: string;
  selectedItems: Array<{ itemKey: string; activeRights: string[]; activeScopeByAction: Partial<Record<PermissionAction, string>> }>;
};

const formatScopeLabel = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ALL_CHILD") return "All Child";
  if (normalized === "IMMEDIATE_CHILD") return "Immediate Child";
  return "Node";
};

const getOrderedPermissionLabels = (activeRights: string[]) => {
  const labels = new Set(activeRights.map((right) => getPermissionActionLabelFromText(right)));
  return ["Checker", "Maker", "Viewer"].filter((label) => labels.has(label));
};

const getSelectedSections = (
  permissions: UserOnboardingPermissions,
  permissionScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>,
): SelectedPermissionSection[] => {
  const sections = Object.entries(permissions)
    .map(([categoryKey, items]) => {
      const selectedItems = Object.entries(items)
        .map(([itemKey, rights]) => ({
          itemKey,
          activeRights: Object.entries(rights as Record<string, boolean>)
            .filter(([, value]) => value)
            .map(([key]) => key),
          activeScopeByAction: permissionScopes?.[categoryKey]?.[itemKey] ?? {},
        }))
        .filter((entry) => entry.activeRights.length > 0);

      return selectedItems.length > 0 ? { categoryKey, selectedItems } : null;
    })
    .filter(Boolean) as SelectedPermissionSection[];

  return sections.sort((a, b) => {
    const left = CATEGORY_ORDER.indexOf(a.categoryKey.toUpperCase());
    const right = CATEGORY_ORDER.indexOf(b.categoryKey.toUpperCase());
    if (left === -1 && right === -1) return a.categoryKey.localeCompare(b.categoryKey);
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  });
};

const normalizeValue = (value?: string) => (value || "").trim();

const hasSelectedRights = (
  permissions: UserOnboardingPermissions,
  permissionScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>,
) => getSelectedSections(permissions, permissionScopes).length > 0;

const buildPermissionChangeSignature = (
  permissions: UserOnboardingPermissions,
  permissionScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>,
) =>
  getSelectedSections(permissions, permissionScopes)
    .flatMap((section) =>
      section.selectedItems.flatMap((item) =>
        getOrderedPermissionLabels(item.activeRights).map((label) => {
          const action = getPermissionActionFromText(label);
          const scope =
            action && section.categoryKey.trim().toUpperCase() === "SYSTEM_ACCESS"
              ? item.activeScopeByAction[action] ?? "NODE"
              : "";
          return `${section.categoryKey}|${item.itemKey}|${label}|${scope}`;
        }),
      ),
    )
    .sort()
    .join("::");

const havePermissionSelectionsChanged = (
  currentPermissions: UserOnboardingPermissions,
  currentScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>,
  previousPermissions: UserOnboardingPermissions,
  previousScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>,
) =>
  buildPermissionChangeSignature(currentPermissions, currentScopes) !==
  buildPermissionChangeSignature(previousPermissions, previousScopes);

const DiffValue = ({
  previousValue,
  currentValue,
  highlightAdded = false,
}: {
  previousValue?: string;
  currentValue: string;
  highlightAdded?: boolean;
}) => {
  const prev = normalizeValue(previousValue);
  const curr = normalizeValue(currentValue);
  if (highlightAdded && !prev && curr && curr !== "-") {
    return (
      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
        {curr}
      </span>
    );
  }
  if (!prev || prev === curr) {
    return <span className="font-semibold text-slate-900">{curr || "-"}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-500 line-through">{prev}</span>
      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{curr || "-"}</span>
    </span>
  );
};

function NodePermissionCard({
  node,
  isDiffMode = false,
  diffStatus = null,
  badgeLabel,
  permissions,
  previousPermissions,
  branchMetaMap,
  breadcrumbByNodeId,
  emptyText,
  permissionScopes,
  previousPermissionScopes,
  onClose,
}: {
  node: OrgNode;
  isDiffMode?: boolean;
  diffStatus?: NodeDiffStatus;
  badgeLabel: string;
  permissions: UserOnboardingPermissions;
  previousPermissions?: UserOnboardingPermissions;
  branchMetaMap: Map<string, BranchMeta>;
  breadcrumbByNodeId: Map<string, string>;
  emptyText: string;
  permissionScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>;
  previousPermissionScopes?: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>;
  onClose?: () => void;
}) {
  const selectedSections = getSelectedSections(permissions, permissionScopes);
  const previousSections = getSelectedSections(previousPermissions ?? {}, previousPermissionScopes ?? {});
  const hasRemovedOnly = isDiffMode && selectedSections.length === 0 && previousSections.length > 0;
  const displaySections = selectedSections.length > 0 ? selectedSections : (isDiffMode ? previousSections : []);
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const parentSubtitle = isRoot ? "" : formatCollapsedNodePath(breadcrumbByNodeId.get(node.id) || "");
  const diffTheme = getNodeDiffTheme(diffStatus);
  const nodeBorderLeftClass = diffStatus === "removed" ? "border-l-rose-500" : getNodeBorderLeftClass(node, branchMetaMap);
  const nodeBadgeClass = diffStatus === "removed" ? "border-rose-300 bg-rose-50 text-rose-700" : getNodeBadgeClass(node, branchMetaMap);
  const nodeTitleClass = diffStatus === "removed" ? "text-rose-700" : "text-slate-800";

  const buildLookup = (
    sourcePermissions: UserOnboardingPermissions,
    sourceScopes: Record<string, Record<string, Partial<Record<PermissionAction, string>>>>,
  ) => {
    const map = new Map<string, { label: string; scopeLabel: string | null }>();
    const sections = getSelectedSections(sourcePermissions, sourceScopes);
    sections.forEach((section) => {
      section.selectedItems.forEach((item) => {
        const orderedLabels = getOrderedPermissionLabels(item.activeRights);
        orderedLabels.forEach((label) => {
          const action = getPermissionActionFromText(label);
          const scopeLabel =
            action && section.categoryKey.trim().toUpperCase() === "SYSTEM_ACCESS"
              ? formatScopeLabel(item.activeScopeByAction[action] ?? "NODE")
              : null;
          map.set(`${section.categoryKey}|${item.itemKey}|${label}`, { label, scopeLabel });
        });
      });
    });
    return map;
  };

  const currentLookup = buildLookup(permissions, permissionScopes);
  const previousLookup = buildLookup(previousPermissions ?? {}, previousPermissionScopes ?? {});

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-l-[4px] p-3 shadow-sm",
        diffTheme.wrapper,
        nodeBorderLeftClass,
        hasRemovedOnly && "border-rose-200 bg-rose-50/40",
      )}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={`Close ${node.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
        <div className="mb-3 flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold", nodeBadgeClass || getNodeBadgeClass(node, branchMetaMap))}>
            {badgeLabel}
          </div>
          <div>
            <div className={cn("text-[18px] font-semibold leading-tight", nodeTitleClass)}>{node.name}</div>
            {!isRoot && parentSubtitle ? <div className="text-[11px] font-medium text-slate-500">{parentSubtitle}</div> : null}
            {!isRoot ? <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{node.nodeType}</div> : null}
          </div>
        </div>

      <div className="space-y-2.5 rounded-xl bg-slate-50/30 p-3">
        {displaySections.length === 0 ? (
          <div className={cn("text-sm", hasRemovedOnly ? "text-rose-500" : "text-slate-400")}>{emptyText}</div>
        ) : (
          displaySections.map((section) => (
            <div key={`${node.id}-${section.categoryKey}`} className="space-y-2">
              <div className="border-b border-slate-200 pb-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {formatRoleTokenLabel(section.categoryKey)}
              </div>
              {section.selectedItems.map((item) => {
                const orderedLabels = getOrderedPermissionLabels(item.activeRights);
                const previousSection = previousSections.find((entry) => entry.categoryKey === section.categoryKey);
                const previousItem = previousSection?.selectedItems.find((entry) => entry.itemKey === item.itemKey);
                const previousOrderedLabels = previousItem ? getOrderedPermissionLabels(previousItem.activeRights) : [];
                const allLabels = Array.from(new Set([...orderedLabels, ...previousOrderedLabels]));
                return (
                  <div
                    key={`${node.id}-${section.categoryKey}-${item.itemKey}`}
                    className="grid grid-cols-1 items-start gap-2 text-sm leading-[1.35] md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-4"
                  >
                    <span className="min-w-0 whitespace-normal pt-0.5 pr-1 font-medium text-slate-600">
                      {formatRoleTokenLabel(item.itemKey)}
                    </span>
                    <span className="flex max-w-[520px] flex-wrap justify-start gap-2 md:justify-end">
                      {allLabels.map((label) => {
                        const theme = getPermissionBadgeTheme(label);
                        const BadgeIcon = theme.Icon;
                        const key = `${section.categoryKey}|${item.itemKey}|${label}`;
                        const currentValue = currentLookup.get(key);
                        const previousValue = previousLookup.get(key);
                        const isAdded = !previousValue && Boolean(currentValue);
                        const isRemoved = Boolean(previousValue) && !currentValue;
                        const isChanged =
                          Boolean(previousValue && currentValue) &&
                          previousValue.scopeLabel !== currentValue.scopeLabel;
                        const showAsDiff = isDiffMode && (isAdded || isRemoved || isChanged);
                        const currentLabelText = currentValue
                          ? currentValue.scopeLabel
                            ? `${currentValue.label} - ${currentValue.scopeLabel}`
                            : currentValue.label
                          : "";
                        const previousLabelText = previousValue
                          ? previousValue.scopeLabel
                            ? `${previousValue.label} - ${previousValue.scopeLabel}`
                            : previousValue.label
                          : "";

                        if (isDiffMode && isRemoved) {
                          return (
                            <span
                              key={`${node.id}-${section.categoryKey}-${item.itemKey}-${label}-removed`}
                              className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-500 line-through"
                            >
                              <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                              {previousLabelText}
                            </span>
                          );
                        }
                        return (
                          <span
                            key={`${node.id}-${section.categoryKey}-${item.itemKey}-${label}`}
                            className={cn(
                              "inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                              showAsDiff
                                ? isAdded
                                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : theme.className,
                            )}
                          >
                            <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                            {showAsDiff ? (
                              <DiffValue previousValue={previousLabelText} currentValue={currentLabelText} highlightAdded={isAdded} />
                            ) : (
                              currentLabelText || previousLabelText
                            )}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BasicDetailRow({
  label,
  value,
  previousValue,
  highlightAdded = false,
}: {
  label: string;
  value: string;
  previousValue?: string;
  highlightAdded?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_10px_1fr] items-center gap-x-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <DiffValue previousValue={previousValue} currentValue={value || "-"} highlightAdded={highlightAdded} />
    </div>
  );
}

export function UserOnboardingStepReviewSubmit({
  orgStructure,
  basic,
  isEditMode = false,
  previousReviewSnapshot = null,
  isGlobalSignatory,
  selectedNodes,
  primaryNodeId,
  nodePermissions,
  nodePermissionScopes,
  selectedWorkflow,
  expandedAccessNodeIds,
  isReviewAccessExpanded,
  reviewAccessNodeRefs,
  onSetExpandedAccessNodeIds,
  onSetIsReviewAccessExpanded,
}: StepReviewSubmitProps) {
  const previousBasic = previousReviewSnapshot?.basic ?? null;
  const previousSelectedNodes = previousReviewSnapshot?.selectedNodes ?? EMPTY_NODES;
  const previousPrimaryNodeId = previousReviewSnapshot?.primaryNodeId ?? null;
  const previousNodePermissions = previousReviewSnapshot?.nodePermissions ?? {};
  const previousNodePermissionScopes = previousReviewSnapshot?.nodePermissionScopes ?? {};
  const previousSelectedWorkflow = previousReviewSnapshot?.selectedWorkflow ?? "";
  const reportingManagerName = basic.reportingManagerName || basic.reportingManager || "-";
  const reportingManagerEmail =
    basic.reportingManagerEmail ||
    (basic.reportingManager.includes("@") ? basic.reportingManager : "") ||
    "-";
  const branchMetaMap = buildBranchMetaMap(orgStructure);
  const breadcrumbByNodeId = useMemo(() => buildNodeBreadcrumbMap(orgStructure), [orgStructure]);
  const hasAutoConfiguredEditExpansionRef = useRef(false);
  const [collapsedFocusedNodeId, setCollapsedFocusedNodeId] = useState<"primary" | string | null>(null);
  const primaryNode = primaryNodeId ? selectedNodes.find((node) => node.id === primaryNodeId) ?? null : null;
  const previousPrimaryNode = previousPrimaryNodeId
    ? previousSelectedNodes.find((node) => node.id === previousPrimaryNodeId) ?? null
    : null;
  const globalNodeName = (orgStructure?.name || selectedNodes[0]?.name || "-").trim() || "-";
  const primaryPermissions = primaryNode ? nodePermissions[primaryNode.id]?.primary ?? {} : {};
  const hasPrimaryChanged = Boolean(primaryNode?.id !== previousPrimaryNode?.id && (primaryNode || previousPrimaryNode));
  const currentPrimaryDiffStatus: NodeDiffStatus = hasPrimaryChanged && primaryNode ? "added" : null;
  const previousPrimaryReplacementNode = hasPrimaryChanged ? previousPrimaryNode : null;
  const currentSecondaryNodeIds = selectedNodes.map((node) => node.id);
  const previousSecondaryNodeIds = previousSelectedNodes.map((node) => node.id);
  const currentSecondaryIndexById = useMemo(
    () => new Map(currentSecondaryNodeIds.map((nodeId, index) => [nodeId, index])),
    [currentSecondaryNodeIds],
  );
  const previousSecondaryIndexById = useMemo(
    () => new Map(previousSecondaryNodeIds.map((nodeId, index) => [nodeId, index])),
    [previousSecondaryNodeIds],
  );
  const secondaryReviewEntries = useMemo<SecondaryReviewEntry[]>(() => {
    const currentNodeById = new Map(selectedNodes.map((node) => [node.id, node]));
    const previousNodeById = new Map(previousSelectedNodes.map((node) => [node.id, node]));
    const orderedIds = [...currentSecondaryNodeIds, ...previousSecondaryNodeIds.filter((nodeId) => !currentSecondaryNodeIds.includes(nodeId))];

    return orderedIds
      .map((nodeId) => {
        const currentNode = currentNodeById.get(nodeId) ?? null;
        const previousNode = previousNodeById.get(nodeId) ?? null;
        const node = currentNode ?? previousNode;
        if (!node) return null;
        const currentSecondaryIndex = currentSecondaryIndexById.get(nodeId);
        const previousSecondaryIndex = previousSecondaryIndexById.get(nodeId);
        const reorderedWithinSecondary =
          currentNode &&
          previousNode &&
          currentSecondaryIndex !== undefined &&
          previousSecondaryIndex !== undefined &&
          currentSecondaryIndex !== previousSecondaryIndex;

        return {
          node,
          nodeId,
          ignorePreviousState: false,
          diffStatus:
            currentNode && (!previousNode || reorderedWithinSecondary)
              ? "added"
              : !currentNode && previousNode
                ? "removed"
                : null,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftCurrentIndex = currentSecondaryIndexById.get(left.nodeId);
        const rightCurrentIndex = currentSecondaryIndexById.get(right.nodeId);
        if (leftCurrentIndex !== undefined && rightCurrentIndex !== undefined) {
          return leftCurrentIndex - rightCurrentIndex;
        }
        if (leftCurrentIndex !== undefined) return -1;
        if (rightCurrentIndex !== undefined) return 1;

        const leftPreviousIndex = previousSecondaryIndexById.get(left.nodeId);
        const rightPreviousIndex = previousSecondaryIndexById.get(right.nodeId);
        if (leftPreviousIndex !== undefined && rightPreviousIndex !== undefined) {
          return leftPreviousIndex - rightPreviousIndex;
        }
        if (leftPreviousIndex !== undefined) return -1;
        if (rightPreviousIndex !== undefined) return 1;

        return left.node.name.localeCompare(right.node.name);
      }) as SecondaryReviewEntry[];
  }, [
    currentSecondaryIndexById,
    currentSecondaryNodeIds,
    previousSecondaryIndexById,
    previousSecondaryNodeIds,
    previousSelectedNodes,
    selectedNodes,
  ]);
  const secondaryBadgeByNodeId = useMemo(
    () => {
      const currentIndexById = new Map(selectedNodes.map((node, index) => [node.id, index + 1]));
      const previousIndexById = new Map(previousSelectedNodes.map((node, index) => [node.id, index + 1]));

      return new Map(
        secondaryReviewEntries.map((entry) => [
          entry.nodeId,
          `S${currentIndexById.get(entry.nodeId) ?? previousIndexById.get(entry.nodeId) ?? 1}`,
        ]),
      );
    },
    [previousSelectedNodes, secondaryReviewEntries, selectedNodes],
  );
  const collapsedSelectableIds = useMemo(() => {
    const ids: Array<"primary" | string> = [];
    if (primaryNode) ids.push("primary");
    secondaryReviewEntries.forEach((entry) => ids.push(entry.nodeId));
    return ids;
  }, [primaryNode, secondaryReviewEntries]);

  useEffect(() => {
    if (collapsedSelectableIds.length === 0 || (collapsedFocusedNodeId && !collapsedSelectableIds.includes(collapsedFocusedNodeId))) {
      setCollapsedFocusedNodeId(null);
    }
  }, [collapsedFocusedNodeId, collapsedSelectableIds]);

  const primaryReviewIsEdited = Boolean(
    primaryNode &&
      (hasPrimaryChanged ||
        havePermissionSelectionsChanged(
          nodePermissions[primaryNode.id]?.primary ?? {},
          nodePermissionScopes[primaryNode.id]?.primary ?? {},
          previousPrimaryNode ? previousNodePermissions[previousPrimaryNode.id]?.primary ?? {} : {},
          previousPrimaryNode ? previousNodePermissionScopes[previousPrimaryNode.id]?.primary ?? {} : {},
        )),
  );

  const editedSecondaryNodeIds = useMemo(
    () =>
      secondaryReviewEntries
        .filter((entry) => {
          if (entry.diffStatus) return true;
          return havePermissionSelectionsChanged(
            nodePermissions[entry.nodeId]?.secondary ?? {},
            nodePermissionScopes[entry.nodeId]?.secondary ?? {},
            entry.ignorePreviousState ? {} : previousNodePermissions[entry.nodeId]?.secondary ?? {},
            entry.ignorePreviousState ? {} : previousNodePermissionScopes[entry.nodeId]?.secondary ?? {},
          );
        })
        .map((entry) => entry.nodeId),
    [
      nodePermissionScopes,
      nodePermissions,
      previousNodePermissionScopes,
      previousNodePermissions,
      secondaryReviewEntries,
    ],
  );

  const defaultEditExpandedNodeIds = useMemo(
    () => [
      ...(primaryReviewIsEdited && primaryNode ? [primaryNode.id] : []),
      ...editedSecondaryNodeIds,
    ],
    [editedSecondaryNodeIds, primaryNode, primaryReviewIsEdited],
  );

  const effectiveExpandedAccessNodeIds =
    isEditMode && !hasAutoConfiguredEditExpansionRef.current
      ? defaultEditExpandedNodeIds
      : expandedAccessNodeIds;

  useEffect(() => {
    if (!isEditMode || !isReviewAccessExpanded || hasAutoConfiguredEditExpansionRef.current) return;

    onSetExpandedAccessNodeIds(defaultEditExpandedNodeIds);
    hasAutoConfiguredEditExpansionRef.current = true;
  }, [
    defaultEditExpandedNodeIds,
    isEditMode,
    isReviewAccessExpanded,
    onSetExpandedAccessNodeIds,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex min-h-0 flex-1 flex-col p-1 sm:p-2">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
          <h4 className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-500">Access Rights</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const nextValue = !isReviewAccessExpanded;
              if (nextValue) {
                onSetExpandedAccessNodeIds(selectedNodes.map((node) => node.id));
              }
              onSetIsReviewAccessExpanded(nextValue);
            }}
            className="h-8 w-8 rounded-md border border-slate-200 p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            aria-label={isReviewAccessExpanded ? "Collapse access rights" : "Expand access rights"}
          >
            {isReviewAccessExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-0.5">
          {isReviewAccessExpanded ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <div className="grid items-stretch grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                    <div className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-black uppercase tracking-widest text-slate-600">
                      Basic Details
                    </div>
                    <div className="space-y-2 text-sm">
                      <BasicDetailRow label="Name" value={basic.name} previousValue={isEditMode ? previousBasic?.name : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Email" value={basic.email} previousValue={isEditMode ? previousBasic?.email : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Phone" value={basic.phone} previousValue={isEditMode ? previousBasic?.phone : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Designation" value={basic.designation} previousValue={isEditMode ? previousBasic?.designation : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Employee ID" value={basic.employeeId || "-"} previousValue={isEditMode ? previousBasic?.employeeId : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Workflow" value={selectedWorkflow || "-"} previousValue={isEditMode ? previousSelectedWorkflow : undefined} highlightAdded={isEditMode} />
                    </div>
                  </div>

                  {isGlobalSignatory ? (
                    <div className="flex h-full min-h-[220px] flex-col rounded-xl border border-emerald-200 bg-white p-3 shadow-sm ring-1 ring-emerald-100/70">
                      <div className="flex h-full flex-col rounded-2xl border border-emerald-200 bg-white p-4">
                        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200 bg-white/80 text-emerald-700">
                          <ShieldCheck className="h-9 w-9" />
                        </div>
                        <div className="mb-3 border-b border-emerald-200 pb-2 text-[12px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">
                          Global Access
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                          <div className="flex items-center gap-2 text-[14px]">
                            <span className="text-slate-500">Node Name</span>
                            <span className="text-slate-400">:</span>
                            <span className="font-extrabold text-slate-900">{globalNodeName}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[14px]">
                            <span className="text-slate-500">Access Category</span>
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                              All Child
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[220px] flex-col space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" />
                        <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#4F46E5]">Primary Access</span>
                      </div>
                      {primaryNode ? (
                        isEditMode && !effectiveExpandedAccessNodeIds.includes(primaryNode.id) ? (
                          <button
                            type="button"
                            onClick={() => onSetExpandedAccessNodeIds((current) => (current.includes(primaryNode.id) ? current : [...current, primaryNode.id]))}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md border border-l-[4px] px-2.5 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                              primaryReviewIsEdited ? "border-emerald-300 bg-white hover:border-emerald-300 hover:bg-emerald-50/70" : "border-slate-200 bg-white",
                              getNodeBorderLeftClass(primaryNode, branchMetaMap),
                              !primaryReviewIsEdited && getNodeHoverClass(primaryNode, branchMetaMap),
                            )}
                          >
                            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", getNodeBadgeClass(primaryNode, branchMetaMap))}>
                              P1
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-700">{primaryNode.name}</div>
                              {primaryNode.nodeType.trim().toUpperCase() !== "ROOT" && breadcrumbByNodeId.get(primaryNode.id) ? (
                                <div className="break-words text-[10px] font-medium text-slate-500">{formatCollapsedNodePath(breadcrumbByNodeId.get(primaryNode.id) || "")}</div>
                              ) : null}
                              {primaryNode.nodeType.trim().toUpperCase() !== "ROOT" ? (
                                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{primaryNode.nodeType}</div>
                              ) : null}
                            </div>
                            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                          </button>
                        ) : (
                          <NodePermissionCard
                            node={primaryNode}
                            isDiffMode={isEditMode}
                            diffStatus={currentPrimaryDiffStatus}
                            badgeLabel="P1"
                            permissions={primaryPermissions}
                            previousPermissions={hasPrimaryChanged ? {} : previousPrimaryNode ? previousNodePermissions[previousPrimaryNode.id]?.primary ?? {} : {}}
                            permissionScopes={nodePermissionScopes[primaryNode.id]?.primary ?? {}}
                            previousPermissionScopes={
                              hasPrimaryChanged ? {} : previousPrimaryNode ? previousNodePermissionScopes[previousPrimaryNode.id]?.primary ?? {} : {}
                            }
                            branchMetaMap={branchMetaMap}
                            breadcrumbByNodeId={breadcrumbByNodeId}
                            emptyText="No primary access configured."
                            onClose={
                              isEditMode
                                ? () => onSetExpandedAccessNodeIds((current) => current.filter((id) => id !== primaryNode.id))
                                : undefined
                            }
                          />
                        )
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-400">
                          No primary access configured.
                        </div>
                      )}
                      {previousPrimaryReplacementNode ? (
                        <NodePermissionCard
                          node={previousPrimaryReplacementNode}
                          isDiffMode
                          diffStatus="removed"
                          badgeLabel="P1"
                          permissions={{}}
                          previousPermissions={previousNodePermissions[previousPrimaryReplacementNode.id]?.primary ?? {}}
                          permissionScopes={{}}
                          previousPermissionScopes={previousNodePermissionScopes[previousPrimaryReplacementNode.id]?.primary ?? {}}
                          branchMetaMap={branchMetaMap}
                          breadcrumbByNodeId={breadcrumbByNodeId}
                          emptyText="No primary access configured."
                        />
                      ) : null}
                    </div>
                  )}
                </div>

                {!isGlobalSignatory ? (
                  <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-8">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 break-words font-semibold text-slate-900">{reportingManagerName}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 break-all font-semibold text-slate-900">{reportingManagerEmail}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {!isGlobalSignatory ? (
                <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                </div>
                {secondaryReviewEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-400">
                    No secondary access assigned.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                    {secondaryReviewEntries.map((entry) =>
                      isEditMode && !effectiveExpandedAccessNodeIds.includes(entry.nodeId) ? (
                        <button
                          key={`${entry.nodeId}-collapsed-edit`}
                          type="button"
                          onClick={() => onSetExpandedAccessNodeIds((current) => (current.includes(entry.nodeId) ? current : [...current, entry.nodeId]))}
                          className={cn(
                            "flex h-auto self-start w-full items-center gap-2 rounded-md border border-l-[4px] px-2.5 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                            entry.diffStatus ? getNodeDiffTheme(entry.diffStatus).wrapper : "border-slate-200 bg-white",
                            entry.diffStatus === "removed" ? "border-l-rose-500 hover:border-rose-300 hover:bg-rose-50/70" : getNodeBorderLeftClass(entry.node, branchMetaMap),
                            entry.diffStatus === "added"
                              ? "hover:border-emerald-300 hover:bg-emerald-50/70"
                              : entry.diffStatus === "removed"
                                ? ""
                                : getNodeHoverClass(entry.node, branchMetaMap),
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                              entry.diffStatus === "removed" ? "border-rose-300 bg-rose-50 text-rose-700" : getNodeBadgeClass(entry.node, branchMetaMap),
                            )}
                          >
                            {secondaryBadgeByNodeId.get(entry.nodeId) ?? "S1"}
                          </div>
                          <div className="min-w-0">
                            <div className={cn("text-xs font-semibold", entry.diffStatus === "removed" ? "text-rose-700" : "text-slate-700")}>
                              {entry.node.name}
                            </div>
                            {entry.node.nodeType.trim().toUpperCase() !== "ROOT" && breadcrumbByNodeId.get(entry.node.id) ? (
                              <div className="break-words text-[10px] font-medium text-slate-500">{formatCollapsedNodePath(breadcrumbByNodeId.get(entry.node.id) || "")}</div>
                            ) : null}
                            {entry.node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{entry.node.nodeType}</div>
                            ) : null}
                          </div>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </button>
                      ) : (
                        <NodePermissionCard
                          key={entry.nodeId}
                          node={entry.node}
                          isDiffMode={isEditMode}
                          diffStatus={entry.diffStatus}
                          badgeLabel={secondaryBadgeByNodeId.get(entry.nodeId) ?? "S1"}
                          permissions={entry.diffStatus === "removed" ? {} : nodePermissions[entry.nodeId]?.secondary ?? {}}
                          previousPermissions={entry.ignorePreviousState ? {} : previousNodePermissions[entry.nodeId]?.secondary ?? {}}
                          permissionScopes={entry.diffStatus === "removed" ? {} : nodePermissionScopes[entry.nodeId]?.secondary ?? {}}
                          previousPermissionScopes={entry.ignorePreviousState ? {} : previousNodePermissionScopes[entry.nodeId]?.secondary ?? {}}
                          branchMetaMap={branchMetaMap}
                          breadcrumbByNodeId={breadcrumbByNodeId}
                          emptyText="No secondary access assigned."
                          onClose={
                            isEditMode
                              ? () => onSetExpandedAccessNodeIds((current) => current.filter((id) => id !== entry.nodeId))
                              : undefined
                          }
                        />
                      ),
                    )}
                  </div>
                )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <div
                  className={cn(
                    "grid items-stretch gap-2.5",
                    isGlobalSignatory ? "grid-cols-1 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]" : "grid-cols-1",
                  )}
                >
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                    <div className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-600">
                      Basic Details
                    </div>
                    <div className="space-y-2 text-sm">
                      <BasicDetailRow label="Name" value={basic.name} previousValue={isEditMode ? previousBasic?.name : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Email" value={basic.email} previousValue={isEditMode ? previousBasic?.email : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Phone" value={basic.phone} previousValue={isEditMode ? previousBasic?.phone : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Designation" value={basic.designation} previousValue={isEditMode ? previousBasic?.designation : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Employee ID" value={basic.employeeId || "-"} previousValue={isEditMode ? previousBasic?.employeeId : undefined} highlightAdded={isEditMode} />
                      <BasicDetailRow label="Workflow" value={selectedWorkflow || "-"} previousValue={isEditMode ? previousSelectedWorkflow : undefined} highlightAdded={isEditMode} />
                    </div>
                  </div>
                  {isGlobalSignatory ? (
                    <div className="flex h-full min-h-[220px] flex-col rounded-xl border border-emerald-200 bg-white p-3 shadow-sm ring-1 ring-emerald-100/70">
                      <div className="flex h-full flex-col rounded-2xl border border-emerald-200 bg-white p-4">
                        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200 bg-white/80 text-emerald-700">
                          <ShieldCheck className="h-9 w-9" />
                        </div>
                        <div className="mb-3 border-b border-emerald-200 pb-2 text-[12px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">
                          Global Access
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                          <div className="flex items-center gap-2 text-[14px]">
                            <span className="text-slate-500">Node Name</span>
                            <span className="text-slate-400">:</span>
                            <span className="font-extrabold text-slate-900">{globalNodeName}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[14px]">
                            <span className="text-slate-500">Access Category</span>
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                              All Child
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {!isGlobalSignatory ? (
                  <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-6">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 break-words font-semibold text-slate-900">{reportingManagerName}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 break-all font-semibold text-slate-900">{reportingManagerEmail}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!isGlobalSignatory ? (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-[12px] font-black uppercase tracking-widest text-blue-600">Primary Access</span>
                  </div>
                  {primaryNode ? (
                    <>
                      {collapsedFocusedNodeId === "primary" ? (
                        <NodePermissionCard
                          node={primaryNode}
                          isDiffMode={isEditMode}
                          diffStatus={currentPrimaryDiffStatus}
                          badgeLabel="P1"
                          permissions={primaryPermissions}
                          previousPermissions={hasPrimaryChanged ? {} : previousPrimaryNode ? previousNodePermissions[previousPrimaryNode.id]?.primary ?? {} : {}}
                          permissionScopes={nodePermissionScopes[primaryNode.id]?.primary ?? {}}
                          previousPermissionScopes={
                            hasPrimaryChanged ? {} : previousPrimaryNode ? previousNodePermissionScopes[previousPrimaryNode.id]?.primary ?? {} : {}
                          }
                          branchMetaMap={branchMetaMap}
                          breadcrumbByNodeId={breadcrumbByNodeId}
                          emptyText="No primary access configured."
                          onClose={() => setCollapsedFocusedNodeId(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCollapsedFocusedNodeId("primary");
                            onSetExpandedAccessNodeIds([primaryNode.id]);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md border border-l-[4px] px-2.5 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                            currentPrimaryDiffStatus ? "border-emerald-300 bg-white hover:border-emerald-300 hover:bg-emerald-50/70" : "border-slate-200 bg-white",
                            getNodeBorderLeftClass(primaryNode, branchMetaMap),
                            !currentPrimaryDiffStatus && getNodeHoverClass(primaryNode, branchMetaMap),
                          )}
                        >
                          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", getNodeBadgeClass(primaryNode, branchMetaMap))}>
                            P1
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-700">{primaryNode.name}</div>
                            {primaryNode.nodeType.trim().toUpperCase() !== "ROOT" && breadcrumbByNodeId.get(primaryNode.id) ? (
                              <div className="break-words text-[10px] font-medium text-slate-500">{formatCollapsedNodePath(breadcrumbByNodeId.get(primaryNode.id) || "")}</div>
                            ) : null}
                            {primaryNode.nodeType.trim().toUpperCase() !== "ROOT" ? (
                              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{primaryNode.nodeType}</div>
                            ) : null}
                          </div>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </button>
                      )}
                      {previousPrimaryReplacementNode ? (
                        <NodePermissionCard
                          node={previousPrimaryReplacementNode}
                          isDiffMode
                          diffStatus="removed"
                          badgeLabel="P1"
                          permissions={{}}
                          previousPermissions={previousNodePermissions[previousPrimaryReplacementNode.id]?.primary ?? {}}
                          permissionScopes={{}}
                          previousPermissionScopes={previousNodePermissionScopes[previousPrimaryReplacementNode.id]?.primary ?? {}}
                          branchMetaMap={branchMetaMap}
                          breadcrumbByNodeId={breadcrumbByNodeId}
                          emptyText="No primary access configured."
                        />
                      ) : null}
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">No primary access configured.</div>
                  )}
                </div>
                ) : null}
              </div>

              {!isGlobalSignatory ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                </div>
                {secondaryReviewEntries.length === 0 ? (
                  <div className="text-xs text-slate-500">No secondary access assigned.</div>
                ) : (
                  secondaryReviewEntries.map((entry) =>
                    (() => {
                      const diffTheme = getNodeDiffTheme(entry.diffStatus);

                      return collapsedFocusedNodeId === entry.nodeId ? (
                        <NodePermissionCard
                          key={`${entry.nodeId}-expanded`}
                          node={entry.node}
                          isDiffMode={isEditMode}
                          diffStatus={entry.diffStatus}
                          badgeLabel={secondaryBadgeByNodeId.get(entry.nodeId) ?? "S1"}
                          permissions={entry.diffStatus === "removed" ? {} : nodePermissions[entry.nodeId]?.secondary ?? {}}
                          previousPermissions={entry.ignorePreviousState ? {} : previousNodePermissions[entry.nodeId]?.secondary ?? {}}
                          permissionScopes={entry.diffStatus === "removed" ? {} : nodePermissionScopes[entry.nodeId]?.secondary ?? {}}
                          previousPermissionScopes={entry.ignorePreviousState ? {} : previousNodePermissionScopes[entry.nodeId]?.secondary ?? {}}
                          branchMetaMap={branchMetaMap}
                          breadcrumbByNodeId={breadcrumbByNodeId}
                          emptyText="No secondary access assigned."
                          onClose={() => setCollapsedFocusedNodeId(null)}
                        />
                      ) : (
                        <button
                          key={`${entry.nodeId}-collapsed`}
                          type="button"
                          onClick={() => {
                            setCollapsedFocusedNodeId(entry.nodeId);
                            onSetExpandedAccessNodeIds([entry.nodeId]);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md border border-l-[4px] px-2.5 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                            entry.diffStatus ? diffTheme.wrapper : "border-slate-200 bg-white",
                            entry.diffStatus === "removed" ? "border-l-rose-500 hover:border-rose-300 hover:bg-rose-50/70" : getNodeBorderLeftClass(entry.node, branchMetaMap),
                            entry.diffStatus === "added"
                              ? "hover:border-emerald-300 hover:bg-emerald-50/70"
                              : entry.diffStatus === "removed"
                                ? ""
                                : getNodeHoverClass(entry.node, branchMetaMap),
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                              entry.diffStatus === "removed" ? "border-rose-300 bg-rose-50 text-rose-700" : getNodeBadgeClass(entry.node, branchMetaMap),
                            )}
                          >
                            {secondaryBadgeByNodeId.get(entry.nodeId) ?? "S1"}
                          </div>
                          <div className="min-w-0">
                            <div className={cn("text-xs font-semibold", entry.diffStatus === "removed" ? "text-rose-700" : "text-slate-700")}>
                              {entry.node.name}
                            </div>
                            {entry.node.nodeType.trim().toUpperCase() !== "ROOT" && breadcrumbByNodeId.get(entry.node.id) ? (
                              <div className="break-words text-[10px] font-medium text-slate-500">{formatCollapsedNodePath(breadcrumbByNodeId.get(entry.node.id) || "")}</div>
                            ) : null}
                            {entry.node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{entry.node.nodeType}</div>
                            ) : null}
                          </div>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </button>
                      );
                    })()
                  )
                )}
              </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserOnboardingStepReviewSubmit;
