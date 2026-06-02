import { Briefcase, Building2, CheckCircle2, Layers, Rocket, Settings2, UserCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import type { WorkflowLevel } from "./types";

type WorkflowStepSummaryProps = {
  wfName: string;
  wfAlias: string;
  moduleLabel: string;
  workflowType: string;
  nodeNameLabel: string;
  levels: WorkflowLevel[];
  visibleLevels: number;
  previous?: {
    wfName: string;
    wfAlias: string;
    moduleLabel: string;
    workflowType: string;
    nodeNameLabel: string;
    levels: WorkflowLevel[];
    visibleLevels: number;
  } | null;
};

function InlineDiff({ current, previous }: { current: string; previous?: string }) {
  const next = (current || "-").trim();
  const prev = (previous || "").trim();
  if (!prev || prev === next) return <span className="block break-words pl-5 text-xs font-bold text-slate-800">{next}</span>;
  return (
    <span className="flex flex-col items-start gap-1 pl-5 text-xs font-bold text-slate-800">
      <span className="break-words rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prev}</span>
      <span className="text-slate-400">→</span>
      <span className="break-words rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{next}</span>
    </span>
  );
}

function HorizontalInfo({
  label,
  value,
  previousValue,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  previousValue?: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <InlineDiff current={value} previous={previousValue} />
    </div>
  );
}

const approverLabel = (option: string) => APPROVAL_OPTIONS.find((entry) => entry.id === option)?.label || "Not Assigned";
const levelSignature = (level: WorkflowLevel) => `${level.type}:${level.approvals.map((approval) => approval.option || "").join("|")}`;

export default function WorkflowStepSummary({
  wfName,
  wfAlias,
  moduleLabel,
  workflowType,
  nodeNameLabel,
  levels,
  visibleLevels,
  previous = null,
}: WorkflowStepSummaryProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white p-6">
      <div className="mb-5 flex-none rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 divide-y divide-slate-200 md:grid-cols-5 md:gap-6 md:divide-y-0 md:divide-x">
          <HorizontalInfo label="Workflow Name" value={wfName} previousValue={previous?.wfName} icon={<Zap className="h-3 w-3.5 text-blue-500" />} />
          <HorizontalInfo label="Process Alias" value={wfAlias} previousValue={previous?.wfAlias} icon={<Layers className="h-3 w-3.5 text-purple-500" />} className="pt-3 md:pl-6 md:pt-0" />
          <HorizontalInfo label="Module" value={moduleLabel} previousValue={previous?.moduleLabel} icon={<Briefcase className="h-3 w-3.5 text-indigo-500" />} className="pt-3 md:pl-6 md:pt-0" />
          <HorizontalInfo label="Workflow Type" value={workflowType} previousValue={previous?.workflowType} icon={<Settings2 className="h-3 w-3.5 text-cyan-500" />} className="pt-3 md:pl-6 md:pt-0" />
          <HorizontalInfo label="Node Name" value={nodeNameLabel} previousValue={previous?.nodeNameLabel} icon={<Building2 className="h-3 w-3.5 text-emerald-500" />} className="pt-3 md:pl-6 md:pt-0" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h4 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Levels</h4>
        <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2 pb-4">
          {levels.slice(0, visibleLevels).map((level, idx) => {
            const previousLevel = previous?.levels?.[idx];
            const isNewLevel = !previousLevel;
            const hasLevelDiff = previousLevel ? levelSignature(previousLevel) !== levelSignature(level) : false;
            return (
              <div
                key={level.id}
                className={[
                  "flex min-h-[64px] items-center gap-4 rounded-xl border p-2.5 shadow-sm transition-all hover:border-blue-300",
                  isNewLevel
                    ? "border-emerald-200 bg-emerald-50/60"
                    : hasLevelDiff
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-slate-100 bg-white",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[10px] font-black",
                    isNewLevel
                      ? "bg-emerald-100 text-emerald-700"
                      : hasLevelDiff
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  L{level.id}
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-4">
                  {level.approvals.map((approval, approvalIdx) => {
                    const previousApproval = previousLevel?.approvals?.[approvalIdx];
                    const nextLabel = approverLabel(approval.option);
                    const previousOption = previousApproval?.option?.trim() || "";
                    const prevLabel = previousOption ? approverLabel(previousOption) : "";
                    const changed = Boolean(previousOption) && prevLabel !== nextLabel;
                    const addedApproval = !previousOption && Boolean(approval.option);
                    return (
                      <div key={`${level.id}-${approvalIdx}`} className="flex items-center gap-4">
                        {approvalIdx > 0 ? <span className="text-[10px] font-black uppercase text-slate-300">{level.type}</span> : null}
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Approver {approvalIdx + 1}</span>
                          <span className="text-xs font-semibold text-slate-800">
                            {changed ? (
                              <>
                                <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prevLabel}</span>
                                <span className="px-1 text-slate-400">→</span>
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
                    isNewLevel
                      ? "mr-2 h-4 w-4 text-emerald-500"
                      : hasLevelDiff
                        ? "mr-2 h-4 w-4 text-amber-500"
                        : "mr-2 h-4 w-4 text-emerald-500"
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      
    </div>
  );
}
