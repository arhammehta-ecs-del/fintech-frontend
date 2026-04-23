import type { MutableRefObject } from "react";
import { ChevronRight, Expand, Minimize2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { NEW_MEMBER_PERMISSION_STRUCTURE } from "@/features/user-management/constants";
import type { NewMemberOnboardingFormData, NewMemberPermissions, PermissionCategory } from "@/features/user-management/types";
import { getOrgNodeBadgeTheme, getOrgNodePermissionChipTheme, getOrgNodeTheme } from "@/features/user-management/utils";

type StepReviewSubmitProps = {
  basic: NewMemberOnboardingFormData["basic"];
  selectedNodes: OrgNode[];
  nodePermissions: Record<string, NewMemberPermissions>;
  expandedAccessNodeId: string | null;
  isReviewAccessExpanded: boolean;
  reviewAccessNodeRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSetExpandedAccessNodeId: (nodeId: string | null) => void;
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
  nodePermissions,
  expandedAccessNodeId,
  isReviewAccessExpanded,
  reviewAccessNodeRefs,
  onSetExpandedAccessNodeId,
  onSetIsReviewAccessExpanded,
}: StepReviewSubmitProps) {
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
              selectedNodes.map((node, index) => {
                const permissions = nodePermissions[node.id];
                if (!permissions) return null;

                const sections = (Object.entries(permissions) as Array<[PermissionCategory, NewMemberOnboardingFormData["permissions"][PermissionCategory]]>)
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
                  .filter(Boolean) as Array<{ categoryKey: PermissionCategory; selectedItems: Array<{ itemKey: string | number | symbol; activeRights: string[] }> }>;

                if (sections.length === 0) return null;

                return (
                  <div
                    key={node.id}
                    ref={(element) => {
                      reviewAccessNodeRefs.current[node.id] = element;
                    }}
                    className={cn(
                      "relative snap-start space-y-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4",
                      expandedAccessNodeId === node.id && "border-slate-200",
                    )}
                  >
                    {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                      <span
                        className={cn("absolute left-0 top-[10%] h-[80%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)}
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", getOrgNodeBadgeTheme(node.nodeType))}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{node.name}</div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {sections.map(({ categoryKey, selectedItems }) => (
                        <div key={`${node.id}-${categoryKey}`} className="space-y-2.5">
                          <div className="border-b border-slate-200 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            {NEW_MEMBER_PERMISSION_STRUCTURE[categoryKey].label}
                          </div>
                          {selectedItems.map(({ itemKey, activeRights }) => (
                            <div key={String(itemKey)} className="flex items-start justify-between gap-3 text-sm">
                              <span className="text-slate-600">
                                {String(itemKey)
                                  .replace(/([A-Z])/g, " $1")
                                  .trim()
                                  .replace(/^./, (char) => char.toUpperCase())}
                              </span>
                              <div className="flex flex-wrap justify-end gap-1">
                                {activeRights.map((right) => (
                                  <span
                                    key={right}
                                    className={cn(
                                      "rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]",
                                      getOrgNodePermissionChipTheme(node.nodeType),
                                    )}
                                  >
                                    {right}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selected Nodes</div>
                <div className="space-y-2">
                  {selectedNodes.length > 0 ? (
                    selectedNodes.map((node, index) => (
                      <button
                        key={`${node.id}-collapsed`}
                        type="button"
                        onClick={() => {
                          onSetExpandedAccessNodeId(node.id);
                          onSetIsReviewAccessExpanded(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", getOrgNodeBadgeTheme(node.nodeType))}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700">{node.name}</div>
                          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{node.nodeType}</div>
                        </div>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      No nodes selected.
                    </div>
                  )}
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
