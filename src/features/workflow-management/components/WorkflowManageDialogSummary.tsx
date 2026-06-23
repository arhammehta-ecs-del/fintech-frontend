import { Briefcase, Building2, CheckCircle2, Layers, Settings2, Zap } from "lucide-react";
import { useMemo } from "react";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import type { WorkflowLevel } from "@/features/workflow-management/components/onboarding/types";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import {
  formatSnakeCaseLabel,
  getWorkflowNodeDisplayName,
  getWorkflowPathPreview,
  isRootWorkflowNode,
} from "@/features/workflow-management/utils/workflowRecord.utils";
import { cn } from "@/lib/utils";

type SummaryPreviewWorkflow = WorkflowRecord & {
  previousWorkflow?: WorkflowRecord | null;
};

export const formatToIst = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
};

const fromApiApprover = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "REPORTING_MANAGER") return "reporting_manager";
  if (normalized === "NODE_APPROVER") return "node_approver";
  if (normalized === "HIERARCHY_APPROVER") return "hierarchy_approver";
  if (normalized === "NO_APPROVER") return "no_approver";
  return value.trim().toLowerCase();
};

const toSummaryLevels = (levels: unknown): WorkflowLevel[] => {
  if (Array.isArray(levels)) {
    return levels
      .map((entry, index) => {
        const levelRecord = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
        const approver1Raw = typeof levelRecord.approver1 === "string" ? levelRecord.approver1 : "";
        const approver2Raw = typeof levelRecord.approver2 === "string" ? levelRecord.approver2 : "";
        const typeRaw = typeof levelRecord.approverType === "string"
          ? levelRecord.approverType.toUpperCase()
          : typeof levelRecord.type === "string"
            ? levelRecord.type.toUpperCase()
            : "AND";
        const type: WorkflowLevel["type"] = typeRaw === "OR" ? "OR" : "AND";

        const approvals: WorkflowLevel["approvals"] = [{ option: fromApiApprover(approver1Raw) }];
        if (approver2Raw.trim()) approvals.push({ option: fromApiApprover(approver2Raw) });

        return {
          id: typeof levelRecord.level === "number" ? levelRecord.level : index + 1,
          type,
          approvals,
        };
      })
      .filter((level) => level.approvals.some((approval) => approval.option));
  }

  if (!levels || typeof levels !== "object") return [];

  const levelEntries = Object.entries(levels as Record<string, unknown>)
    .sort(([left], [right]) => Number(left.replace(/[^\d]/g, "")) - Number(right.replace(/[^\d]/g, "")));

  return levelEntries
    .map(([key, value], index) => {
      const levelRecord = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
      const approver1Raw = typeof levelRecord.approver1 === "string" ? levelRecord.approver1 : "";
      const approver2Raw = typeof levelRecord.approver2 === "string" ? levelRecord.approver2 : "";
      const typeRaw = typeof levelRecord.type === "string" ? levelRecord.type.toUpperCase() : "AND";
      const type: WorkflowLevel["type"] = typeRaw === "OR" ? "OR" : "AND";

      const approvals: WorkflowLevel["approvals"] = [{ option: fromApiApprover(approver1Raw) }];
      if (approver2Raw.trim()) approvals.push({ option: fromApiApprover(approver2Raw) });

      return {
        id: Number(key.replace(/[^\d]/g, "")) || index + 1,
        type,
        approvals,
      };
    })
    .filter((level) => level.approvals.some((approval) => approval.option));
};

const getPathDepth = (nodePath: string) => {
  return nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean).length;
};

const renderInlineDiff = (currentValue: string, previousValue?: string) => {
  const next = (currentValue || "-").trim() || "-";
  const prevRaw = (previousValue || "").trim();
  const prev = prevRaw === "-" ? "" : prevRaw;

  if (!prev || prev === next) {
    return <span className="block break-words text-[15px] font-semibold leading-6 text-slate-900 md:text-[17px]">{next}</span>;
  }

  return (
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
      <span className="max-w-full break-words rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-[14px] font-medium leading-5 text-rose-700">{prev}</span>
      <span className="text-slate-400">→</span>
      <span className="max-w-full break-words rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[14px] font-semibold leading-5 text-emerald-800">{next}</span>
    </div>
  );
};

const getWorkflowConditionCount = (levels: WorkflowLevel[]) =>
  levels.reduce((total, level) => {
    const approvalCount = level.approvals.filter((approval) => Boolean(approval.option?.trim())).length;
    if (approvalCount === 0) return total;
    return total + (level.type === "AND" ? approvalCount : 1);
  }, 0);

const renderOrgPathBadge = (pathStr: string) => {
  if (!pathStr) return null;
  const segments = pathStr.split('.').filter(Boolean);
  return (
    <div className="mt-1.5 flex flex-wrap items-center">
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50 px-2.5 py-1 text-[11px] font-medium tracking-[0.04em] text-sky-700">
        {segments.map((segment, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span>{segment}</span>
            {i < segments.length - 1 && <span className="text-sky-300">›</span>}
          </span>
        ))}
      </span>
    </div>
  );
};

const buildWorkflowAliasFromLevels = (levels: WorkflowLevel[]) => {
  if (levels.length === 0) return "";
  return `1M_${getWorkflowConditionCount(levels)}C_${levels.length}`;
};

const renderConnectorDiff = ({
  currentType,
  previousType,
  isAdded,
  isRemoved,
}: {
  currentType: string;
  previousType: string;
  isAdded: boolean;
  isRemoved: boolean;
}) => {
  const next = currentType.trim().toUpperCase();
  const prev = previousType.trim().toUpperCase();

  if (isRemoved) {
    return (
      <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
        {prev || "-"}
      </span>
    );
  }

  if (isAdded) {
    return (
      <span className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
        {next || "-"}
      </span>
    );
  }

  if (prev && next && prev !== next) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase">
        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">{prev}</span>
        <span className="text-slate-400">→</span>
        <span className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-emerald-700">{next}</span>
      </span>
    );
  }

  const label = next || prev || "-";
  const colorClass =
    label === "AND" ? "border-slate-300 bg-slate-100 text-slate-600" :
      label === "OR" ? "border-slate-300 bg-slate-100 text-slate-600" :
        "bg-slate-100 text-slate-500 border-slate-200";

  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]", colorClass)}>
      {label}
    </span>
  );
};

export function SummaryPreview({ workflow }: { workflow: SummaryPreviewWorkflow }) {
  const summaryLevels = toSummaryLevels(workflow.levels);
  const previousWorkflow = workflow.previousWorkflow ?? null;
  const hasComparisonData = Boolean(previousWorkflow);
  const previousSummaryLevels = useMemo(
    () => (previousWorkflow ? toSummaryLevels(previousWorkflow.levels) : []),
    [previousWorkflow],
  );
  const levelSignature = (level: WorkflowLevel) => `${level.type}:${level.approvals.map((entry) => entry.option || "").join("|")}`;
  const mergedLevels = useMemo(() => {
    const map = new Map<number, { current: WorkflowLevel | null; previous: WorkflowLevel | null }>();
    summaryLevels.forEach((level) => {
      map.set(level.id, { current: level, previous: map.get(level.id)?.previous ?? null });
    });
    previousSummaryLevels.forEach((level) => {
      map.set(level.id, { current: map.get(level.id)?.current ?? null, previous: level });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([id, pair]) => ({ id, ...pair }));
  }, [summaryLevels, previousSummaryLevels]);

  const linkedOrgStructureNodes = useMemo(() => {
    const linkedRows = Array.isArray(workflow.linkedOrgStructure) ? workflow.linkedOrgStructure : [];
    const fallbackRows = Array.isArray(workflow.autoGenerated) ? workflow.autoGenerated.map((entry) => entry?.orgStructure).filter(Boolean) : [];
    const rows = linkedRows.length > 0 ? linkedRows : fallbackRows;
    const deduped = rows
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.nodePath && entry?.nodeName))
      .reduce<Array<{ nodePath: string; nodeName: string; nodeType: string; levelCount?: number }>>((acc, current) => {
        if (acc.some((row) => row.nodePath === current.nodePath)) return acc;
        acc.push({
          nodePath: current.nodePath,
          nodeName: current.nodeName,
          nodeType: current.nodeType,
          levelCount: current.levelCount,
        });
        return acc;
      }, []);

    return deduped.sort((left, right) => {
      const depthDiff = getPathDepth(left.nodePath) - getPathDepth(right.nodePath);
      if (depthDiff !== 0) return depthDiff;
      return left.nodePath.localeCompare(right.nodePath);
    });
  }, [workflow.linkedOrgStructure, workflow.autoGenerated]);

  const topNodeName = getWorkflowNodeDisplayName({
    nodeName: workflow.orgStructure?.nodeName?.trim() || workflow.nodeName,
    nodePath: workflow.orgStructure?.nodePath?.trim() || workflow.nodePath,
    module: workflow.rawModule || workflow.module,
    subModule: workflow.subModule,
  });
  const topNodePath = workflow.orgStructure?.nodePath?.trim() || workflow.nodePath || "";
  const topNodeLevelCount = workflow.orgStructure?.levelCount ?? workflow.levelCount;
  const workflowTypeLabel = formatSnakeCaseLabel(workflow.workflowType || workflow.nodeType || "-");
  const moduleLabel = formatSnakeCaseLabel(workflow.subModule || workflow.module || "-");
  const previousWorkflowName = previousWorkflow?.name?.trim() || "";
  const previousWorkflowAlias = previousWorkflow?.alias?.trim() || "";
  const previousModuleLabel = previousWorkflow
    ? formatSnakeCaseLabel(previousWorkflow.subModule || previousWorkflow.module || "")
    : "";
  const previousWorkflowTypeLabel = previousWorkflow
    ? formatSnakeCaseLabel(previousWorkflow.workflowType || previousWorkflow.nodeType || "")
    : "";
  const previousTopNodeName = previousWorkflow
    ? getWorkflowNodeDisplayName({
        nodeName: previousWorkflow.orgStructure?.nodeName?.trim() || previousWorkflow.nodeName,
        nodePath: previousWorkflow.orgStructure?.nodePath?.trim() || previousWorkflow.nodePath,
        module: previousWorkflow.rawModule || previousWorkflow.module,
        subModule: previousWorkflow.subModule,
      })
    : "";
  const derivedCurrentAlias = buildWorkflowAliasFromLevels(summaryLevels);
  const derivedPreviousAlias = buildWorkflowAliasFromLevels(previousSummaryLevels);
  const explicitCurrentAlias = workflow.alias?.trim() || "";
  const displayPreviousAlias = previousWorkflowAlias || derivedPreviousAlias || "-";
  const displayCurrentAlias = explicitCurrentAlias || derivedCurrentAlias || "-";

  return (
    <div className="px-2 py-0 md:px-4">
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
          {/* Workflow Name */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <div className="flex items-center justify-between pt-0.5 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-slate-400" />
                Workflow Name
              </div>
              <span className="text-slate-400">:</span>
            </div>
            <div className="min-w-0">
              {renderInlineDiff(workflow.name || "-", previousWorkflowName)}
            </div>
          </div>

          {/* Process Alias */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <div className="flex items-center justify-between pt-0.5 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                Process Alias
              </div>
              <span className="text-slate-400">:</span>
            </div>
            <div className="min-w-0">
              {renderInlineDiff(displayCurrentAlias, displayPreviousAlias)}
            </div>
          </div>

          {/* Module */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <div className="flex items-center justify-between pt-0.5 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                Module
              </div>
              <span className="text-slate-400">:</span>
            </div>
            <div className="min-w-0">
              {renderInlineDiff(moduleLabel || "-", previousModuleLabel)}
            </div>
          </div>

          {/* Workflow Type */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <div className="flex items-center justify-between pt-0.5 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-slate-400" />
                Workflow Type
              </div>
              <span className="text-slate-400">:</span>
            </div>
            <div className="min-w-0">
              {renderInlineDiff(workflowTypeLabel || "-", previousWorkflowTypeLabel)}
            </div>
          </div>

          {/* Node Name (Takes full width in md) */}
          <div className="col-span-1 grid grid-cols-[140px_1fr] items-start gap-4 md:col-span-2 md:grid-cols-[140px_1fr]">
            <div className="flex items-center justify-between pt-0.5 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Node Name
              </div>
              <span className="text-slate-400">:</span>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {typeof topNodeLevelCount === "number" ? (
                  <span className="inline-flex shrink-0 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.12em] text-indigo-700">
                    L{topNodeLevelCount}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  {renderInlineDiff(topNodeName, previousTopNodeName)}
                </div>
              </div>
              {topNodePath && !isRootWorkflowNode(topNodePath, workflow.orgStructure?.nodeType || workflow.nodeType) ? (
                renderOrgPathBadge(getWorkflowPathPreview(topNodePath, 3))
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-4 px-1 text-sm font-bold tracking-tight text-slate-800">Levels</h4>
        <div className="space-y-2 pr-1 pb-1">
          {mergedLevels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No level details available.</div>
          ) : (
            mergedLevels.map(({ id, current, previous }) => {
              const level = current ?? previous;
              if (!level) return null;
              const isAdded = hasComparisonData && Boolean(current && !previous);
              const isRemoved = hasComparisonData && Boolean(previous && !current);
              const isChanged = hasComparisonData && Boolean(current && previous && levelSignature(current) !== levelSignature(previous));
              const currentApprovals = current?.approvals ?? [];
              const previousApprovals = previous?.approvals ?? [];
              const slotCount = Math.max(currentApprovals.length, previousApprovals.length);

              return (
                <div
                  key={id}
                  className={cn(
                    "flex min-h-[64px] items-center gap-4 rounded-xl border border-l-[4px] p-2.5 shadow-sm",
                    isRemoved
                      ? "border-rose-200 border-l-rose-400 bg-rose-50/45 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                      : isAdded
                        ? "border-emerald-200 border-l-emerald-400 bg-emerald-50/45 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                        : isChanged
                          ? "border-amber-200 border-l-amber-400 bg-amber-50/45 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                          : "border-slate-200 border-l-slate-300 bg-white",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 flex-none items-center justify-center rounded-lg border text-[10px] font-semibold",
                      isRemoved
                        ? "border-rose-200 bg-rose-100 text-rose-700"
                        : isAdded
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : isChanged
                            ? "border-amber-200 bg-amber-100 text-amber-700"
                            : "border-slate-200 bg-slate-100 text-slate-600",
                    )}
                  >
                    L{id}
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-4">
                    {Array.from({ length: slotCount }).map((_, approvalIdx) => {
                      const currentApproval = currentApprovals[approvalIdx];
                      const prevApproval = previousApprovals[approvalIdx];
                      const currentOption = currentApproval?.option?.trim() || "";
                      const previousOption = prevApproval?.option?.trim() || "";
                      const approvalChanged = hasComparisonData && Boolean(currentOption || previousOption) && currentOption !== previousOption;
                      const approvalAdded = hasComparisonData && Boolean(currentOption) && !previousOption;
                      const approvalRemoved = hasComparisonData && Boolean(previousOption) && !currentOption;
                      const nextLabel = currentOption
                        ? APPROVAL_OPTIONS.find((option) => option.id === currentOption)?.label || currentOption || "Not Assigned"
                        : "-";
                      const previousLabel = previousOption
                        ? APPROVAL_OPTIONS.find((option) => option.id === previousOption)?.label || previousOption || "Not Assigned"
                        : "";
                      const currentConnector = current?.type || "";
                      const previousConnector = previous?.type || "";
                      return (
                        <div key={`${level.id}-${approvalIdx}`} className="flex items-center gap-4">
                          {approvalIdx > 0 ? (
                            renderConnectorDiff({
                              currentType: currentConnector,
                              previousType: previousConnector,
                              isAdded: isAdded && !previous,
                              isRemoved: isRemoved && !current,
                            })
                          ) : null}
                          <div className="flex flex-col">
                            <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Approver {approvalIdx + 1}</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {isRemoved || approvalRemoved ? (
                                <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">
                                  {previousLabel || nextLabel}
                                </span>
                              ) : approvalChanged ? (
                                <>
                                  {previousLabel ? (
                                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">
                                      {previousLabel}
                                    </span>
                                  ) : null}
                                  {previousLabel ? <span className="px-1 text-slate-400">→</span> : null}
                                  <span className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-emerald-700">
                                    {nextLabel}
                                  </span>
                                </>
                              ) : isAdded || approvalAdded ? (
                                <span className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-emerald-700">
                                  {nextLabel}
                                </span>
                              ) : (
                                nextLabel
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isRemoved ? (
                    <CheckCircle2 className="mr-2 h-5 w-5 text-rose-600" />
                  ) : isAdded ? (
                    <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-600" />
                  ) : isChanged ? (
                    <CheckCircle2 className="mr-2 h-5 w-5 text-amber-600" />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {linkedOrgStructureNodes.length > 0 ? (
        <div className="mt-5">
          <h4 className="mb-4 px-1 text-sm font-bold tracking-tight text-slate-800">
            Linked Org Structure <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{linkedOrgStructureNodes.length}</span>
          </h4>
          <div className="space-y-2 pb-1">
            {linkedOrgStructureNodes.map((entry, index) => {
              const formattedType = formatSnakeCaseLabel(entry.nodeType || "");
              const fullNodePath = entry.nodePath || getWorkflowPathPreview(entry.nodePath, 3);
              return (
                <div key={`${entry.nodePath}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                  <p className="flex items-center gap-2 truncate text-[15px] font-semibold text-slate-900">
                    {typeof entry.levelCount === "number" ? (
                      <span className="inline-flex shrink-0 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.12em] text-indigo-700">
                        L{entry.levelCount}
                      </span>
                    ) : null}
                    <span className="truncate">{entry.nodeName}</span>
                    {formattedType ? <span className="ml-2 text-[13px] font-medium text-slate-500">({formattedType})</span> : null}
                  </p>
                  {renderOrgPathBadge(fullNodePath)}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
