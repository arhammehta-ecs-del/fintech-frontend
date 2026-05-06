import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { ChevronRight, Eye, Expand, Minimize2, Pencil, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { UserOnboardingFormData, NodePermissionBuckets, UserOnboardingPermissions } from "@/features/user-management/types";
import { getPermissionActionLabelFromText } from "@/features/user-management/roleLabels";
import { getNodeAccentBackground, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";

const formatKey = (key: string) =>
  key
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

type StepReviewSubmitProps = {
  orgStructure: OrgNode | null;
  basic: UserOnboardingFormData["basic"];
  selectedNodes: OrgNode[];
  primaryNodeId: string | null;
  nodePermissions: Record<string, NodePermissionBuckets>;
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
  selectedItems: Array<{ itemKey: string; activeRights: string[] }>;
};

const getOrderedPermissionLabels = (activeRights: string[]) => {
  const labels = new Set(activeRights.map((right) => getPermissionActionLabelFromText(right)));
  return ["Checker", "Maker", "Viewer"].filter((label) => labels.has(label));
};

const getSelectedSections = (permissions: UserOnboardingPermissions): SelectedPermissionSection[] => {
  const sections = Object.entries(permissions)
    .map(([categoryKey, items]) => {
      const selectedItems = Object.entries(items)
        .map(([itemKey, rights]) => ({
          itemKey,
          activeRights: Object.entries(rights as Record<string, boolean>)
            .filter(([, value]) => value)
            .map(([key]) => key),
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

const countSelectedRights = (permissions: UserOnboardingPermissions) =>
  Object.values(permissions).reduce(
    (categoryTotal, items) =>
      categoryTotal +
      Object.values(items).reduce(
        (itemTotal, rights) => itemTotal + Object.values(rights as Record<string, boolean>).filter(Boolean).length,
        0,
      ),
    0,
  );

function NodePermissionCard({
  node,
  badgeLabel,
  permissions,
  branchMetaMap,
  breadcrumbByNodeId,
  emptyText,
  onClose,
}: {
  node: OrgNode;
  badgeLabel: string;
  permissions: UserOnboardingPermissions;
  branchMetaMap: Map<string, BranchMeta>;
  breadcrumbByNodeId: Map<string, string>;
  emptyText: string;
  onClose?: () => void;
}) {
  const selectedSections = getSelectedSections(permissions);
  const parentSubtitle = breadcrumbByNodeId.get(node.id) || "";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-l-[4px] border-slate-200 bg-white p-3 shadow-sm",
        getNodeBorderLeftClass(node, branchMetaMap),
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
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold", getNodeBadgeClass(node, branchMetaMap))}>
          {badgeLabel}
        </div>
        <div>
          <div className="text-[18px] font-semibold leading-tight text-slate-800">{node.name}</div>
          {parentSubtitle ? <div className="text-[11px] font-medium text-slate-500">{parentSubtitle}</div> : null}
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{node.nodeType}</div>
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl bg-slate-50/30 p-3">
        {selectedSections.length === 0 ? (
          <div className="text-sm text-slate-400">{emptyText}</div>
        ) : (
          selectedSections.map((section) => (
            <div key={`${node.id}-${section.categoryKey}`} className="space-y-2">
              <div className="border-b border-slate-200 pb-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {formatKey(section.categoryKey)}
              </div>
              {section.selectedItems.map((item) => {
                const orderedLabels = getOrderedPermissionLabels(item.activeRights);
                return (
                  <div key={`${node.id}-${section.categoryKey}-${item.itemKey}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 text-sm leading-[1.35]">
                    <span className="min-w-0 truncate pt-0.5 pr-1 font-medium text-slate-600">{formatKey(item.itemKey)}</span>
                    <span className="flex max-w-[360px] flex-wrap justify-end gap-2">
                      {orderedLabels.map((label) => {
                        const theme = getPermissionBadgeTheme(label);
                        const BadgeIcon = theme.Icon;
                        return (
                          <span
                            key={`${node.id}-${section.categoryKey}-${item.itemKey}-${label}`}
                            className={cn("inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", theme.className)}
                          >
                            <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                            {label}
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

function BasicDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_10px_1fr] items-center gap-x-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <span className="font-semibold text-slate-900">{value || "-"}</span>
    </div>
  );
}

export function UserOnboardingStepReviewSubmit({
  orgStructure,
  basic,
  selectedNodes,
  primaryNodeId,
  nodePermissions,
  isReviewAccessExpanded,
  onSetExpandedAccessNodeIds,
  onSetIsReviewAccessExpanded,
}: StepReviewSubmitProps) {
  const reportingManagerName = basic.reportingManagerName || basic.reportingManager || "-";
  const reportingManagerEmail =
    basic.reportingManagerEmail ||
    (basic.reportingManager.includes("@") ? basic.reportingManager : "") ||
    "-";
  const branchMetaMap = buildBranchMetaMap(orgStructure);
  const breadcrumbByNodeId = useMemo(() => buildNodeBreadcrumbMap(orgStructure), [orgStructure]);
  const [collapsedFocusedNodeId, setCollapsedFocusedNodeId] = useState<"primary" | string | null>(null);
  const primaryNode = primaryNodeId ? selectedNodes.find((node) => node.id === primaryNodeId) ?? null : null;
  const primaryPermissions = primaryNode ? nodePermissions[primaryNode.id]?.primary ?? {} : {};
  const secondaryNodesWithRights = selectedNodes.filter((node) => {
    const buckets = nodePermissions[node.id];
    return buckets && getSelectedSections(buckets.secondary).length > 0;
  });
  const primaryRightsCount = countSelectedRights(primaryPermissions);
  const secondaryRightsCount = secondaryNodesWithRights.reduce(
    (total, node) => total + countSelectedRights(nodePermissions[node.id]?.secondary ?? {}),
    0,
  );
  const collapsedSelectableIds = useMemo(() => {
    const ids: Array<"primary" | string> = [];
    if (primaryNode) ids.push("primary");
    secondaryNodesWithRights.forEach((node) => ids.push(node.id));
    return ids;
  }, [primaryNode, secondaryNodesWithRights]);

  useEffect(() => {
    if (collapsedSelectableIds.length === 0 || (collapsedFocusedNodeId && !collapsedSelectableIds.includes(collapsedFocusedNodeId))) {
      setCollapsedFocusedNodeId(null);
    }
  }, [collapsedFocusedNodeId, collapsedSelectableIds]);

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
                      <BasicDetailRow label="Name" value={basic.name} />
                      <BasicDetailRow label="Email" value={basic.email} />
                      <BasicDetailRow label="Phone" value={basic.phone} />
                      <BasicDetailRow label="Designation" value={basic.designation} />
                      <BasicDetailRow label="Employee ID" value={basic.employeeId} />
                    </div>
                  </div>

                  <div className="flex h-full min-h-[220px] flex-col space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" />
                      <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#4F46E5]">Primary Access</span>
                    </div>
                    {primaryNode ? (
                      <NodePermissionCard
                        node={primaryNode}
                        badgeLabel="P1"
                        permissions={primaryPermissions}
                        branchMetaMap={branchMetaMap}
                        breadcrumbByNodeId={breadcrumbByNodeId}
                        emptyText="No primary access configured."
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-400">
                        No primary access configured.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-8 lg:whitespace-nowrap">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                      <span className="shrink-0 text-slate-400">:</span>
                      <span className="min-w-0 truncate font-semibold text-slate-900">{reportingManagerName}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                      <span className="shrink-0 text-slate-400">:</span>
                      <span className="min-w-0 truncate font-semibold text-slate-900">{reportingManagerEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                </div>
                {secondaryNodesWithRights.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-400">
                    No secondary access assigned.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {secondaryNodesWithRights.map((node) => (
                      <NodePermissionCard
                        key={node.id}
                        node={node}
                        badgeLabel={`S${selectedNodes.findIndex((n) => n.id === node.id) + 1}`}
                        permissions={nodePermissions[node.id].secondary}
                        branchMetaMap={branchMetaMap}
                        breadcrumbByNodeId={breadcrumbByNodeId}
                        emptyText="No secondary access assigned."
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                  <div className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-600">
                    Basic Details
                  </div>
                  <div className="space-y-2 text-sm">
                    <BasicDetailRow label="Name" value={basic.name} />
                    <BasicDetailRow label="Email" value={basic.email} />
                    <BasicDetailRow label="Phone" value={basic.phone} />
                    <BasicDetailRow label="Designation" value={basic.designation} />
                    <BasicDetailRow label="Employee ID" value={basic.employeeId} />
                  </div>
                </div>

                <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70">
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-6 lg:whitespace-nowrap">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                    <span className="shrink-0 text-slate-400">:</span>
                    <span className="min-w-0 truncate font-semibold text-slate-900">{reportingManagerName}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                    <span className="shrink-0 text-slate-400">:</span>
                    <span className="min-w-0 truncate font-semibold text-slate-900">{reportingManagerEmail}</span>
                  </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-[12px] font-black uppercase tracking-widest text-blue-600">Primary Access</span>
                  </div>
                  {primaryNode ? (
                    collapsedFocusedNodeId === "primary" ? (
                      <NodePermissionCard
                        node={primaryNode}
                        badgeLabel="P1"
                        permissions={primaryPermissions}
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
                          "flex w-full items-center gap-2 rounded-md border border-l-[4px] border-slate-200 bg-white px-2.5 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                          getNodeBorderLeftClass(primaryNode, branchMetaMap),
                          getNodeHoverClass(primaryNode, branchMetaMap),
                        )}
                      >
                        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", getNodeBadgeClass(primaryNode, branchMetaMap))}>
                          P1
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700">{primaryNode.name}</div>
                          {breadcrumbByNodeId.get(primaryNode.id) ? (
                            <div className="truncate text-[10px] font-medium text-slate-500">{breadcrumbByNodeId.get(primaryNode.id)}</div>
                          ) : null}
                          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{primaryNode.nodeType}</div>
                        </div>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </button>
                    )
                  ) : (
                    <div className="text-xs text-slate-500">No primary access configured.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                </div>
                {secondaryNodesWithRights.length === 0 ? (
                  <div className="text-xs text-slate-500">No secondary access assigned.</div>
                ) : (
                  secondaryNodesWithRights.map((node) =>
                    collapsedFocusedNodeId === node.id ? (
                      <NodePermissionCard
                        key={`${node.id}-expanded`}
                        node={node}
                        badgeLabel={`S${selectedNodes.findIndex((n) => n.id === node.id) + 1}`}
                        permissions={nodePermissions[node.id].secondary}
                        branchMetaMap={branchMetaMap}
                        breadcrumbByNodeId={breadcrumbByNodeId}
                        emptyText="No secondary access assigned."
                        onClose={() => setCollapsedFocusedNodeId(null)}
                      />
                    ) : (
                      <button
                        key={`${node.id}-collapsed`}
                        type="button"
                        onClick={() => {
                          setCollapsedFocusedNodeId(node.id);
                          onSetExpandedAccessNodeIds([node.id]);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border border-l-[4px] border-slate-200 bg-white px-2.5 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                          getNodeBorderLeftClass(node, branchMetaMap),
                          getNodeHoverClass(node, branchMetaMap),
                        )}
                      >
                        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", getNodeBadgeClass(node, branchMetaMap))}>
                          {`S${selectedNodes.findIndex((n) => n.id === node.id) + 1}`}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700">{node.name}</div>
                          {breadcrumbByNodeId.get(node.id) ? (
                            <div className="truncate text-[10px] font-medium text-slate-500">{breadcrumbByNodeId.get(node.id)}</div>
                          ) : null}
                          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{node.nodeType}</div>
                        </div>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </button>
                    ),
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserOnboardingStepReviewSubmit;
