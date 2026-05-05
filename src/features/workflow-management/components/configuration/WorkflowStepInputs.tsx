import { Briefcase, Building2, Layers, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ModuleGroup } from "./types";

type WorkflowStepInputsProps = {
  wfName: string;
  wfAlias: string;
  wfModule: string;
  wfNode: string;
  moduleGroups: ModuleGroup[];
  departmentOptions: Array<{ value: string; label: string }>;
  showMetaErrors: boolean;
  onSetWfName: (value: string) => void;
  onSetWfAlias: (value: string) => void;
  onSetWfModule: (value: string) => void;
  onSetWfNode: (value: string) => void;
};

function InputField({
  label,
  value,
  placeholder,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 group">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.14em] group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110">{icon}</div>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
        />
      </div>
    </div>
  );
}

export default function WorkflowStepInputs({
  wfName,
  wfAlias,
  wfModule,
  wfNode,
  moduleGroups,
  departmentOptions,
  showMetaErrors,
  onSetWfName,
  onSetWfAlias,
  onSetWfModule,
  onSetWfNode,
}: WorkflowStepInputsProps) {
  const flatModuleOptions = moduleGroups.flatMap((group) => group.options);

  return (
    <div className="h-full overflow-auto p-6 custom-scrollbar">
      <div className="mx-auto w-full max-w-5xl p-2">
        <div className="mb-7">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Base Parameters</h2>
          <p className="mt-1 text-sm text-slate-500">Define your workflow metadata.</p>
        </div>

        <div className="grid grid-cols-1 gap-x-7 gap-y-6 md:grid-cols-2">
          <div>
            <InputField
              label="Workflow Name"
              value={wfName}
              placeholder="e.g. Standard PO Approval"
              icon={<Zap className="h-4 w-4 text-blue-500" />}
              onChange={onSetWfName}
            />
            {showMetaErrors && !wfName.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
          </div>

          <div>
            <InputField
              label="Process Alias"
              value={wfAlias}
              placeholder="e.g. PO_GLOBAL_V1"
              icon={<Layers className="h-4 w-4 text-purple-500" />}
              onChange={onSetWfAlias}
            />
            {showMetaErrors && !wfAlias.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
          </div>

          <div className="space-y-2 group">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.14em] group-focus-within:text-blue-600 transition-colors">
              Module
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110">
                <Briefcase className="h-4 w-4 text-indigo-500" />
              </div>
              <Select value={wfModule} onValueChange={onSetWfModule}>
                <SelectTrigger className="h-[50px] rounded-xl border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-50">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {flatModuleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showMetaErrors && !wfModule.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
          </div>

          <div className="space-y-2 group">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.14em] group-focus-within:text-blue-600 transition-colors">
              Department
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110">
                <Building2 className="h-4 w-4 text-emerald-500" />
              </div>
              <Select value={wfNode} onValueChange={onSetWfNode}>
                <SelectTrigger className="h-[50px] rounded-xl border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-50">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showMetaErrors && !wfNode.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
