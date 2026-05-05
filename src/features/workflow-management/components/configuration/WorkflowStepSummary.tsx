import { Briefcase, Building2, CheckCircle2, Layers, Rocket, Settings2, UserCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import type { WorkflowLevel } from "./types";

type WorkflowStepSummaryProps = {
  wfName: string;
  wfAlias: string;
  moduleLabel: string;
  departmentLabel: string;
  levels: WorkflowLevel[];
  visibleLevels: number;
};

function HorizontalInfo({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <span className="max-w-[160px] truncate pl-5 text-xs font-bold text-slate-800">{value || "-"}</span>
    </div>
  );
}

export default function WorkflowStepSummary({
  wfName,
  wfAlias,
  moduleLabel,
  departmentLabel,
  levels,
  visibleLevels,
}: WorkflowStepSummaryProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white p-6">
      <div className="mb-5 flex-none rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 divide-y divide-slate-200 md:grid-cols-4 md:gap-6 md:divide-y-0 md:divide-x">
          <HorizontalInfo label="Workflow Name" value={wfName} icon={<Zap className="h-3 w-3.5 text-blue-500" />} />
          <HorizontalInfo label="Process Alias" value={wfAlias} icon={<Layers className="h-3 w-3.5 text-purple-500" />} className="pt-3 md:pl-6 md:pt-0" />
          <HorizontalInfo label="Module" value={moduleLabel} icon={<Briefcase className="h-3 w-3.5 text-indigo-500" />} className="pt-3 md:pl-6 md:pt-0" />
          <HorizontalInfo label="Department" value={departmentLabel} icon={<Building2 className="h-3 w-3.5 text-emerald-500" />} className="pt-3 md:pl-6 md:pt-0" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h4 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Logic Chain</h4>
        <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2 pb-4">
          {levels.slice(0, visibleLevels).map((level) => (
            <div
              key={level.id}
              className="flex min-h-[64px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm transition-all hover:border-blue-300"
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">L{level.id}</div>
              <div className="flex flex-1 flex-wrap items-center gap-4">
                {level.approvals.map((approval, idx) => (
                  <div key={`${level.id}-${idx}`} className="flex items-center gap-4">
                    {idx > 0 ? <span className="text-[10px] font-black uppercase text-slate-300">{level.type}</span> : null}
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Approver {idx + 1}</span>
                      <span className="text-xs font-semibold text-slate-800">
                        {APPROVAL_OPTIONS.find((option) => option.id === approval.option)?.label || "Not Assigned"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <Settings2 className="h-3.5 w-3.5" />
        Ready to Publish
        <Rocket className="h-3.5 w-3.5 text-blue-600" />
        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
      </div>
    </div>
  );
}
