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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";
import type { UserFilterDropdownOption, UserFilterNodeOption } from "@/services/user.service";

type FilterStatusValue = "Active" | "Pending" | "Inactive";
type FilterRoleValue = "Maker" | "Checker" | "User";
type NodeAccessValue = "Primary" | "Secondary";
type PendingActionValue = "Yes" | "No" | null;
type OnboardingDateRange = "7DAYS" | "15DAYS" | "1MONTH" | "1YEAR" | "CUSTOM" | null;
type StatusFilterModeValue = "initiate" | "modify";

type AppliedUserFiltersDraft = {
  designationFilters: string[];
  nodeNameFilters: string[];
  nodeTypeFilters: string[];
  accessCategoryFilters: string[];
  accessSubcategoryFilters: string[];
  reportingManagerFilters: string[];
  statusFilters: FilterStatusValue[];
  statusFilterMode: StatusFilterModeValue[];
  roleFilters: FilterRoleValue[];
  nodeAccessType: Record<string, NodeAccessValue[]>;
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

const FILTER_STATUS_OPTIONS: FilterStatusValue[] = ["Active", "Pending", "Inactive"];
const FILTER_ROLE_OPTIONS: FilterRoleValue[] = ["Maker", "Checker", "User"];
const DATE_RANGE_OPTIONS: Array<Exclude<OnboardingDateRange, "CUSTOM" | null>> = ["7DAYS", "1MONTH", "1YEAR"];

const STATUS_BADGE_CLASS: Record<MemberStatusTab, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  inactive: "bg-rose-100 text-rose-700",
};

const toggleFilterValue = (current: string[], value: string) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

const isDescendantNodePath = (parentPath: string, candidatePath: string) => {
  const parent = parentPath.trim();
  const candidate = candidatePath.trim();
  if (!parent || !candidate || parent === candidate) return false;
  return candidate.startsWith(`${parent}/`) || candidate.startsWith(`${parent}.`);
};

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
  statusFilterMode: StatusFilterModeValue[];
  roleFilters: FilterRoleValue[];
  nodeAccessType: Record<string, NodeAccessValue[]>;
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
  statusFilterMode: props.statusFilterMode,
  roleFilters: [...props.roleFilters],
  nodeAccessType: { ...props.nodeAccessType },
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
    draft.statusFilterMode.length +
    draft.roleFilters.length +
    Object.values(draft.nodeAccessType).reduce((count, types) => count + (types ? types.length : 0), 0) +
    (draft.pendingActionFilter ? 1 : 0) +
    (draft.onboardingDateRange ? 1 : 0) +
    (draft.onboardingDateFrom ? 1 : 0) +
    (draft.onboardingDateTo ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0;
  const categoryOptions = useMemo(
    () => accessCategories.filter((option) => option.trim().toLowerCase() !== "all"),
    [accessCategories],
  );
  const subCategoryOptions = useMemo(
    () =>
      draft.accessCategoryFilters.length === 0
        ? Object.values(accessSubcategories).flat()
        : draft.accessCategoryFilters.flatMap((category) => accessSubcategories[category] ?? []),
    [accessSubcategories, draft.accessCategoryFilters],
  );
  const filteredSubCategoryOptions = useMemo(
    () => subCategoryOptions.filter((option) => option.trim().toLowerCase() !== "all"),
    [subCategoryOptions],
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
      statusFilterMode: [],
      roleFilters: [],
      nodeAccessType: {},
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
              className="z-[110] w-[560px] overflow-visible rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_26px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
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
                    className="text-[12px] font-semibold text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      onClearAdvancedFilters();
                      setDraft(buildEmptyDraft());
                    }}
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
                      placeholder="Select designation"
                      options={roles.map((role) => role.value)}
                      itemCount={roles.length}
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
                        setDraft((current) => {
                          const isRemoving = current.nodeNameFilters.includes(value);
                          const nextFilters = isRemoving
                            ? current.nodeNameFilters.filter((item) => item !== value)
                            : [...current.nodeNameFilters, value];
                          
                          const nextAccess = { ...current.nodeAccessType };
                          if (isRemoving) {
                            delete nextAccess[value];
                          }

                          return {
                            ...current,
                            nodeNameFilters: nextFilters,
                            nodeAccessType: nextAccess,
                          };
                        })
                      }
                      onNodeAccessChange={(nodeName, accessType) =>
                        setDraft((current) => {
                          const currentTypes = current.nodeAccessType[nodeName] || [];
                          const nextTypes = currentTypes.includes(accessType)
                            ? currentTypes.filter((t) => t !== accessType)
                            : [...currentTypes, accessType];
                          return {
                            ...current,
                            nodeAccessType: {
                              ...current.nodeAccessType,
                              [nodeName]: nextTypes,
                            },
                          };
                        })
                      }
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
                      placeholder="Select node type"
                      options={nodeTypeOptions}
                      itemCount={nodeTypeOptions.length}
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
                      placeholder="Select reporting manager"
                      options={reportingManagerOptions}
                      itemCount={reportingManagerOptions.length}
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
                      placeholder="Select category"
                      options={categoryOptions}
                      itemCount={categoryOptions.length}
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
                      placeholder="Select subcategory"
                      options={filteredSubCategoryOptions}
                      itemCount={filteredSubCategoryOptions.length}
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
                      placeholder="Select status"
                      options={FILTER_STATUS_OPTIONS}
                      itemCount={FILTER_STATUS_OPTIONS.length}
                      disabledOptions={draft.statusFilterMode.includes("initiate") && !draft.statusFilterMode.includes("modify") ? ["Active", "Inactive"] : []}
                      selected={draft.statusFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          statusFilters: (toggleFilterValue(current.statusFilters, value as FilterStatusValue) as FilterStatusValue[]),
                        }))
                      }
                      onClear={() =>
                        setDraft((current) => ({
                          ...current,
                          statusFilters: [],
                        }))
                      }
                    />
                    <div className="space-y-2">
                      <FieldHeader title="Sub status" count={2} onClear={() => updateDraft("statusFilterMode", [])} canClear={draft.statusFilterMode.length > 0} />
                      <div className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-4">
                          {[
                            { id: "status-mode-initiate", value: "initiate", label: "New track" },
                            { id: "status-mode-modify", value: "modify", label: "In modification" },
                          ].map((option) => {
                            const isChecked = draft.statusFilterMode.includes(option.value as StatusFilterModeValue);
                            return (
                              <label key={option.id} htmlFor={option.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700 whitespace-nowrap">
                                <input
                                  id={option.id}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    setDraft((current) => ({
                                      ...current,
                                      statusFilterMode: isChecked
                                        ? current.statusFilterMode.filter((item) => item !== option.value)
                                        : [...current.statusFilterMode, option.value as StatusFilterModeValue],
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <SingleSelectDropdown
                      title="Has Pending Action"
                      placeholder="Select pending action"
                      options={["Yes", "No"]}
                      itemCount={2}
                      value={draft.pendingActionFilter}
                      onSelect={(value) => updateDraft("pendingActionFilter", value as PendingActionValue)}
                      onClear={() => clearDraftField("pendingActionFilter")}
                    />
                    <MultiSelectDropdown
                      title="Roles"
                      placeholder="Select role"
                      options={FILTER_ROLE_OPTIONS}
                      itemCount={FILTER_ROLE_OPTIONS.length}
                      selected={draft.roleFilters}
                      dropdownPosition="top"
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
                      itemCount={DATE_RANGE_OPTIONS.length + 1}
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

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
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
    statusFilterMode: [],
    roleFilters: [],
    nodeAccessType: {},
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

function FieldHeader({ title, count, onClear, canClear }: { title: string; count?: number; onClear: () => void; canClear: boolean }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
        {typeof count === "number" ? ` (${count})` : ""}
      </Label>
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
  itemCount,
  disabledOptions = [],
  selected,
  onToggle,
  onClear,
  counts,
  dropdownPosition = "bottom",
}: {
  title: string;
  placeholder: string;
  options: string[];
  itemCount?: number;
  disabledOptions?: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  counts?: Record<string, number>;
  dropdownPosition?: "top" | "bottom";
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
  const disabledOptionSet = useMemo(() => new Set(disabledOptions), [disabledOptions]);

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
      <FieldHeader title={title} count={itemCount ?? normalizedOptions.length} onClear={onClear} canClear={selected.length > 0} />
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
          className={cn(
            "absolute left-0 z-30 w-full min-w-[260px] rounded-lg border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]",
            dropdownPosition === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="mb-2 h-9" />
          <div className="max-h-[220px] space-y-1 overflow-auto">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option);
              const isDisabled = disabledOptionSet.has(option);
              return (
                <label
                  key={option}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50",
                    isSelected && "bg-blue-50 text-blue-800",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
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
  itemCount,
  value,
  onSelect,
  onClear,
}: {
  title: string;
  placeholder: string;
  options: string[];
  itemCount?: number;
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
      <FieldHeader title={title} count={itemCount ?? options.length} onClear={onClear} canClear={Boolean(value)} />
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
          <div className="max-h-[220px] overflow-auto">
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
        </div>
      ) : null}
    </div>
  );
}

function DateRangeDropdown({
  title,
  itemCount,
  range,
  fromDate,
  toDate,
  onRangeChange,
  onFromDateChange,
  onToDateChange,
  onClear,
}: {
  title: string;
  itemCount?: number;
  range: OnboardingDateRange;
  fromDate: string;
  toDate: string;
  onRangeChange: (value: OnboardingDateRange) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
}) {
  const todayIso = useMemo(() => {
    const today = new Date();
    const year = String(today.getFullYear());
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const normalizeDateInput = (value: string) => {
    if (!value) return "";
    return value > todayIso ? todayIso : value;
  };

  const handleFromDateChange = (value: string) => {
    const normalizedFrom = normalizeDateInput(value);
    onFromDateChange(normalizedFrom);
    if (toDate && normalizedFrom && normalizedFrom > toDate) {
      onToDateChange(normalizedFrom);
    }
  };

  const handleToDateChange = (value: string) => {
    const normalizedTo = normalizeDateInput(value);
    onToDateChange(normalizedTo);
    if (fromDate && normalizedTo && normalizedTo < fromDate) {
      onFromDateChange(normalizedTo);
    }
  };

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
            : "Select onboarding date";

  return (
    <div>
      <FieldHeader title={title} count={itemCount ?? DATE_RANGE_OPTIONS.length + 1} onClear={onClear} canClear={Boolean(range || fromDate || toDate)} />
      <Popover modal={false}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-10 w-full justify-between rounded-lg border-slate-200 px-3 text-left text-[12px]", (range || fromDate || toDate) && "border-blue-200 bg-blue-50/40 text-blue-800")}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-4 gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={range === option ? "default" : "outline"}
                size="sm"
                className="h-9 px-2 text-[12px]"
                onClick={() => {
                  onRangeChange(option);
                  onFromDateChange("");
                  onToDateChange("");
                }}
              >
                {option === "7DAYS" ? "7 Days" : option === "1MONTH" ? "1 Month" : "1 Year"}
              </Button>
            ))}
            <Button
              type="button"
              variant={range === "CUSTOM" ? "default" : "outline"}
              size="sm"
              className="h-9 px-2 text-[12px]"
              onClick={() => onRangeChange(range === "CUSTOM" ? null : "CUSTOM")}
            >
              Custom
            </Button>
          </div>
          {range === "CUSTOM" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">From</Label>
                <Input
                  type="date"
                  max={toDate || todayIso}
                  value={fromDate}
                  onChange={(event) => handleFromDateChange(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">To</Label>
                <Input
                  type="date"
                  min={fromDate || undefined}
                  max={todayIso}
                  value={toDate}
                  onChange={(event) => handleToDateChange(event.target.value)}
                  className="h-10"
                />
              </div>
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
  nodeAccessType: Record<string, NodeAccessValue[]>;
  onToggle: (value: string) => void;
  onNodeAccessChange: (nodeName: string, accessType: NodeAccessValue) => void;
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
      <FieldHeader title="Node Name" count={normalizedOptions.length} onClear={onClearSelection} canClear={selected.length > 0 || Object.values(nodeAccessType).some(types => types && types.length > 0)} />
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        className={cn("h-10 w-full justify-between rounded-lg border-slate-200 px-3 text-left text-[12px]", (selected.length > 0 || Object.values(nodeAccessType).some(types => types && types.length > 0)) && "border-blue-200 bg-blue-50/40 text-blue-800")}
      >
        <span className="truncate">
          {selected.length === 0
            ? "Select node name"
            : selected.length === 1
              ? `${selected[0]}${nodeAccessType[selected[0]]?.length ? ` (${nodeAccessType[selected[0]].join(", ")})` : ""}`
              : `${selected.length} selected`}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[380px] max-w-[min(92vw,380px)] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search node name" className="mb-3 h-9" />
          <div className="max-h-[220px] space-y-2 overflow-auto">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              const childValues = normalizedOptions
                .filter((candidate) => isDescendantNodePath(option.path, candidate.path))
                .map((candidate) => candidate.value);
              const selectableChildValues = childValues.filter((value) => !selected.includes(value));
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
                    <TooltipProvider delayDuration={0}>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  onNodeAccessChange(option.value, "Primary");
                                }
                              }}
                              className={cn(
                                "inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[11px] font-semibold transition",
                                !isSelected ? "opacity-50 cursor-not-allowed border-slate-200 bg-white text-slate-400" :
                                (nodeAccessType[option.value] || []).includes("Primary")
                                  ? "border-sky-300 bg-sky-100 text-sky-800 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-400 hover:border-sky-200 hover:text-sky-700",
                              )}
                              aria-label="Set primary node access"
                            >
                              P
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{isSelected ? "Primary node access" : "Select node first"}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  onNodeAccessChange(option.value, "Secondary");
                                }
                              }}
                              className={cn(
                                "inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[11px] font-semibold transition",
                                !isSelected ? "opacity-50 cursor-not-allowed border-slate-200 bg-white text-slate-400" :
                                (nodeAccessType[option.value] || []).includes("Secondary")
                                  ? "border-violet-300 bg-violet-100 text-violet-800 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-400 hover:border-violet-200 hover:text-violet-700",
                              )}
                              aria-label="Set secondary node access"
                            >
                              S
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{isSelected ? "Secondary node access" : "Select node first"}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>
                  {isSelected && childValues.length > 0 ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-100 bg-white/80 px-2.5 py-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Child Nodes ({childValues.length})
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-7 rounded-full border-blue-200 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50",
                          selectableChildValues.length === 0 && "opacity-70",
                        )}
                        onClick={() => onSelectAllChildren(childValues)}
                      >
                        Select all child
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
