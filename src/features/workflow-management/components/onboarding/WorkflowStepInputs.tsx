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
import { formatSnakeCaseLabel, getWorkflowPathPreview, isRootWorkflowNode } from "@/features/workflow-management/utils/workflowRecord.utils";

type WorkflowStepInputsProps = {
  mode?: "create" | "edit";
  wfName: string;
  wfModule: string;
  wfNode: string;
  workflowType: WorkflowTypeScope | "";
  moduleGroups: ModuleGroup[];
  departmentOptions: Array<{ value: string; label: string; nodeType?: string; levelCount?: number }>;
  showMetaErrors: boolean;
  onSetWfName: (value: string) => void;
  onSetWfModule: (value: string) => void;
  onSetWfNode: (value: string) => void;
  onSetWorkflowType: (value: WorkflowTypeScope) => void;
};

const getNodeOptionLabel = (option: { label: string; nodeType?: string }) => {
  const nodeType = formatSnakeCaseLabel(option.nodeType || "").trim();
  return nodeType ? `${option.label} (${nodeType})` : option.label;
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
    <div className="group space-y-1">
      <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-primary">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">{icon}</div>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-md border border-slate-200 bg-white pl-11 pr-4 text-sm placeholder:text-slate-300 focus:border-primary focus:ring-0 focus-visible:outline-none"
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
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
  selectedLabel: ReactNode;
  options: Array<{ value: string; label: string; pathLabel?: string; groupLabel?: string; levelCount?: number }>;
  onChange: (value: string) => void;
  keepOpenOnSelect?: boolean;
  workflowType?: WorkflowTypeScope | "";
  workflowTypeOptions?: Array<{ value: WorkflowTypeScope; label: string }>;
  onWorkflowTypeChange?: (value: WorkflowTypeScope) => void;
  showWorkflowTypeOptions?: boolean;
  disabled?: boolean;
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
    <div className="group space-y-1">
      <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-primary">
        {label}
      </label>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          if (disabled) {
            setOpen(false);
            return;
          }
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchTerm("");
            setIsSearchExpanded(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">{icon}</span>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white pl-11 pr-4 text-left text-sm transition-all focus:border-primary focus:outline-none focus:ring-0",
                disabled && "cursor-not-allowed bg-slate-100 text-slate-500",
              )}
            >
              <div className="min-w-0 flex-1">{hasValue ? selectedLabel : <span className="truncate block">{placeholder}</span>}</div>
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
              filteredOptions.map((option, index) => {
                const showGroupHeader = option.groupLabel && (index === 0 || filteredOptions[index - 1].groupLabel !== option.groupLabel);
                const optionIndentLevel = Math.max(0, (option.levelCount ?? 1) - 1);
                
                return (
                  <div key={option.value}>
                    {showGroupHeader ? (
                      <div className="px-3 py-1.5 mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                        {option.groupLabel}
                      </div>
                    ) : null}
                    <DropdownMenuItem
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
                      <div className="min-w-0 w-full" style={{ paddingLeft: `${optionIndentLevel * 18}px` }}>
                        <p className="flex items-center gap-2 pr-1 text-sm font-semibold text-slate-700">
                          {typeof option.levelCount === "number" ? (
                            <span className="inline-flex shrink-0 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.12em] text-indigo-700">
                              L{option.levelCount}
                            </span>
                          ) : null}
                          <span className="truncate">{option.label}</span>
                        </p>
                        {option.pathLabel ? (
                          <span className="mt-1 block max-w-full truncate text-[11px] font-medium leading-4 tracking-normal text-slate-600 antialiased">
                            {option.pathLabel}
                          </span>
                        ) : null}
                      </div>
                    </DropdownMenuItem>
                    {value === option.value && showWorkflowTypeOptions && workflowTypeOptions?.length ? (
                      <div className="ml-8 mr-2 mb-2 mt-1 space-y-1.5 border-l-2 border-slate-100 pl-3">
                        {workflowTypeOptions.map((wtOption) => {
                          const isSelected = workflowType === wtOption.value;
                          return (
                            <button
                              key={wtOption.value}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onWorkflowTypeChange?.(wtOption.value);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-[11px] font-semibold transition",
                                isSelected
                                  ? "border-primary/40 bg-primary/5 text-primary"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span className={cn(isSelected ? "text-primary/70" : "text-slate-400")}>+</span>
                                {wtOption.label}
                              </span>
                              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]", isSelected ? "border-primary" : "border-slate-300")}>
                                {isSelected && <span className="block h-2 w-2 rounded-full bg-primary" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="px-2 py-4 text-center text-[12px] text-slate-500">No options found</p>
            )}
          </div>


        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function WorkflowStepInputs({
  mode = "create",
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
  const isEditMode = mode === "edit";
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
  const selectedNodeOption = departmentOptions.find((option) => option.value === wfNode);
  const selectedNodeLabel = selectedNodeOption ? (
    <span className="flex min-w-0 items-center gap-2">
      {typeof selectedNodeOption.levelCount === "number" ? (
        <span className="inline-flex shrink-0 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.12em] text-indigo-700">
          L{selectedNodeOption.levelCount}
        </span>
      ) : null}
      <span className="truncate">{getNodeOptionLabel(selectedNodeOption)}</span>
    </span>
  ) : "Select node name";
  const nodeOptions = departmentOptions.map((option) => ({
    value: option.value,
    label: getNodeOptionLabel(option),
    pathLabel: isRootWorkflowNode(option.value) ? undefined : getWorkflowPathPreview(option.value, 3),
    levelCount: option.levelCount,
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
    <div className="h-full overflow-auto p-6 md:p-8 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
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
              disabled={isEditMode}
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
              disabled={isEditMode}
            />
            {showMetaErrors && !wfNode.trim() ? <p className="mt-1 text-xs font-semibold text-red-500">Required</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}









