import { Briefcase, Building2, CheckCircle2, Layers, Settings2, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import { getWorkflowPathPreview, isRootWorkflowNode } from "@/features/workflow-management/utils/workflowRecord.utils";
import type { WorkflowLevel } from "./types";

type WorkflowStepSummaryProps = {
  wfName: string;
  wfAlias: string;
  moduleLabel: string;
  workflowType: string;
  nodeNameLabel: string;
  nodeLevelCount?: number;
  wfNode: string;
  levels: WorkflowLevel[];
  visibleLevels: number;
  previous?: {
    wfName: string;
    wfAlias: string;
    moduleLabel: string;
    workflowType: string;
    nodeNameLabel: string;
    nodeLevelCount?: number;
    wfNode: string;
    levels: WorkflowLevel[];
    visibleLevels: number;
  } | null;
};

const isStringValue = (value: ReactNode): value is string => typeof value === "string";

function InlineDiff({ current, previous }: { current: ReactNode; previous?: ReactNode }) {
  if (isStringValue(current) && (previous === undefined || isStringValue(previous))) {
    const next = (current || "-").trim() || "-";
    const prev = (previous || "").trim();

    if (!prev || prev === next) {
      return <span className="block break-words text-xs font-bold text-slate-800">{next}</span>;
    }

    return (
      <span className="flex flex-col items-start gap-1 text-xs font-bold text-slate-800">
        <span className="break-words rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prev}</span>
        <span className="text-slate-400">-&gt;</span>
        <span className="break-words rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{next}</span>
      </span>
    );
  }

  if (previous) {
    return (
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
        <div className="max-w-full rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-rose-700">
          {previous}
        </div>
        <span className="text-slate-400">-&gt;</span>
        <div className="max-w-full rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-emerald-800">
          {current}
        </div>
      </div>
    );
  }

  return <div className="min-w-0">{current}</div>;
}

function HorizontalInfo({
  label,
  value,
  previousValue,
  icon,
  className = "",
}: {
  label: string;
  value: ReactNode;
  previousValue?: ReactNode;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-[130px_1fr] items-start gap-3 ${className}`}>
      <div className="flex items-center justify-between pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <div className="flex items-center gap-2">
          {icon}
          {label}
        </div>
        <span className="text-slate-400">:</span>
      </div>
      <div className="min-w-0">
        <InlineDiff current={value} previous={previousValue} />
      </div>
    </div>
  );
}

const approverLabel = (option: string) => APPROVAL_OPTIONS.find((entry) => entry.id === option)?.label || "Not Assigned";
const levelSignature = (level: WorkflowLevel) => `${level.type}:${level.approvals.map((approval) => approval.option || "").join("|")}`;

const levelToneClasses = [
  "border-indigo-200 bg-indigo-50 text-indigo-700",
  "border-orange-200 bg-orange-50 text-orange-700",
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
];

const renderNodeValue = (nodeNameLabel: string, wfNode: string, nodeLevelCount?: number) => (
  <div className="flex flex-col gap-0.5">
    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      {typeof nodeLevelCount === "number" ? (
        <span className="inline-flex shrink-0 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.12em] text-indigo-700">
          L{nodeLevelCount}
        </span>
      ) : null}
      <span>{nodeNameLabel}</span>
    </span>
    {!isRootWorkflowNode(wfNode) ? (
      <span className="text-[10px] font-medium text-primary">
        {getWorkflowPathPreview(wfNode, 3)}
      </span>
    ) : null}
  </div>
);

export default function WorkflowStepSummary({
  wfName,
  wfAlias,
  moduleLabel,
  workflowType,
  nodeNameLabel,
  nodeLevelCount,
  wfNode,
  levels,
  visibleLevels,
  previous = null,
}: WorkflowStepSummaryProps) {
  const currentLevels = levels.slice(0, visibleLevels);
  const hasNodeDiff = Boolean(
    previous && (
      previous.nodeNameLabel !== nodeNameLabel ||
      previous.wfNode !== wfNode ||
      previous.nodeLevelCount !== nodeLevelCount
    ),
  );
  const previousLevels = previous?.levels?.slice(0, previous.visibleLevels) ?? [];
  const mergedLevels = Array.from(
    new Set([...currentLevels.map((level) => level.id), ...previousLevels.map((level) => level.id)]),
  )
    .sort((left, right) => left - right)
    .map((id) => ({
      id,
      current: currentLevels.find((level) => level.id === id) ?? null,
      previous: previousLevels.find((level) => level.id === id) ?? null,
    }));

  const normalAccentColors = [
    "border-l-indigo-500",
    "border-l-orange-500",
    "border-l-sky-500",
    "border-l-emerald-500",
    "border-l-fuchsia-500",
  ];

  return (
    <div className="mt-2 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="w-full">
        <div className="space-y-4 rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/70">
            <div className="border-b border-slate-200/80 bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Workflow Overview</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
                <HorizontalInfo label="Workflow Name" value={wfName} previousValue={previous?.wfName} icon={<Zap className="h-3.5 w-3.5 text-slate-400" />} />
                <HorizontalInfo label="Module" value={moduleLabel} previousValue={previous?.moduleLabel} icon={<Briefcase className="h-3.5 w-3.5 text-slate-400" />} />
                <HorizontalInfo label="Workflow Type" value={workflowType} previousValue={previous?.workflowType} icon={<Settings2 className="h-3.5 w-3.5 text-slate-400" />} />
                <HorizontalInfo
                  label="Node Name"
                  value={renderNodeValue(nodeNameLabel, wfNode, nodeLevelCount)}
                  previousValue={hasNodeDiff && previous ? renderNodeValue(previous.nodeNameLabel, previous.wfNode, previous.nodeLevelCount) : undefined}
                  icon={<Building2 className="h-3.5 w-3.5 text-slate-400" />}
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100/70">
            <div className="flex w-full items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200/80">
                  <Layers className="h-4 w-4" />
                </div>
                <h4 className="text-base font-bold tracking-tight text-slate-900">Levels</h4>
              </div>
            </div>
            <div className="space-y-3 bg-slate-50/30 p-4">
              {mergedLevels.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No level details available.</div>
              ) : (
                mergedLevels.map(({ id, current, previous: previousLevel }) => {
                  const level = current ?? previousLevel;
                  if (!level) return null;
                  const isNewLevel = Boolean(current && !previousLevel);
                  const isRemovedLevel = Boolean(previousLevel && !current);
                  const hasLevelDiff = Boolean(current && previousLevel && levelSignature(previousLevel) !== levelSignature(current));
                  const renderedApprovals = current?.approvals ?? previousLevel?.approvals ?? [];

                  const levelAccentClass = isRemovedLevel
                    ? "border-l-rose-500"
                    : isNewLevel
                      ? "border-l-emerald-500"
                      : hasLevelDiff
                        ? "border-l-amber-500"
                        : normalAccentColors[(id - 1) % normalAccentColors.length];

                  return (
                    <div
                      key={id}
                      className={[
                        "overflow-hidden rounded-xl border border-l-[6px] p-2.5 shadow-sm transition-all hover:shadow-md",
                        isRemovedLevel
                          ? "border-rose-200 bg-rose-50/45 opacity-75"
                          : isNewLevel
                            ? "border-emerald-200 bg-emerald-50/45"
                            : hasLevelDiff
                              ? "border-amber-200 bg-amber-50/45"
                              : "border-slate-200 bg-white",
                        levelAccentClass,
                      ].join(" ")}
                    >
                      <div className="flex min-h-[52px] items-center gap-4 pl-1 pr-2">
                        <div
                          className={[
                            "flex h-8 w-8 flex-none items-center justify-center rounded-lg border text-[10px] font-black",
                            isRemovedLevel
                              ? "border-rose-200 bg-rose-100 text-rose-700"
                              : isNewLevel
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : hasLevelDiff
                                  ? "border-amber-200 bg-amber-100 text-amber-700"
                                  : levelToneClasses[(id - 1) % levelToneClasses.length],
                          ].join(" ")}
                        >
                          L{id}
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-4">
                          {renderedApprovals.map((approval, approvalIdx) => {
                            const previousApproval = previousLevel?.approvals?.[approvalIdx];
                            const nextLabel = approverLabel(approval.option);
                            const previousOption = previousApproval?.option?.trim() || "";
                            const prevLabel = previousOption ? approverLabel(previousOption) : "";
                            const changed = Boolean(previousOption) && prevLabel !== nextLabel;
                            const addedApproval = !previousOption && Boolean(approval.option);
                            return (
                              <div key={`${id}-${approvalIdx}`} className="flex items-center gap-4">
                                {approvalIdx > 0 ? <span className="text-[10px] font-black uppercase text-slate-300">{level.type}</span> : null}
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Approver {approvalIdx + 1}</span>
                                  <span className="text-xs font-semibold text-slate-800">
                                    {isRemovedLevel ? (
                                      <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{nextLabel}</span>
                                    ) : changed ? (
                                      <>
                                        <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prevLabel}</span>
                                        <span className="px-1 text-slate-400">-&gt;</span>
                                        <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{nextLabel}</span>
                                      </>
                                    ) : addedApproval ? (
                                      <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{nextLabel}</span>
                                    ) : (
                                      nextLabel
                                    )}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <CheckCircle2
                          className={
                            isRemovedLevel
                              ? "mr-2 h-4 w-4 text-rose-500"
                              : isNewLevel
                                ? "mr-2 h-4 w-4 text-emerald-500"
                                : hasLevelDiff
                                  ? "mr-2 h-4 w-4 text-amber-500"
                                  : "mr-2 h-4 w-4 text-slate-300"
                          }
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



