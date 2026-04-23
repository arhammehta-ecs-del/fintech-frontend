import { Check, ChevronRight, X } from "lucide-react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { NEW_MEMBER_PERMISSION_STRUCTURE } from "@/features/user-management/constants";
import type {
  NewMemberOnboardingFormData,
  NewMemberPermissions,
  PermissionAction,
  PermissionBucket,
  PermissionCategory,
  ValidationErrors,
} from "@/features/user-management/types";
import { createInitialPermissions, getOrgNodeBadgeTheme, getOrgNodeTheme } from "@/features/user-management/utils";

type StepAccessRightsProps = {
  selectedNodes: OrgNode[];
  errors: ValidationErrors;
  expandedAccessNodeId: string | null;
  infoNodeId: string | null;
  nodePermissions: Record<string, NewMemberPermissions>;
  onSetExpandedAccessNodeId: (nodeId: string | null) => void;
  onSetInfoNodeId: (nodeId: string | null) => void;
  onTogglePermission: <C extends PermissionCategory>(
    nodeId: string,
    category: C,
    item: keyof NewMemberOnboardingFormData["permissions"][C],
    action: PermissionAction,
  ) => void;
};

function PermissionRow<C extends PermissionCategory>({
  category,
  itemKey,
  label,
  checked,
  onToggle,
}: {
  category: C;
  itemKey: keyof NewMemberOnboardingFormData["permissions"][C];
  label: string;
  checked: PermissionBucket;
  onToggle: (category: C, itemKey: keyof NewMemberOnboardingFormData["permissions"][C], action: PermissionAction) => void;
}) {
  return (
    <div className="grid grid-cols-4 items-center border-b border-slate-200/90 px-3 py-2.5 transition-colors">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {(["manager", "user", "viewer"] as PermissionAction[]).map((action) => (
        <div key={action} className="flex justify-center">
          <button
            type="button"
            aria-pressed={checked[action]}
            aria-label={`${label} ${action}`}
            onClick={() => onToggle(category, itemKey, action)}
            className={cn(
              "flex h-6.5 w-6.5 items-center justify-center rounded-sm border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(53,83,233)]/30",
              checked[action]
                ? "border-[rgb(53,83,233)] bg-[rgb(53,83,233)] text-white shadow-[0_6px_14px_rgba(53,83,233,0.28)]"
                : "border-slate-300 bg-white text-transparent hover:border-slate-400 hover:bg-slate-50",
            )}
          >
            <Check className={cn("h-3.5 w-3.5 transition-transform duration-150", checked[action] ? "scale-100" : "scale-0")} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function StepAccessRights({
  selectedNodes,
  errors,
  expandedAccessNodeId,
  infoNodeId,
  nodePermissions,
  onSetExpandedAccessNodeId,
  onSetInfoNodeId,
  onTogglePermission,
}: StepAccessRightsProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:space-y-5">
      {errors.accessRights ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errors.accessRights}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Selected Nodes</h3>
          </div>
        </div>

        {selectedNodes.length > 0 ? (
          <div className="space-y-3">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {selectedNodes.map((node, index) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSetExpandedAccessNodeId(node.id)}
                  onDoubleClick={() => onSetInfoNodeId(infoNodeId === node.id ? null : node.id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-all",
                    expandedAccessNodeId === node.id ? "border-slate-300 bg-slate-50/80" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
                  )}
                >
                  {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                    <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                  ) : null}
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                      {index === 0 ? (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
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
        <div className="space-y-4">
          {selectedNodes.map((node, index) => {
            const isExpanded = expandedAccessNodeId === node.id;
            const permissions = nodePermissions[node.id] ?? createInitialPermissions();

            return (
              <div key={node.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => onSetExpandedAccessNodeId(expandedAccessNodeId === node.id ? null : node.id)}
                  className="relative flex w-full items-center justify-between gap-4 overflow-hidden border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                    <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                  ) : null}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                    </div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isExpanded ? "rotate-90" : "")} />
                </button>
                {isExpanded ? (
                  <div className="space-y-4 p-4">
                    <div className="grid grid-cols-4 rounded-t-lg bg-[rgba(30,66,189,1)] px-4 py-2.5 text-[11px] font-semibold text-white">
                      <div>Department / Item</div>
                      <div className="text-center">Manager</div>
                      <div className="text-center">User</div>
                      <div className="text-center">Viewer</div>
                    </div>
                    {(Object.entries(NEW_MEMBER_PERMISSION_STRUCTURE) as Array<[PermissionCategory, (typeof NEW_MEMBER_PERMISSION_STRUCTURE)[PermissionCategory]]>).map(
                      ([categoryKey, section]) => (
                        <div key={`${node.id}-${categoryKey}`} className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                          <div className="border-b border-slate-300/60 bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-700">
                            {section.label}
                          </div>
                          {section.items.map((item) => (
                            <PermissionRow
                              key={item.key}
                              category={categoryKey}
                              itemKey={item.key as never}
                              label={item.label}
                              checked={permissions[categoryKey][item.key]}
                              onToggle={(category, itemKey, action) => onTogglePermission(node.id, category, itemKey, action)}
                            />
                          ))}
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          Select at least one node to configure access rights.
        </div>
      )}
    </div>
  );
}

export default StepAccessRights;
