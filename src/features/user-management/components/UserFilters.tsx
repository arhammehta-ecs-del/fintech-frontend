import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpDown, ChevronDown, Filter, RefreshCw, Search, X } from "lucide-react";
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
import {
  SearchableMultiSelectMenu,
  SearchableSingleSelectMenu,
} from "@/components/filter-search-dropdown";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";
import type { UserFilterDropdownOption, UserFilterNodeOption, PermissionSummaryEntry } from "@/services/user.service";

type FilterStatusValue = "Active" | "Pending" | "Inactive";
type FilterRoleValue = "Maker" | "Checker" | "User";
type NodeAccessValue = "Primary" | "Secondary";
type PendingActionValue = "Yes" | "No" | null;
type OnboardingDateRange = "7DAYS" | "15DAYS" | "1MONTH" | "1YEAR" | "CUSTOM" | null;
type StatusFilterModeValue = "initiate" | "modify";

type AppliedUserFiltersDraft = {
  designationFilters: string[];
  nodeNameFilters: string[];
  nodeNameFilterPaths: string[];
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

const shouldShowStatusTab = (tab: MemberStatusTab, count: number) => tab === "active" || count > 0;

const FILTER_STATUS_OPTIONS: FilterStatusValue[] = ["Active", "Pending", "Inactive"];
const DEFAULT_FILTER_ROLE_OPTIONS: FilterRoleValue[] = ["Maker", "Checker", "User"];
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

const getNodeOptionCount = (option: UserFilterNodeOption) =>
  typeof option.count === "number"
    ? option.count
    : typeof option.permissionCount === "number"
      ? option.permissionCount
      : undefined;

const formatNodeOptionLevelLabel = (option: UserFilterNodeOption) => {
  if (typeof option.level === "number" && Number.isFinite(option.level)) {
    return `L${option.level}`;
  }

  const normalizedLevelCount = (option.levelCount || "").trim().toLowerCase();
  if (!normalizedLevelCount) return "";
  if (normalizedLevelCount === "root") return "L1";

  const matchedLevel = normalizedLevelCount.match(/^level(\d+)$/);
  if (!matchedLevel) return "";
  return `L${Number(matchedLevel[1]) + 1}`;
};

const formatNodeOptionLabel = (option: UserFilterNodeOption) => {
  const levelLabel = formatNodeOptionLevelLabel(option);
  const count = getNodeOptionCount(option);
  const baseLabel = levelLabel ? `${levelLabel} ${option.value}` : option.value;
  return typeof count === "number" ? `${baseLabel} (${count})` : baseLabel;
};

type UserFiltersProps = {
  statusTab: MemberStatusTab;
  onStatusTabChange: (value: MemberStatusTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchSuggestions: string[];
  designationFilters: string[];
  nodeNameFilters: string[];
  nodeNameFilterPaths: string[];
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
  designationOptions: UserFilterDropdownOption[];
  accessCategories: UserFilterDropdownOption[];
  accessSubcategories: Record<string, UserFilterDropdownOption[]>;
  filterNodeOptions: UserFilterNodeOption[];
  nodeTypeOptions: UserFilterDropdownOption[];
  reportingManagerOptions: UserFilterDropdownOption[];
  statusCounts: Record<MemberStatusTab, number>;
  userStatusSummary?: Record<string, number>;
  permissionSummary?: Record<string, PermissionSummaryEntry>;
  isFilterLoading: boolean;
};

const buildDraftFromProps = (props: UserFiltersProps): AppliedUserFiltersDraft => ({
  designationFilters: [...props.designationFilters],
  nodeNameFilters: [...props.nodeNameFilters],
  nodeNameFilterPaths: [...props.nodeNameFilterPaths],
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

const countActiveFilters = (filters: AppliedUserFiltersDraft) =>
  filters.designationFilters.length +
  filters.nodeNameFilters.length +
  filters.nodeTypeFilters.length +
  filters.accessCategoryFilters.length +
  filters.accessSubcategoryFilters.length +
  filters.reportingManagerFilters.length +
  filters.statusFilters.length +
  filters.statusFilterMode.length +
  filters.roleFilters.length +
  Object.values(filters.nodeAccessType).reduce((count, types) => count + (types ? types.length : 0), 0) +
  (filters.pendingActionFilter ? 1 : 0) +
  (filters.onboardingDateRange ? 1 : 0) +
  (filters.onboardingDateFrom ? 1 : 0) +
  (filters.onboardingDateTo ? 1 : 0);

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
    designationOptions,
    accessCategories,
    accessSubcategories,
    filterNodeOptions,
    nodeTypeOptions,
    reportingManagerOptions,
    statusCounts,
    userStatusSummary,
    permissionSummary,
    isFilterLoading,
  } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<AppliedUserFiltersDraft>(buildDraftFromProps(props));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRefreshTooltipOpen, setIsRefreshTooltipOpen] = useState(false);
  const { refreshLabel, markRefreshed } = useRefreshTimestamp({ initializedAt: refreshInitializedAt });
  const appliedFilters = useMemo(() => buildDraftFromProps(props), [props]);
  const appliedFilterCount = useMemo(() => countActiveFilters(appliedFilters), [appliedFilters]);

  const activeFilterCount = countActiveFilters(draft);
  const hasAnyFilter = appliedFilterCount > 0;
  const categoryOptions = useMemo(
    () => accessCategories.filter((option) => option.value.trim().toLowerCase() !== "all"),
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
    () => subCategoryOptions.filter((option) => option.value.trim().toLowerCase() !== "all"),
    [subCategoryOptions],
  );
  const categoryCounts = useMemo(
    () => Object.fromEntries(categoryOptions.map((option) => [option.value, option.count ?? 0])),
    [categoryOptions],
  );
  const subCategoryCounts = useMemo(
    () => Object.fromEntries(filteredSubCategoryOptions.map((option) => [option.value, option.count ?? 0])),
    [filteredSubCategoryOptions],
  );

  const updateDraft = <K extends keyof AppliedUserFiltersDraft>(key: K, value: AppliedUserFiltersDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const clearDraftField = (key: keyof AppliedUserFiltersDraft) => {
    const emptyValue: Partial<AppliedUserFiltersDraft> = {
      designationFilters: [],
      nodeNameFilters: [],
      nodeNameFilterPaths: [],
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
            {STATUS_TABS.filter((tab) => shouldShowStatusTab(tab.id, statusCounts[tab.id])).map((tab) => {
              const isDisabled = tab.id !== "active" && statusCounts[tab.id] === 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onStatusTabChange(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                    isDisabled
                      ? "cursor-not-allowed opacity-50 text-slate-400"
                      : statusTab === tab.id
                        ? "bg-[hsl(235,60%,50%)] text-white shadow-[0_10px_24px_rgba(30,35,80,0.22)]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      isDisabled
                        ? "bg-slate-100 text-slate-400"
                        : statusTab === tab.id ? "bg-white/18 text-white ring-1 ring-white/25" : STATUS_BADGE_CLASS[tab.id],
                    )}
                  >
                    {statusCounts[tab.id]}
                  </span>
                </button>
              );
            })}
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
                    {appliedFilterCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={10}
              className="z-[110] flex w-[min(560px,calc(100vw-2rem))] max-h-[min(var(--radix-popover-content-available-height),720px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_26px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
            >
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold tracking-[0.01em] text-slate-900">Filter Members</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {isFilterLoading ? "Loading filter options..." : activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No filters applied"}
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

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-5 py-2.5">
                <FilterSection title="Identity">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MultiSelectDropdown
                      title="Designation"
                      placeholder="Select designation"
                      options={designationOptions.map((designation) => designation.value)}
                      itemCount={designationOptions.length}
                      counts={Object.fromEntries(designationOptions.map((designation) => [designation.value, designation.count ?? 0]))}
                      selected={draft.designationFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          designationFilters: toggleFilterValue(current.designationFilters, value),
                        }))
                      }
                      onSelectAll={(values) => setDraft((current) => ({ ...current, designationFilters: values }))}
                      onClear={() => clearDraftField("designationFilters")}
                    />
                    <NodeNameDropdown
                      options={filterNodeOptions}
                      selected={draft.nodeNameFilters}
                      selectedPaths={draft.nodeNameFilterPaths}
                      nodeAccessType={draft.nodeAccessType}
                      onToggle={(option) =>
                        setDraft((current) => {
                          const isRemoving = current.nodeNameFilterPaths.includes(option.path);
                          const nextFilters = isRemoving
                            ? current.nodeNameFilters.filter((item, index) => current.nodeNameFilterPaths[index] !== option.path)
                            : [...current.nodeNameFilters, option.value];
                          const nextPaths = isRemoving
                            ? current.nodeNameFilterPaths.filter((path) => path !== option.path)
                            : [...current.nodeNameFilterPaths, option.path];
                          
                          const nextAccess = { ...current.nodeAccessType };
                          if (isRemoving) {
                            delete nextAccess[option.value];
                          }

                          return {
                            ...current,
                            nodeNameFilters: nextFilters,
                            nodeNameFilterPaths: nextPaths,
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
                      onSelectAllChildren={(items) =>
                        setDraft((current) => ({
                          ...current,
                          nodeNameFilters: [...current.nodeNameFilters, ...items.map((item) => item.value)],
                          nodeNameFilterPaths: Array.from(new Set([...current.nodeNameFilterPaths, ...items.map((item) => item.path)])),
                        }))
                      }
                      onClearSelection={() => {
                        clearDraftField("nodeNameFilters");
                        clearDraftField("nodeNameFilterPaths");
                        clearDraftField("nodeAccessType");
                      }}
                    />
                    <MultiSelectDropdown
                      title="Node Type"
                      placeholder="Select node type"
                      options={nodeTypeOptions.map((n) => n.value)}
                      itemCount={nodeTypeOptions.length}
                      counts={Object.fromEntries(nodeTypeOptions.map((n) => [n.value, n.count ?? 0]))}
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
                      options={reportingManagerOptions.map((option) => option.value)}
                      itemCount={reportingManagerOptions.length}
                      counts={Object.fromEntries(reportingManagerOptions.map((option) => [option.value, option.count ?? 0]))}
                      selected={draft.reportingManagerFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          reportingManagerFilters: toggleFilterValue(current.reportingManagerFilters, value),
                        }))
                      }
                      onSelectAll={(values) => setDraft((current) => ({ ...current, reportingManagerFilters: values }))}
                      onClear={() => clearDraftField("reportingManagerFilters")}
                    />
                    <MultiSelectDropdown
                      title="Category"
                      placeholder="Select category"
                      options={categoryOptions.map((option) => option.value)}
                      itemCount={categoryOptions.length}
                      counts={categoryCounts}
                      selected={draft.accessCategoryFilters}
                      onToggle={(value) =>
                        setDraft((current) => {
                          const nextCategories = toggleFilterValue(current.accessCategoryFilters, value);
                          const allowedSubcategories = new Set(nextCategories.flatMap((category) => (accessSubcategories[category] ?? []).map((option) => option.value)));
                          return {
                            ...current,
                            accessCategoryFilters: nextCategories,
                            accessSubcategoryFilters: current.accessSubcategoryFilters.filter(
                              (subCategory) => allowedSubcategories.size === 0 || allowedSubcategories.has(subCategory),
                            ),
                          };
                        })
                      }
                      onSelectAll={(values) =>
                        setDraft((current) => {
                          const allowedSubcategories = new Set(values.flatMap((category) => (accessSubcategories[category] ?? []).map((option) => option.value)));
                          return {
                            ...current,
                            accessCategoryFilters: values,
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
                      options={filteredSubCategoryOptions.map((option) => option.value)}
                      itemCount={filteredSubCategoryOptions.length}
                      counts={subCategoryCounts}
                      selected={draft.accessSubcategoryFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          accessSubcategoryFilters: toggleFilterValue(current.accessSubcategoryFilters, value),
                        }))
                      }
                      onSelectAll={(values) => setDraft((current) => ({ ...current, accessSubcategoryFilters: values }))}
                      onClear={() => clearDraftField("accessSubcategoryFilters")}
                    />
                  </div>
                </FilterSection>

                <FilterSection title="Activity">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MultiSelectDropdown
                      title="Status"
                      placeholder="Select status"
                      options={userStatusSummary ? (Object.keys(userStatusSummary).map(k => k.charAt(0).toUpperCase() + k.slice(1)) as FilterStatusValue[]) : FILTER_STATUS_OPTIONS}
                      itemCount={userStatusSummary ? Object.keys(userStatusSummary).length : FILTER_STATUS_OPTIONS.length}
                      counts={userStatusSummary ? Object.fromEntries(Object.entries(userStatusSummary).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v])) : undefined}
                      disabledOptions={(() => {
                        const zeroCountStatuses = userStatusSummary
                          ? Object.entries(userStatusSummary)
                              .filter(([, v]) => v === 0)
                              .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
                          : [];
                        const initiateDisabled =
                          draft.statusFilterMode.includes("initiate") && !draft.statusFilterMode.includes("modify")
                            ? ["Active", "Inactive"]
                            : [];
                        return Array.from(new Set([...zeroCountStatuses, ...initiateDisabled]));
                      })()}
                      selected={draft.statusFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          statusFilters: (toggleFilterValue(current.statusFilters, value as FilterStatusValue) as FilterStatusValue[]),
                        }))
                      }
                      onSelectAll={(values) => setDraft((current) => ({ ...current, statusFilters: values as FilterStatusValue[] }))}
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
                                  type="radio"
                                  name="sub-status"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDraft((current) => ({
                                        ...current,
                                        statusFilterMode: [option.value as StatusFilterModeValue],
                                        ...(option.value === "initiate" ? { statusFilters: ["Pending"] as FilterStatusValue[] } : {}),
                                      }));
                                    }
                                  }}
                                  className="h-4 w-4 rounded-full border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldHeader title="Has pending action" count={2} onClear={() => clearDraftField("pendingActionFilter")} canClear={draft.pendingActionFilter !== null} />
                      <div className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-4">
                          {[
                            { id: "pending-action-yes", value: "Yes", label: "Yes" },
                            { id: "pending-action-no", value: "No", label: "No" },
                          ].map((option) => {
                            const isChecked = draft.pendingActionFilter === option.value;
                            return (
                              <label key={option.id} htmlFor={option.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700 whitespace-nowrap">
                                <input
                                  id={option.id}
                                  type="radio"
                                  name="has-pending-action"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      updateDraft("pendingActionFilter", option.value as PendingActionValue);
                                    }
                                  }}
                                  className="h-4 w-4 rounded-full border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      </div>
                    <RoleFilterDropdown
                      permissionSummary={permissionSummary}
                      selected={draft.roleFilters}
                      onToggle={(value) =>
                        setDraft((current) => ({
                          ...current,
                          roleFilters: toggleFilterValue(current.roleFilters, value as FilterRoleValue) as FilterRoleValue[],
                        }))
                      }
                      onSelectAll={(values) => setDraft((current) => ({ ...current, roleFilters: values as FilterRoleValue[] }))}
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

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
                <div className="flex items-center justify-end gap-2">
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
              <Button variant="outline" size="icon" aria-label="Sort members" className={cn("h-12 w-12 rounded-xl border-slate-200 bg-white shadow-sm", sortOrder !== "none" && "bg-slate-100")}>
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortOrderChange("none")}>Default</DropdownMenuItem>
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
    nodeNameFilterPaths: [],
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
  onSelectAll,
  counts,
  dropdownPosition = "bottom",
  disabled,
}: {
  title: string;
  placeholder: string;
  options: string[];
  itemCount?: number;
  disabledOptions?: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  onSelectAll?: (values: string[]) => void;
  counts?: Record<string, number>;
  dropdownPosition?: "top" | "bottom";
  disabled?: boolean;
}) {
  const normalizedOptions = useMemo(
    () =>
      options
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter(Boolean),
    [options],
  );
  const disabledOptionSet = useMemo(() => new Set(disabledOptions), [disabledOptions]);

  return (
    <div className="relative">
      <FieldHeader title={title} count={itemCount ?? normalizedOptions.length} onClear={onClear} canClear={selected.length > 0} />
      <SearchableMultiSelectMenu
        title={title}
        placeholder={placeholder}
        options={normalizedOptions.map((option) => ({
          value: option,
          label: option,
          count: counts?.[option],
          disabled: disabledOptionSet.has(option),
        }))}
        selected={selected}
        onToggle={onToggle}
        onSelectAll={
          onSelectAll
            ? onSelectAll
            : (values) => {
              values.forEach((value) => {
                if (!selected.includes(value)) onToggle(value);
              });
            }
        }
        disabled={disabled}
        triggerClassName="h-10 rounded-lg px-3 text-[12px]"
        contentClassName="w-full min-w-[260px] rounded-lg"
        side={dropdownPosition}
        searchInputClassName="h-9"
      />
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
  return (
    <div className="relative">
      <FieldHeader title={title} count={itemCount ?? options.length} onClear={onClear} canClear={Boolean(value)} />
      <SearchableSingleSelectMenu
        title={title}
        placeholder={placeholder}
        options={options.map((option) => ({ value: option, label: option }))}
        value={value}
        onChange={(nextValue) => onSelect(nextValue || null)}
        triggerClassName="h-10 rounded-lg px-3 text-[12px]"
        contentClassName="w-full min-w-[220px] rounded-lg"
        searchInputClassName="h-9"
      />
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
        <PopoverContent align="start" className="z-[120] w-[320px] border border-slate-200 bg-white p-3">
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
  selectedPaths,
  nodeAccessType,
  onToggle,
  onNodeAccessChange,
  onSelectAllChildren,
  onClearSelection,
}: {
  options: UserFilterNodeOption[];
  selected: string[];
  selectedPaths: string[];
  nodeAccessType: Record<string, NodeAccessValue[]>;
  onToggle: (option: UserFilterNodeOption) => void;
  onNodeAccessChange: (nodeName: string, accessType: NodeAccessValue) => void;
  onSelectAllChildren: (values: UserFilterNodeOption[]) => void;
  onClearSelection: () => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
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
  const optionByPath = useMemo(() => new Map(normalizedOptions.map((option) => [option.path, option])), [normalizedOptions]);
  const selectedOption = selectedPaths.length > 0
    ? optionByPath.get(selectedPaths[0])
    : normalizedOptions.find((option) => option.value === selected[0]);

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

  useEffect(() => {
    if (open) return;
    setSearch("");
    setIsSearchExpanded(false);
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
              ? `${selectedOption ? formatNodeOptionLabel(selectedOption) : selected[0]}${nodeAccessType[selected[0]]?.length ? ` - ${nodeAccessType[selected[0]].join(", ")}` : ""}`
              : `${selected.length} selected`}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 min-w-[380px] max-w-[min(95vw,500px)] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Node Name</div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (isSearchExpanded) {
                  setSearch("");
                  setIsSearchExpanded(false);
                  return;
                }
                setIsSearchExpanded(true);
              }}
              className="h-9 w-9 rounded-lg border-slate-200 bg-slate-50 text-slate-600 shadow-none hover:border-slate-300 hover:bg-white"
              aria-label={isSearchExpanded ? "Close node name search" : "Open node name search"}
            >
              {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div
            className={cn(
              "overflow-hidden transition-all duration-250 ease-out",
              isSearchExpanded ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    setSearch("");
                    setIsSearchExpanded(false);
                  }
                }}
                placeholder="Search node name..."
                className="h-9 rounded-xl border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] shadow-none"
                autoComplete="off"
                autoFocus={isSearchExpanded}
              />
            </div>
          </div>
          <div className="max-h-[220px] space-y-2 overflow-auto">
            {filteredOptions.map((option) => {
              const isSelected = selectedPaths.length > 0 ? selectedPaths.includes(option.path) : selected.includes(option.value);
              const childOptions = normalizedOptions
                .filter((candidate) => isDescendantNodePath(option.path, candidate.path))
              const selectableChildOptions = childOptions.filter((candidate) => !selectedPaths.includes(candidate.path));
              return (
                <div key={`${option.path}-${option.value}`} className={cn("rounded-lg border p-2", isSelected ? "border-blue-200 bg-blue-50/40" : "border-slate-100")} style={{ marginLeft: `${((option.level ?? 1) - 1) * 16}px` }}>
                  <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex cursor-pointer items-start gap-2 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(option)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          {formatNodeOptionLevelLabel(option) ? (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-indigo-700 ring-1 ring-indigo-200/60">
                              {formatNodeOptionLevelLabel(option)}
                            </span>
                          ) : null}
                          <p className="text-sm font-medium text-slate-800 break-words">{option.value}</p>
                          {typeof getNodeOptionCount(option) === "number" ? (
                            <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 ring-1 ring-amber-200/70">
                              {getNodeOptionCount(option)}
                            </span>
                          ) : null}
                        </div>
                      </label>
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center gap-2 shrink-0">
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
                              title={isSelected ? "Primary node access" : "Select node first"}
                            >
                              P
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center">
                            {isSelected ? "Primary node access" : "Select node first"}
                          </TooltipContent>
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
                              title={isSelected ? "Secondary node access" : "Select node first"}
                            >
                              S
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center">
                            {isSelected ? "Secondary node access" : "Select node first"}
                          </TooltipContent>
                        </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                    <div className="pl-6">
                      <p className="text-[10px] text-slate-500 break-all">{option.path}</p>
                    </div>
                  </div>
                  {isSelected && childOptions.length > 0 ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-100 bg-white/80 px-2.5 py-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Child Nodes ({childOptions.length})
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-7 rounded-full border-blue-200 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50",
                          selectableChildOptions.length === 0 && "opacity-70",
                        )}
                        onClick={() => onSelectAllChildren(childOptions)}
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

function RoleFilterDropdown({
  permissionSummary,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  permissionSummary?: Record<string, PermissionSummaryEntry>;
  selected: string[];
  onToggle: (value: string) => void;
  onSelectAll?: (values: string[]) => void;
  onClear: () => void;
}) {
  const roleOptions = useMemo(() => {
    if (!permissionSummary || Object.keys(permissionSummary).length === 0) {
      return DEFAULT_FILTER_ROLE_OPTIONS.map((role) => ({
        value: role,
        count: 0,
        hasCount: false,
      }));
    }
    return Object.entries(permissionSummary).map(([key, entry]) => ({
      value: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
      count: entry.count,
      hasCount: true,
    }));
  }, [permissionSummary]);

  const visibleOptions = roleOptions.map((o) => o.value);
  const counts = Object.fromEntries(
    roleOptions.filter((o) => o.hasCount).map((o) => [o.value, o.count]),
  );
  const disabledOptions = roleOptions
    .filter((o) => o.hasCount && o.count === 0)
    .map((o) => o.value);

  return (
    <MultiSelectDropdown
      title="Roles"
      placeholder="Select role"
      options={visibleOptions}
      itemCount={visibleOptions.length}
      counts={Object.keys(counts).length > 0 ? counts : undefined}
      disabledOptions={disabledOptions}
      selected={selected}
      dropdownPosition="top"
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onClear={onClear}
    />
  );
}






