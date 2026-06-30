import { Briefcase, Building2, CheckCircle2, ChevronDown, Layers, Settings2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import type { WorkflowLevel } from "@/features/workflow-management/components/onboarding/types";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import {
  formatSnakeCaseLabel,
  getWorkflowNodeDisplayName,
  getWorkflowPathPreview,
  isRootWorkflowNode,
} from "@/features/workflow-management/utils/workflowRecord.utils";
import { splitNodePathSegments } from "@/lib/nodePath";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    return <span className="block break-words text-[14px] font-semibold leading-6 text-slate-800 md:text-[15px]">{next}</span>;
  }

  return (
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
      <span className="max-w-full break-words rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-[14px] font-medium leading-5 text-rose-700">{prev}</span>
      <span className="text-slate-400">-&gt;</span>
      <span className="max-w-full break-words rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[14px] font-semibold leading-5 text-emerald-800">{next}</span>
    </div>
  );
};

const renderAliasDiff = (currentValue: string, previousValue?: string) => {
  const next = (currentValue || "-").trim() || "-";
  const prevRaw = (previousValue || "").trim();
  const prev = prevRaw === "-" ? "" : prevRaw;

  if (!prev || prev === next) {
    return <span className="block break-words text-[14px] font-bold leading-6 text-violet-700 md:text-[15px]">{next}</span>;
  }

  return (
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
      <span className="max-w-full break-words rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-[14px] font-medium leading-5 text-rose-700">{prev}</span>
      <span className="text-slate-400">-&gt;</span>
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
  const segments = splitNodePathSegments(pathStr);
  return (
    <div className="mt-1.5 flex flex-wrap items-center">
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50 px-2.5 py-1 text-[11px] font-medium tracking-[0.04em] text-sky-700">
        {segments.map((segment, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span>{segment}</span>
            {i < segments.length - 1 && <span className="text-sky-300">&gt;</span>}
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
        <span className="text-slate-400">-&gt;</span>
        <span className="rounded border border-emerald-200 bg-emerald-50/60 px-1.5 py-0.5 text-emerald-700">{next}</span>
      </span>
    );
  }

  const label = next || prev || "-";
  const colorClass =
    label === "AND" ? "border-violet-200 bg-violet-100 text-violet-700 font-bold" :
      label === "OR" ? "border-violet-200 bg-violet-100 text-violet-700 font-bold" :
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
  const [levelsExpanded, setLevelsExpanded] = useState(!hasComparisonData);
  const [linkedOrgExpanded, setLinkedOrgExpanded] = useState(!hasComparisonData);
  const [collapsedLevels, setCollapsedLevels] = useState<Record<number, boolean>>({});
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


  const hasLevelChanges = useMemo(
    () =>
      hasComparisonData &&
      mergedLevels.some(({ current, previous }) => {
        if (current && !previous) return true;
        if (previous && !current) return true;
        return Boolean(current && previous && levelSignature(current) !== levelSignature(previous));
      }),
    [hasComparisonData, mergedLevels],
  );

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

  useEffect(() => {
    setLevelsExpanded(!hasComparisonData || hasLevelChanges);
  }, [hasComparisonData, hasLevelChanges, workflow.id]);

  useEffect(() => {
    setLinkedOrgExpanded(!hasComparisonData);
  }, [hasComparisonData, workflow.id]);

  return (
    <div className="px-2 pb-1 pt-0 md:px-4">
      <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/70">
          <div className="border-b border-slate-200/80 bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Workflow Overview</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
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

              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <div className="flex items-center justify-between pt-0.5 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    Process Alias
                  </div>
                  <span className="text-slate-400">:</span>
                </div>
                <div className="min-w-0">
                  {renderAliasDiff(displayCurrentAlias, displayPreviousAlias)}
                </div>
              </div>

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
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/70">
          <button
            type="button"
            onClick={() => setLevelsExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-4 text-left"
            aria-expanded={levelsExpanded}
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200/80">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-base font-bold tracking-tight text-slate-900">Levels</h4>

              </div>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", levelsExpanded && "rotate-180")} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{levelsExpanded ? "Collapse levels" : "Expand levels"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </button>
          {levelsExpanded ? (
            <div className="p-4 space-y-3 bg-slate-50/30">
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
                  const isCollapsed = collapsedLevels[id] ?? false;
                  const normalAccentColors = [
                    "border-l-indigo-300",
                    "border-l-sky-300",
                    "border-l-teal-300",
                    "border-l-blue-300",
                    "border-l-violet-300"
                  ];
                  const normalBadgeColors = [
                    "border-indigo-300 bg-indigo-100 text-indigo-700 font-bold",
                    "border-sky-300 bg-sky-100 text-sky-700 font-bold",
                    "border-teal-300 bg-teal-100 text-teal-700 font-bold",
                    "border-blue-300 bg-blue-100 text-blue-700 font-bold",
                    "border-violet-300 bg-violet-100 text-violet-700 font-bold"
                  ];
                  const levelAccentClass = isRemoved
                    ? "border-l-rose-500"
                    : isAdded
                      ? "border-l-emerald-500"
                      : isChanged
                        ? "border-l-amber-500"
                        : normalAccentColors[(id - 1) % normalAccentColors.length];

                  return (
                    <div
                      key={id}
                      className={cn(
                        "overflow-hidden rounded-xl border border-l-[6px] p-2.5 shadow-sm",
                        isRemoved
                          ? "border-rose-200 bg-rose-50/45"
                          : isAdded
                            ? "border-emerald-200 bg-emerald-50/45"
                            : isChanged
                              ? "border-amber-200 bg-amber-50/45"
                              : "border-slate-200 bg-white",
                        levelAccentClass,
                      )}
                    >
                      <div className="flex min-h-[52px] items-center gap-4 pl-2.5">
                        <div
                          className={cn(
                            "flex h-9 w-9 flex-none items-center justify-center rounded-lg border text-[10px] font-semibold",
                            isRemoved
                              ? "border-rose-200 bg-rose-100 text-rose-700"
                              : isAdded
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : isChanged
                                  ? "border-amber-200 bg-amber-100 text-amber-700"
                                  : normalBadgeColors[(id - 1) % normalBadgeColors.length],
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
                                        {previousLabel ? <span className="px-1 text-slate-400">-&gt;</span> : null}
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
                        <div className="ml-auto flex items-center gap-2">
                          {isRemoved ? (
                            <CheckCircle2 className="h-5 w-5 text-rose-600" />
                          ) : isAdded ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : isChanged ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-600" />
                          ) : null}

                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>

      {linkedOrgStructureNodes.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setLinkedOrgExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-5 py-4 text-left"
            aria-expanded={linkedOrgExpanded}
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200/80">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-base font-bold tracking-tight text-slate-900">
                  Linked Org Structure <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{linkedOrgStructureNodes.length}</span>
                </h4>
              </div>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", linkedOrgExpanded && "rotate-180")} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{linkedOrgExpanded ? "Collapse linked org structure" : "Expand linked org structure"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </button>
          {linkedOrgExpanded ? (
            <div className="max-h-[25.5rem] space-y-3 overflow-y-auto p-4 pr-3">
              {linkedOrgStructureNodes.map((entry, index) => {
                const formattedType = formatSnakeCaseLabel(entry.nodeType || "");
                const fullNodePath = entry.nodePath || getWorkflowPathPreview(entry.nodePath, 3);
                return (
                  <div key={`${entry.nodePath}-${index}`} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 shadow-sm">
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}




















