import { useState, type MutableRefObject } from "react";
import { ChevronDown, ChevronRight, Expand, Minimize2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import type { NewMemberOnboardingFormData, NodePermissionBuckets, NewMemberPermissions } from "@/features/user-management/types";
import { getOrgNodeBadgeTheme, getOrgNodePermissionChipTheme, getOrgNodeTheme } from "@/features/user-management/utils";

const formatKey = (key: string) =>
  key
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

type StepReviewSubmitProps = {
  basic: NewMemberOnboardingFormData["basic"];
  selectedNodes: OrgNode[];
  primaryNodeId: string | null;
  nodePermissions: Record<string, NodePermissionBuckets>;
  expandedAccessNodeIds: string[];
  isReviewAccessExpanded: boolean;
  reviewAccessNodeRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSetExpandedAccessNodeIds: (ids: string[] | ((current: string[]) => string[])) => void;
  onSetIsReviewAccessExpanded: (value: boolean) => void;
};

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-b border-slate-200/60 pb-2 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value || <span className="italic text-slate-300">Not provided</span>}</span>
    </div>
  );
}

export function StepReviewSubmit({
  basic,
  selectedNodes,
  primaryNodeId,
  nodePermissions,
  expandedAccessNodeIds,
  isReviewAccessExpanded,
  reviewAccessNodeRefs,
  onSetExpandedAccessNodeIds,
  onSetIsReviewAccessExpanded,
}: StepReviewSubmitProps) {
  const [expandedSecondaryNodeIds, setExpandedSecondaryNodeIds] = useState<Record<string, boolean>>({});

  const toggleSecondary = (nodeId: string) => {
    setExpandedSecondaryNodeIds((current) => ({
      ...current,
      [nodeId]: !current[nodeId],
    }));
  };

  const getSelectedSections = (permissions: NewMemberPermissions) =>
    Object.entries(permissions)
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
      .filter(Boolean) as Array<{
      categoryKey: string;
      selectedItems: Array<{ itemKey: string; activeRights: string[] }>;
    }>;

  const renderPermissionRows = (
    node: OrgNode,
    sections: Array<{
      categoryKey: string;
      selectedItems: Array<{ itemKey: string; activeRights: string[] }>;
    }>,
    bucketPrefix: "primary" | "secondary",
  ) =>
    sections.map(({ categoryKey, selectedItems }) => (
      <div key={`${node.id}-${bucketPrefix}-${categoryKey}`} className="space-y-2.5">
        <div className="border-b border-slate-200 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
          {formatKey(categoryKey)}
        </div>
        {selectedItems.map(({ itemKey, activeRights }) => (
          <div key={`${bucketPrefix}-${itemKey}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-600">{formatKey(itemKey)}</span>
            <div className="flex flex-wrap justify-end gap-1">
              {activeRights.map((right) => (
                <span
                  key={`${bucketPrefix}-${right}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]",
                    getOrgNodePermissionChipTheme(node.nodeType),
                  )}
                >
                  {right.charAt(0).toUpperCase() + right.slice(1)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    ));

  return (
    <div className="flex h-full min-h-0 flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 text-[rgb(53,83,233)]">
        <ShieldCheck size={24} />
        <h3 className="text-lg font-bold">Review Final Access Policy</h3>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Basic Details</h4>
          <dl className="space-y-3">
            <SummaryItem label="Full Name" value={basic.name} />
            <SummaryItem label="Employee ID" value={basic.employeeId} />
            <SummaryItem label="Designation" value={basic.designation} />
            <SummaryItem label="Reporting to" value={basic.reportingManager} />
            <SummaryItem label="Email" value={basic.email} />
          </dl>
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Access Rights</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSetIsReviewAccessExpanded(!isReviewAccessExpanded)}
              className="h-8 w-8 rounded-md border border-slate-200 p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
              aria-label={isReviewAccessExpanded ? "Collapse access rights" : "Expand access rights"}
            >
              {isReviewAccessExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden",
              isReviewAccessExpanded ? "max-h-[26rem] space-y-4 overflow-y-auto snap-y snap-proximity [scrollbar-gutter:stable]" : "overflow-hidden",
            )}
          >
            {isReviewAccessExpanded ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Primary Access
                  </div>
                  {primaryNodeId ? (
                    (() => {
                      const primaryNode = selectedNodes.find((n) => n.id === primaryNodeId);
                      if (!primaryNode) return null;
                      const buckets = nodePermissions[primaryNodeId];
                      const sections = buckets ? getSelectedSections(buckets.primary) : [];
                      
                      return (
                        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          {primaryNode.nodeType.trim().toUpperCase() !== "ROOT" ? (
                            <span className={cn("absolute left-0 top-[10%] h-[80%] w-[4px] rounded-r-full", getOrgNodeTheme(primaryNode.nodeType).edge)} aria-hidden="true" />
                          ) : null}
                          <div className="mb-4 flex items-center gap-3">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", getOrgNodeBadgeTheme(primaryNode.nodeType))}>
                              {selectedNodes.findIndex((n) => n.id === primaryNodeId) + 1}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{primaryNode.name}</div>
                              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{primaryNode.nodeType}</div>
                            </div>
                          </div>
                          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3">
                            {sections.length > 0 ? (
                              renderPermissionRows(primaryNode, sections, "primary")
                            ) : (
                              <div className="text-sm text-slate-400">No primary access configured.</div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
                      No primary access configured.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Secondary Access
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const secondaryNodesWithRights = selectedNodes.filter(node => {
                        const buckets = nodePermissions[node.id];
                        return buckets && getSelectedSections(buckets.secondary).length > 0;
                      });

                      if (secondaryNodesWithRights.length === 0) {
                        return (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
                            No secondary access configured.
                          </div>
                        );
                      }

                      return secondaryNodesWithRights.map(node => {
                        const sections = getSelectedSections(nodePermissions[node.id].secondary);
                        return (
                          <div key={node.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                              <span className={cn("absolute left-0 top-[10%] h-[80%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                            ) : null}
                            <div className="mb-4 flex items-center gap-3">
                              <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", getOrgNodeBadgeTheme(node.nodeType))}>
                                {selectedNodes.findIndex((n) => n.id === node.id) + 1}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{node.name}</div>
                                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                              </div>
                            </div>
                            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3">
                              {renderPermissionRows(node, sections, "secondary")}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Primary Access</div>
                  {primaryNodeId && selectedNodes.find(n => n.id === primaryNodeId) ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSetExpandedAccessNodeIds((current) => current.includes(primaryNodeId) ? current : [...current, primaryNodeId]);
                        onSetIsReviewAccessExpanded(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      {(() => {
                         const n = selectedNodes.find(node => node.id === primaryNodeId)!;
                         const idx = selectedNodes.findIndex(node => node.id === primaryNodeId);
                         return (
                           <>
                            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", getOrgNodeBadgeTheme(n.nodeType))}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-700">{n.name}</div>
                              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{n.nodeType}</div>
                            </div>
                            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                           </>
                         )
                      })()}
                    </button>
                  ) : (
                    <div className="text-xs text-slate-500">No primary access configured.</div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Secondary Access</div>
                  {(() => {
                    const secondaryNodesWithRights = selectedNodes.filter(node => {
                      const buckets = nodePermissions[node.id];
                      return buckets && getSelectedSections(buckets.secondary).length > 0;
                    });
                    
                    if (secondaryNodesWithRights.length === 0) {
                      return <div className="text-xs text-slate-500">No secondary access configured.</div>;
                    }
                    
                    return secondaryNodesWithRights.map((node) => (
                      <button
                        key={`${node.id}-collapsed`}
                        type="button"
                        onClick={() => {
                          onSetExpandedAccessNodeIds((current) => current.includes(node.id) ? current : [...current, node.id]);
                          onSetIsReviewAccessExpanded(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", getOrgNodeBadgeTheme(node.nodeType))}>
                          {selectedNodes.findIndex(n => n.id === node.id) + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700">{node.name}</div>
                          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{node.nodeType}</div>
                        </div>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StepReviewSubmit;
