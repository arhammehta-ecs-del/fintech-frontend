import { Briefcase, Building2, CheckCircle2, Layers, Settings2, Zap } from "lucide-react";
import { useMemo } from "react";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import type { WorkflowLevel } from "@/features/workflow-management/components/onboarding/types";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import {
  formatSnakeCaseLabel,
  getWorkflowPathPreview,
  isRootWorkflowNode,
} from "@/features/workflow-management/utils/workflowRecord.utils";
import { cn } from "@/lib/utils";

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
    return <span className="block break-words text-[16px] font-semibold leading-tight text-slate-900 md:text-[18px]">{next}</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1.5 text-[15px] font-semibold leading-tight md:text-[17px]">
      <span className="max-w-full break-words rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700 line-through">{prev}</span>
      <span className="text-slate-400">→</span>
      <span className="max-w-full break-words rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{next}</span>
    </div>
  );
};

const getWorkflowConditionCount = (levels: WorkflowLevel[]) =>
  levels.reduce((total, level) => {
    const approvalCount = level.approvals.filter((approval) => Boolean(approval.option?.trim())).length;
    if (approvalCount === 0) return total;
    return total + (level.type === "AND" ? approvalCount : 1);
  }, 0);

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
      <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-[10px] font-black uppercase text-rose-600 line-through">
        {prev || "-"}
      </span>
    );
  }

  if (isAdded) {
    return (
      <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-[10px] font-black uppercase text-emerald-700">
        {next || "-"}
      </span>
    );
  }

  if (prev && next && prev !== next) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black uppercase">
        <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prev}</span>
        <span className="text-slate-400">→</span>
        <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{next}</span>
      </span>
    );
  }

  return <span className="text-[10px] font-black uppercase text-slate-300">{next || prev || "-"}</span>;
};

export function SummaryPreview({ workflow }: { workflow: WorkflowRecord }) {
  const summaryLevels = toSummaryLevels(workflow.levels);
  const previousWorkflow = (workflow as WorkflowRecord & { previousWorkflow?: WorkflowRecord | null }).previousWorkflow ?? null;
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
      .reduce<Array<{ nodePath: string; nodeName: string; nodeType: string }>>((acc, current) => {
        if (acc.some((row) => row.nodePath === current.nodePath)) return acc;
        acc.push({
          nodePath: current.nodePath,
          nodeName: current.nodeName,
          nodeType: current.nodeType,
        });
        return acc;
      }, []);

    return deduped.sort((left, right) => {
      const depthDiff = getPathDepth(left.nodePath) - getPathDepth(right.nodePath);
      if (depthDiff !== 0) return depthDiff;
      return left.nodePath.localeCompare(right.nodePath);
    });
  }, [workflow.linkedOrgStructure, workflow.autoGenerated]);

  const topNodeName = workflow.orgStructure?.nodeName?.trim() || workflow.nodeName || "-";
  const topNodePath = workflow.orgStructure?.nodePath?.trim() || workflow.nodePath || "";
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
  const previousTopNodeName = previousWorkflow?.orgStructure?.nodeName?.trim() || previousWorkflow?.nodeName || "";
  const derivedCurrentAlias = buildWorkflowAliasFromLevels(summaryLevels);
  const derivedPreviousAlias = buildWorkflowAliasFromLevels(previousSummaryLevels);
  const displayPreviousAlias = previousWorkflowAlias || derivedPreviousAlias;
  const displayCurrentAlias = hasComparisonData
    ? (() => {
        const explicitCurrentAlias = workflow.alias?.trim() || "";
        if (explicitCurrentAlias && explicitCurrentAlias !== displayPreviousAlias) return explicitCurrentAlias;
        return derivedCurrentAlias || explicitCurrentAlias || "-";
      })()
    : workflow.alias?.trim() || derivedCurrentAlias || "-";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/30">
        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-5 md:divide-x md:divide-y-0">
          <div className="grid min-h-[112px] content-between gap-4 px-4 py-4">
            <div className="flex min-h-[32px] items-start gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              Workflow Name
            </div>
            {renderInlineDiff(workflow.name || "-", previousWorkflowName)}
          </div>
          <div className="grid min-h-[112px] content-between gap-4 px-4 py-4">
            <div className="flex min-h-[32px] items-start gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Layers className="h-3.5 w-3.5 text-purple-500" />
              Process Alias
            </div>
            {renderInlineDiff(displayCurrentAlias, displayPreviousAlias)}
          </div>
          <div className="grid min-h-[112px] content-between gap-4 px-4 py-4">
            <div className="flex min-h-[32px] items-start gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
              Module
            </div>
            {renderInlineDiff(moduleLabel || "-", previousModuleLabel)}
          </div>
          <div className="grid min-h-[112px] content-between gap-4 px-4 py-4">
            <div className="flex min-h-[32px] items-start gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Settings2 className="h-3.5 w-3.5 text-cyan-500" />
              Workflow Type
            </div>
            {renderInlineDiff(workflowTypeLabel || "-", previousWorkflowTypeLabel)}
          </div>
          <div className="grid min-h-[112px] content-between gap-4 px-4 py-4">
            <div className="flex min-h-[32px] items-start gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Building2 className="h-3.5 w-3.5 text-emerald-500" />
              Node Name
            </div>
            <div className="space-y-1 self-end">
              {renderInlineDiff(topNodeName, previousTopNodeName)}
              {topNodePath && !isRootWorkflowNode(topNodePath, workflow.orgStructure?.nodeType || workflow.nodeType) ? (
                <p className="truncate font-mono text-[10px] text-sky-700">{getWorkflowPathPreview(topNodePath, 3)}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Levels</h4>
        <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 pb-1">
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
                      ? "border-rose-300 border-l-rose-500 bg-rose-50/70 shadow-[0_8px_24px_rgba(244,63,94,0.10)]"
                      : isAdded
                        ? "border-emerald-300 border-l-emerald-500 bg-emerald-50 shadow-[0_10px_26px_rgba(16,185,129,0.18)] ring-1 ring-emerald-200/80"
                        : isChanged
                          ? "border-amber-300 border-l-amber-500 bg-amber-50/80 shadow-[0_8px_24px_rgba(245,158,11,0.12)]"
                          : "border-slate-100 border-l-slate-200 bg-white",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[10px] font-black",
                      isRemoved
                        ? "bg-rose-100 text-rose-700"
                        : isAdded
                          ? "bg-emerald-100 text-emerald-700"
                          : isChanged
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600",
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
                      const approvalChanged = Boolean(currentOption || previousOption) && currentOption !== previousOption;
                      const approvalAdded = Boolean(currentOption) && !previousOption;
                      const approvalRemoved = Boolean(previousOption) && !currentOption;
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
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Approver {approvalIdx + 1}</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {isRemoved || approvalRemoved ? (
                                <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">
                                  {previousLabel || nextLabel}
                                </span>
                              ) : approvalChanged ? (
                                <>
                                  {previousLabel ? (
                                    <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">
                                      {previousLabel}
                                    </span>
                                  ) : null}
                                  {previousLabel ? <span className="px-1 text-slate-400">→</span> : null}
                                  <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">
                                    {nextLabel}
                                  </span>
                                </>
                              ) : isAdded || approvalAdded ? (
                                <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">
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
                  ) : (
                    <span className="mr-2 h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {linkedOrgStructureNodes.length > 0 ? (
        <div className="mt-5">
          <h4 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
            Linked Org Structure ({linkedOrgStructureNodes.length})
          </h4>
          <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1 pb-1">
            {linkedOrgStructureNodes.map((entry, index) => {
              const formattedType = formatSnakeCaseLabel(entry.nodeType || "");
              const pathPreview = getWorkflowPathPreview(entry.nodePath, 3) || entry.nodePath;
              return (
                <div key={`${entry.nodePath}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {entry.nodeName}
                    {formattedType ? <span className="ml-1 text-slate-500">({formattedType})</span> : null}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-sky-700">{pathPreview}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
