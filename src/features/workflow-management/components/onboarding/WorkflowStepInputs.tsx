import { Briefcase, Building2, Check, ChevronDown, Search, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ModuleGroup, WorkflowTypeScope } from "./types";
import { WORKFLOW_TYPE_SCOPE_OPTIONS } from "./workflowTypeScope.constants";
import { getWorkflowPathPreview } from "@/features/workflow-management/utils/workflowRecord.utils";
import { isRootWorkflowNode } from "@/features/workflow-management/utils/workflowRecord.utils";

type WorkflowStepInputsProps = {
  wfName: string;
  wfModule: string;
  wfNode: string;
  workflowType: WorkflowTypeScope | "";
  moduleGroups: ModuleGroup[];
  departmentOptions: Array<{ value: string; label: string }>;
  showMetaErrors: boolean;
  onSetWfName: (value: string) => void;
  onSetWfModule: (value: string) => void;
  onSetWfNode: (value: string) => void;
  onSetWorkflowType: (value: WorkflowTypeScope) => void;
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

function SearchableFieldDropdown({
  label,
  icon,
  placeholder,
  value,
  selectedLabel,
  options,
  onChange,
  keepOpenOnSelect = false,
  workflowType,
  workflowTypeOptions,
  onWorkflowTypeChange,
  showWorkflowTypeOptions = false,
}: {
  label: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
  selectedLabel: string;
  options: Array<{ value: string; label: string; pathLabel?: string; groupLabel?: string }>;
  onChange: (value: string) => void;
  keepOpenOnSelect?: boolean;
  workflowType?: WorkflowTypeScope | "";
  workflowTypeOptions?: Array<{ value: WorkflowTypeScope; label: string }>;
  onWorkflowTypeChange?: (value: WorkflowTypeScope) => void;
  showWorkflowTypeOptions?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const hasValue = Boolean(value.trim());

  const filteredOptions = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.pathLabel || ""} ${option.groupLabel || ""}`.toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [options, searchTerm]);

  return (
    <div className="space-y-2 group">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.14em] group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchTerm("");
            setIsSearchExpanded(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">{icon}</span>
            <button
              type="button"
              className="flex h-[50px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-left text-sm font-semibold text-slate-800 transition-all focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-50"
            >
              <span className="truncate">{hasValue ? selectedLabel : placeholder}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[320px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              onClick={() => {
                if (isSearchExpanded) setSearchTerm("");
                setIsSearchExpanded((current) => !current);
              }}
              aria-label={isSearchExpanded ? `Close ${label.toLowerCase()} search` : `Open ${label.toLowerCase()} search`}
            >
              {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-out",
              isSearchExpanded ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="relative px-1 pb-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-8 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300"
                autoFocus={isSearchExpanded}
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setSearchTerm("")}
                  aria-label={`Clear ${label.toLowerCase()} search`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto px-1 pb-1 pt-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="relative flex items-start rounded-md py-2.5 pl-8 pr-2"
                  onSelect={(event) => {
                    event.preventDefault();
                    onChange(option.value);
                    if (!keepOpenOnSelect) setOpen(false);
                  }}
                >
                  {value === option.value ? (
                    <Check className="absolute left-2 top-2.5 h-4 w-4 text-blue-600" />
                  ) : null}
                  <div className="min-w-0 w-full">
                    {option.groupLabel ? (
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{option.groupLabel}</p>
                    ) : null}
                    <p className="truncate pr-1 text-sm font-semibold text-slate-700">{option.label}</p>
                    {option.pathLabel ? (
                      <span className="mt-1 inline-flex w-full max-w-full rounded-md border border-sky-100 bg-sky-50/70 px-1.5 py-1 font-mono text-[10px] leading-[1.15] tracking-[0.02em] text-sky-700">
                        <span className="block max-w-full truncate">{option.pathLabel}</span>
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <p className="px-2 py-4 text-center text-[12px] text-slate-500">No options found</p>
            )}
          </div>

          {showWorkflowTypeOptions && workflowTypeOptions?.length ? (
            <div className="mt-2 border-t border-slate-200 px-1 pt-2">
              <p className="pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workflow Type</p>
              <div className="space-y-1.5">
                {workflowTypeOptions.map((option) => {
                  const isSelected = workflowType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onWorkflowTypeChange?.(option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm font-semibold transition",
                        isSelected
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-slate-400">+</span>
                        {option.label}
                      </span>
                      <span className={cn("h-5 w-5 rounded-full border-2", isSelected ? "border-blue-600" : "border-slate-300")}>
                        <span className={cn("m-[3px] block h-2.5 w-2.5 rounded-full", isSelected ? "bg-blue-600" : "bg-transparent")} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function WorkflowStepInputs({
  wfName,
  wfModule,
  wfNode,
  workflowType,
  moduleGroups,
  departmentOptions,
  showMetaErrors,
  onSetWfName,
  onSetWfModule,
  onSetWfNode,
  onSetWorkflowType,
}: WorkflowStepInputsProps) {
  const moduleGroupOrder = ["TRANSACTIONAL", "OPERATIONAL", "SYSTEM_ACCESS"];
  const orderedModuleGroups = [
    ...moduleGroups
      .filter((group) => moduleGroupOrder.includes(group.categoryKey))
      .sort((a, b) => moduleGroupOrder.indexOf(a.categoryKey) - moduleGroupOrder.indexOf(b.categoryKey)),
    ...moduleGroups.filter((group) => !moduleGroupOrder.includes(group.categoryKey)),
  ];
  const moduleOptions = orderedModuleGroups.flatMap((group) =>
    group.options.map((option) => ({
      value: option.value,
      label: option.label,
      groupLabel: group.categoryLabel,
    })),
  );
  const selectedModuleLabel =
    moduleOptions.find((option) => option.value === wfModule)?.label || "Select module";
  const shouldShowWorkflowTypeOptions = Boolean(wfModule.trim());
  const selectedNodeLabel =
    departmentOptions.find((option) => option.value === wfNode)?.label || "Select node name";
  const nodeOptions = departmentOptions.map((option) => ({
    value: option.value,
    label: option.label,
    pathLabel: isRootWorkflowNode(option.value) ? undefined : getWorkflowPathPreview(option.value, 3),
  }));

  useEffect(() => {
    if (!wfModule.trim() && moduleOptions.length === 1) {
      onSetWfModule(moduleOptions[0].value);
    }
  }, [wfModule, moduleOptions, onSetWfModule]);

  useEffect(() => {
    if (!wfNode.trim() && nodeOptions.length === 1) {
      onSetWfNode(nodeOptions[0].value);
    }
  }, [wfNode, nodeOptions, onSetWfNode]);

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

          <div className="relative">
            <SearchableFieldDropdown
              label="Module"
              icon={<Briefcase className="h-4 w-4 text-indigo-500" />}
              placeholder="Select module"
              value={wfModule}
              selectedLabel={selectedModuleLabel}
              options={moduleOptions}
              onChange={onSetWfModule}
              keepOpenOnSelect
              workflowType={workflowType}
              workflowTypeOptions={WORKFLOW_TYPE_SCOPE_OPTIONS}
              onWorkflowTypeChange={onSetWorkflowType}
              showWorkflowTypeOptions={shouldShowWorkflowTypeOptions}
            />
            {showMetaErrors && !wfModule.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
            {showMetaErrors && shouldShowWorkflowTypeOptions && !workflowType ? (
              <p className="mt-1 text-xs font-semibold text-red-500">Select workflow type</p>
            ) : null}
          </div>

          <div className="relative">
            <SearchableFieldDropdown
              label="Node Name"
              icon={<Building2 className="h-4 w-4 text-emerald-500" />}
              placeholder="Select node name"
              value={wfNode}
              selectedLabel={selectedNodeLabel}
              options={nodeOptions}
              onChange={onSetWfNode}
            />
            {showMetaErrors && !wfNode.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
