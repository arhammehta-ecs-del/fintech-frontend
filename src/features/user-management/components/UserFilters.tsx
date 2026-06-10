import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpDown, Check, ChevronDown, Filter, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";
import type { UserFilterDropdownOption, UserFilterNodeOption } from "@/services/user.service";

type FilterStatusValue = "Active" | "Pending" | "Inactive" | "Modification In Progress";
type FilterRoleValue = "Maker" | "Checker" | "User";
type NodeAccessValue = "Primary" | "Secondary" | null;
type PendingActionValue = "Yes" | "No" | null;
type OnboardingDateRange = "7DAYS" | "15DAYS" | "1MONTH" | "1YEAR" | "CUSTOM" | null;

type AppliedUserFiltersDraft = {
  designationFilters: string[];
  nodeNameFilters: string[];
  nodeTypeFilters: string[];
  accessCategoryFilters: string[];
  accessSubcategoryFilters: string[];
  reportingManagerFilters: string[];
  statusFilters: FilterStatusValue[];
  roleFilters: FilterRoleValue[];
  nodeAccessType: NodeAccessValue;
  pendingActionFilter: PendingActionValue;
  onboardingDateRange: OnboardingDateRange;
  onboardingDateFrom: string;
  onboardingDateTo: string;
};

const STATUS_TABS: Array<{ id: MemberStatusTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

const FILTER_STATUS_OPTIONS: FilterStatusValue[] = ["Active", "Pending", "Inactive", "Modification In Progress"];
const FILTER_ROLE_OPTIONS: FilterRoleValue[] = ["Maker", "Checker", "User"];
const DATE_RANGE_OPTIONS: Array<Exclude<OnboardingDateRange, "CUSTOM" | null>> = ["7DAYS", "1MONTH", "1YEAR"];

const STATUS_BADGE_CLASS: Record<MemberStatusTab, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  inactive: "bg-rose-100 text-rose-700",
};

const toggleFilterValue = (current: string[], value: string) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

type UserFiltersProps = {
  statusTab: MemberStatusTab;
  onStatusTabChange: (value: MemberStatusTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchSuggestions: string[];
  designationFilters: string[];
  nodeNameFilters: string[];
  nodeTypeFilters: string[];
  accessCategoryFilters: string[];
  accessSubcategoryFilters: string[];
  reportingManagerFilters: string[];
  statusFilters: FilterStatusValue[];
  roleFilters: FilterRoleValue[];
  nodeAccessType: NodeAccessValue;
  pendingActionFilter: PendingActionValue;
  onboardingDateRange: OnboardingDateRange;
  onboardingDateFrom: string;
  onboardingDateTo: string;
  onClearAdvancedFilters: () => void;
  onApplyAdvancedFilters: (filters: AppliedUserFiltersDraft) => void | Promise<void>;
  onOpenFilters: () => void | Promise<void>;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  hasNewUserEvent: boolean;
  suppressAutoEventTooltip?: boolean;
  onRefresh: () => void | Promise<void>;
  refreshInitializedAt?: number | null;
  roles: UserFilterDropdownOption[];
  accessCategories: string[];
  accessSubcategories: Record<string, string[]>;
  filterNodeOptions: UserFilterNodeOption[];
  nodeTypeOptions: string[];
  reportingManagerOptions: string[];
  statusCounts: Record<MemberStatusTab, number>;
  isFilterLoading: boolean;
};

const buildDraftFromProps = (props: UserFiltersProps): AppliedUserFiltersDraft => ({
  designationFilters: [...props.designationFilters],
  nodeNameFilters: [...props.nodeNameFilters],
  nodeTypeFilters: [...props.nodeTypeFilters],
  accessCategoryFilters: [...props.accessCategoryFilters],
  accessSubcategoryFilters: [...props.accessSubcategoryFilters],
  reportingManagerFilters: [...props.reportingManagerFilters],
  statusFilters: [...props.statusFilters],
  roleFilters: [...props.roleFilters],
  nodeAccessType: props.nodeAccessType,
  pendingActionFilter: props.pendingActionFilter,
  onboardingDateRange: props.onboardingDateRange,
  onboardingDateFrom: props.onboardingDateFrom,
  onboardingDateTo: props.onboardingDateTo,
});

export default function UserFilters(props: UserFiltersProps) {
  const {
    statusTab,
    onStatusTabChange,
    search,
    onSearchChange,
    searchSuggestions,
    onClearAdvancedFilters,
    onApplyAdvancedFilters,
    onOpenFilters,
    hasNewUserEvent,
    suppressAutoEventTooltip = false,
    onRefresh,
    refreshInitializedAt,
    sortOrder,
    onSortOrderChange,
    roles,
    accessCategories,
    accessSubcategories,
    filterNodeOptions,
    nodeTypeOptions,
    reportingManagerOptions,
    statusCounts,
    isFilterLoading,
  } = props;
  const visibleTabs = STATUS_TABS.filter((tab) => tab.id === "active" || statusCounts[tab.id] > 0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<AppliedUserFiltersDraft>(buildDraftFromProps(props));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRefreshTooltipOpen, setIsRefreshTooltipOpen] = useState(false);
  const { refreshLabel, markRefreshed } = useRefreshTimestamp({ initializedAt: refreshInitializedAt });

  const activeFilterCount =
    draft.designationFilters.length +
    draft.nodeNameFilters.length +
    draft.nodeTypeFilters.length +
    draft.accessCategoryFilters.length +
    draft.accessSubcategoryFilters.length +
    draft.reportingManagerFilters.length +
    draft.statusFilters.length +
    draft.roleFilters.length +
    (draft.nodeAccessType ? 1 : 0) +
    (draft.pendingActionFilter ? 1 : 0) +
    (draft.onboardingDateRange ? 1 : 0) +
    (draft.onboardingDateFrom ? 1 : 0) +
    (draft.onboardingDateTo ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0;
  const subCategoryOptions = useMemo(
    () =>
      draft.accessCategoryFilters.length === 0
        ? Object.values(accessSubcategories).flat()
        : draft.accessCategoryFilters.flatMap((category) => accessSubcategories[category] ?? []),
    [accessSubcategories, draft.accessCategoryFilters],
  );

  const updateDraft = <K extends keyof AppliedUserFiltersDraft>(key: K, value: AppliedUserFiltersDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const clearDraftField = (key: keyof AppliedUserFiltersDraft) => {
    const emptyValue: Partial<AppliedUserFiltersDraft> = {
      designationFilters: [],
      nodeNameFilters: [],
      nodeTypeFilters: [],
      accessCategoryFilters: [],
      accessSubcategoryFilters: [],
      reportingManagerFilters: [],
      statusFilters: [],
      roleFilters: [],
      nodeAccessType: null,
      pendingActionFilter: null,
      onboardingDateRange: null,
      onboardingDateFrom: "",
      onboardingDateTo: "",
    };
    updateDraft(key, emptyValue[key] as AppliedUserFiltersDraft[keyof AppliedUserFiltersDraft]);
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearchChange(search.trim());
            }}
            placeholder="Search by name, email, designation, or phone..."
            className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-9 text-[15px] shadow-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                setShowSuggestions(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {showSuggestions && searchSuggestions.length > 0 ? (
            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
              {searchSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    onSearchChange(suggestion);
                    setShowSuggestions(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                  statusTab === tab.id
                    ? "bg-[#3553e9] text-white shadow-[0_10px_24px_rgba(53,83,233,0.22)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    statusTab === tab.id ? "bg-white/18 text-white ring-1 ring-white/25" : STATUS_BADGE_CLASS[tab.id],
                  )}
                >
                  {statusCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          <Popover
            open={filtersOpen}
            onOpenChange={async (nextOpen) => {
              if (nextOpen) {
                setDraft(buildDraftFromProps(props));
                await onOpenFilters();
              }
              setFiltersOpen(nextOpen);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-12 rounded-xl border-slate-200 bg-white px-5 text-[15px] font-medium shadow-sm transition-all hover:border-slate-300",
                  hasAnyFilter && "border-primary/40 bg-primary/[0.04] text-primary",
                )}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {hasAnyFilter ? (
                  <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[560px] overflow-visible rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_26px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
            >
              <div className="border-b border-slate-200 bg-white px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold tracking-[0.01em] text-slate-900">Filter Members</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {isFilterLoading ? "Loading filter options..." : hasAnyFilter ? `${activeFilterCount} filters applied` : "No filters applied"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => setDraft(buildEmptyDraft())}
                  >
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="space-y-4 overflow-visible bg-white px-5 py-3.5">
                <FilterSection title="Identity">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MultiSelectDropdown
                      title="Designation"
                      placeholder="All designations"
                      options={roles.map((role) => role.value)}
                      counts={Object.fromEntries(roles.map((role) => [role.value, role.count ?? 0]))}
                      selected={draft.designationFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          designationFilters: toggleFilterValue(current.designationFilters, value),
                        }))
                      }
                      onClear={() => clearDraftField("designationFilters")}
                    />
                    <NodeNameDropdown
                      options={filterNodeOptions}
                      selected={draft.nodeNameFilters}
                      nodeAccessType={draft.nodeAccessType}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          nodeNameFilters: toggleFilterValue(current.nodeNameFilters, value),
                        }))
                      }
                      onNodeAccessChange={(value) => updateDraft("nodeAccessType", value)}
                      onSelectAllChildren={(values) =>
                        setDraft((current) => ({
                          ...current,
                          nodeNameFilters: Array.from(new Set([...current.nodeNameFilters, ...values])),
                        }))
                      }
                      onClearSelection={() => {
                        clearDraftField("nodeNameFilters");
                        clearDraftField("nodeAccessType");
                      }}
                    />
                    <MultiSelectDropdown
                      title="Node Type"
                      placeholder="All node types"
                      options={nodeTypeOptions}
                      selected={draft.nodeTypeFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          nodeTypeFilters: toggleFilterValue(current.nodeTypeFilters, value),
                        }))
                      }
                      onClear={() => clearDraftField("nodeTypeFilters")}
                    />
                    <MultiSelectDropdown
                      title="Reporting Manager"
                      placeholder="All reporting managers"
                      options={reportingManagerOptions}
                      selected={draft.reportingManagerFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          reportingManagerFilters: toggleFilterValue(current.reportingManagerFilters, value),
                        }))
                      }
                      onClear={() => clearDraftField("reportingManagerFilters")}
                    />
                    <MultiSelectDropdown
                      title="Category"
                      placeholder="All categories"
                      options={accessCategories}
                      selected={draft.accessCategoryFilters}
                      onToggle={(value) =>
                        setDraft((current) => {
                          const nextCategories = toggleFilterValue(current.accessCategoryFilters, value);
                          const allowedSubcategories = new Set(nextCategories.flatMap((category) => accessSubcategories[category] ?? []));
                          return {
                            ...current,
                            accessCategoryFilters: nextCategories,
                            accessSubcategoryFilters: current.accessSubcategoryFilters.filter(
                              (subCategory) => allowedSubcategories.size === 0 || allowedSubcategories.has(subCategory),
                            ),
                          };
                        })
                      }
                      onClear={() => {
                        clearDraftField("accessCategoryFilters");
                        clearDraftField("accessSubcategoryFilters");
                      }}
                    />
                    <MultiSelectDropdown
                      title="Subcategory"
                      placeholder="All subcategories"
                      options={subCategoryOptions}
                      selected={draft.accessSubcategoryFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          accessSubcategoryFilters: toggleFilterValue(current.accessSubcategoryFilters, value),
                        }))
                      }
                      onClear={() => clearDraftField("accessSubcategoryFilters")}
                    />
                  </div>
                </FilterSection>

                <FilterSection title="Activity">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MultiSelectDropdown
                      title="Status"
                      placeholder="All statuses"
                      options={FILTER_STATUS_OPTIONS}
                      selected={draft.statusFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          statusFilters: toggleFilterValue(current.statusFilters, value as FilterStatusValue) as FilterStatusValue[],
                        }))
                      }
                      onClear={() => clearDraftField("statusFilters")}
                    />
                    <SingleSelectDropdown
                      title="Has Pending Action"
                      placeholder="All"
                      options={["Yes", "No"]}
                      value={draft.pendingActionFilter}
                      onSelect={(value) => updateDraft("pendingActionFilter", value as PendingActionValue)}
                      onClear={() => clearDraftField("pendingActionFilter")}
                    />
                    <MultiSelectDropdown
                      title="Roles"
                      placeholder="All roles"
                      options={FILTER_ROLE_OPTIONS}
                      selected={draft.roleFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          roleFilters: toggleFilterValue(current.roleFilters, value as FilterRoleValue) as FilterRoleValue[],
                        }))
                      }
                      onClear={() => clearDraftField("roleFilters")}
                    />
                    <DateRangeDropdown
                      title="Onboarding Date"
                      range={draft.onboardingDateRange}
                      fromDate={draft.onboardingDateFrom}
                      toDate={draft.onboardingDateTo}
                      onRangeChange={(value) => updateDraft("onboardingDateRange", value)}
                      onFromDateChange={(value) => updateDraft("onboardingDateFrom", value)}
                      onToDateChange={(value) => updateDraft("onboardingDateTo", value)}
                      onClear={() => {
                        clearDraftField("onboardingDateRange");
                        clearDraftField("onboardingDateFrom");
                        clearDraftField("onboardingDateTo");
                      }}
                    />
                  </div>
                </FilterSection>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClearAdvancedFilters();
                    setDraft(buildEmptyDraft());
                  }}
                >
                  Reset Applied
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft(buildDraftFromProps(props));
                      setFiltersOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onApplyAdvancedFilters(draft);
                      setFiltersOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Sort members" className="h-12 w-12 rounded-xl border-slate-200 bg-white shadow-sm">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortOrderChange("asc")}>Name (A-Z)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortOrderChange("desc")}>Name (Z-A)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative flex h-12 w-12 items-center justify-center">
            <TooltipProvider delayDuration={120}>
              <Tooltip open={(!suppressAutoEventTooltip && hasNewUserEvent) || isRefreshTooltipOpen}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Refresh users"
                    onMouseEnter={() => setIsRefreshTooltipOpen(true)}
                    onMouseLeave={() => setIsRefreshTooltipOpen(false)}
                    onFocus={() => setIsRefreshTooltipOpen(true)}
                    onBlur={() => setIsRefreshTooltipOpen(false)}
                    onClick={async () => {
                      await onRefresh();
                      markRefreshed();
                    }}
                    className={cn(
                      "h-12 w-12 rounded-xl border-slate-200 bg-white shadow-sm",
                      hasNewUserEvent &&
                        "border-[#3553e9] bg-[#3553e9] text-white shadow-[0_10px_24px_rgba(53,83,233,0.22)] hover:bg-[#3553e9] hover:text-white",
                    )}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {hasNewUserEvent ? "New event occurred" : "Refresh users"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {refreshLabel ? (
              <p className="pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap text-right text-[11px] font-medium leading-none text-muted-foreground">
                {refreshLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildEmptyDraft(): AppliedUserFiltersDraft {
  return {
    designationFilters: [],
    nodeNameFilters: [],
    nodeTypeFilters: [],
    accessCategoryFilters: [],
    accessSubcategoryFilters: [],
    reportingManagerFilters: [],
    statusFilters: [],
    roleFilters: [],
    nodeAccessType: null,
    pendingActionFilter: null,
    onboardingDateRange: null,
    onboardingDateFrom: "",
    onboardingDateTo: "",
  };
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="border-b border-slate-100 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      </div>
      {children}
    </section>
  );
}

function FieldHeader({ title, onClear, canClear }: { title: string; onClear: () => void; canClear: boolean }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</Label>
      {canClear ? (
        <button type="button" onClick={onClear} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
          Clear
        </button>
      ) : null}
    </div>
  );
}

function MultiSelectDropdown({
  title,
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
  counts,
}: {
  title: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  counts?: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedOptions = useMemo(
    () =>
      options
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter(Boolean),
    [options],
  );
  const filteredOptions = normalizedOptions.filter((option) => option.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <FieldHeader title={title} onClear={onClear} canClear={selected.length > 0} />
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        className={cn("h-10 w-full justify-between rounded-lg border-slate-200 px-3 text-left text-[12px]", selected.length > 0 && "border-blue-200 bg-blue-50/40 text-blue-800")}
      >
        <span className="truncate">{selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-2 w-full min-w-[260px] rounded-lg border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
        >
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="mb-2 h-9" />
          <div className="max-h-64 space-y-1 overflow-auto">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <label
                  key={option}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                    isSelected && "bg-blue-50 text-blue-800",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(option)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span>{option}</span>
                  </span>
                  {counts && counts[option] ? <span className="text-[11px] text-slate-400">{counts[option]}</span> : null}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SingleSelectDropdown({
  title,
  placeholder,
  options,
  value,
  onSelect,
  onClear,
}: {
  title: string;
  placeholder: string;
  options: string[];
  value: string | null;
  onSelect: (value: string | null) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <FieldHeader title={title} onClear={onClear} canClear={Boolean(value)} />
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        className={cn("h-10 w-full justify-between rounded-lg border-slate-200 px-3 text-left text-[12px]", value && "border-blue-200 bg-blue-50/40 text-blue-800")}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSelect(value === option ? null : option);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                value === option && "bg-blue-50 text-blue-800",
              )}
            >
              <span>{option}</span>
              <span className={cn("inline-flex h-4 w-4 items-center justify-center", value === option ? "text-blue-700" : "text-transparent")}>
                <Check className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DateRangeDropdown({
  title,
  range,
  fromDate,
  toDate,
  onRangeChange,
  onFromDateChange,
  onToDateChange,
  onClear,
}: {
  title: string;
  range: OnboardingDateRange;
  fromDate: string;
  toDate: string;
  onRangeChange: (value: OnboardingDateRange) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
}) {
  const summary =
    range === "CUSTOM"
      ? fromDate || toDate
        ? `${fromDate || "Start"} to ${toDate || "End"}`
        : "Custom range"
      : range === "7DAYS"
        ? "7 Days"
        : range === "1MONTH"
          ? "1 Month"
          : range === "1YEAR"
            ? "1 Year"
            : "All dates";

  return (
    <div>
      <FieldHeader title={title} onClear={onClear} canClear={Boolean(range || fromDate || toDate)} />
      <Popover modal={false}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-10 w-full justify-between rounded-lg border-slate-200 px-3 text-left text-[12px]", (range || fromDate || toDate) && "border-blue-200 bg-blue-50/40 text-blue-800")}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={range === option ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  onRangeChange(option);
                  onFromDateChange("");
                  onToDateChange("");
                }}
              >
                {option === "7DAYS" ? "7 Days" : option === "1MONTH" ? "1 Month" : "1 Year"}
              </Button>
            ))}
            <Button type="button" variant={range === "CUSTOM" ? "default" : "outline"} size="sm" onClick={() => onRangeChange(range === "CUSTOM" ? null : "CUSTOM")}>
              Custom
            </Button>
          </div>
          {range === "CUSTOM" ? (
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Input type="date" value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} />
              <Input type="date" value={toDate} onChange={(event) => onToDateChange(event.target.value)} />
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NodeNameDropdown({
  options,
  selected,
  nodeAccessType,
  onToggle,
  onNodeAccessChange,
  onSelectAllChildren,
  onClearSelection,
}: {
  options: UserFilterNodeOption[];
  selected: string[];
  nodeAccessType: NodeAccessValue;
  onToggle: (value: string) => void;
  onNodeAccessChange: (value: NodeAccessValue) => void;
  onSelectAllChildren: (values: string[]) => void;
  onClearSelection: () => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedOptions = useMemo(
    () =>
      options.filter(
        (option): option is UserFilterNodeOption =>
          Boolean(option) &&
          typeof option.value === "string" &&
          typeof option.path === "string" &&
          option.value.trim().length > 0 &&
          option.path.trim().length > 0,
      ),
    [options],
  );
  const filteredOptions = normalizedOptions.filter((option) => option.value.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <FieldHeader title="Node Name" onClear={onClearSelection} canClear={selected.length > 0 || Boolean(nodeAccessType)} />
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        className={cn("h-10 w-full justify-between rounded-lg border-slate-200 px-3 text-left text-[12px]", (selected.length > 0 || nodeAccessType) && "border-blue-200 bg-blue-50/40 text-blue-800")}
      >
        <span className="truncate">{selected.length === 0 ? "All node names" : selected.length === 1 ? selected[0] : `${selected.length} selected`}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-[340px] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search node name" className="mb-3 h-9" />
          <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Access</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px]">P</span>
                  </TooltipTrigger>
                  <TooltipContent>Primary</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px]">S</span>
                  </TooltipTrigger>
                  <TooltipContent>Secondary</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <RadioGroup value={nodeAccessType ?? ""} onValueChange={(value) => onNodeAccessChange((value || null) as NodeAccessValue)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Primary" id="node-access-primary" />
                <Label htmlFor="node-access-primary">Primary</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Secondary" id="node-access-secondary" />
                <Label htmlFor="node-access-secondary">Secondary</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="max-h-64 space-y-2 overflow-auto">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              const childValues = normalizedOptions
                .filter((candidate) => candidate.path === option.path || candidate.path.startsWith(`${option.path}/`))
                .map((candidate) => candidate.value);
              return (
                <div key={`${option.path}-${option.value}`} className={cn("rounded-lg border p-2", isSelected ? "border-blue-200 bg-blue-50/40" : "border-slate-100")}>
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(option.value)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{option.value}</p>
                        <p className="text-[11px] text-slate-500">{option.path}</p>
                      </div>
                    </label>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onSelectAllChildren(childValues)}>
                      All child
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
