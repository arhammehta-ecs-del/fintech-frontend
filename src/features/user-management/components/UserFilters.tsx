import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpDown, ChevronDown, Filter, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatRoleTokenLabel } from "@/features/user-management/roleLabels";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";

const STATUS_TABS: Array<{ id: MemberStatusTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

const STATUS_BADGE_CLASS: Record<MemberStatusTab, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  inactive: "bg-rose-100 text-rose-700",
};

type UserFiltersProps = {
  statusTab: MemberStatusTab;
  onStatusTabChange: (value: MemberStatusTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchSuggestions: string[];
  designationFilters: string[];
  onToggleDesignation: (value: string) => void;
  accessCategoryFilters: string[];
  onToggleAccessCategory: (value: string) => void;
  accessSubcategoryFilters: string[];
  onToggleAccessSubcategory: (value: string) => void;
  departmentFilters: string[];
  onToggleDepartment: (value: string) => void;
  reportingManagerFilters: string[];
  onToggleReportingManager: (value: string) => void;
  primaryNodeFilters: string[];
  onTogglePrimaryNode: (value: string) => void;
  secondaryNodeFilters: string[];
  onToggleSecondaryNode: (value: string) => void;
  onboardingDateFrom: string;
  onboardingDateTo: string;
  onOnboardingDateFromChange: (value: string) => void;
  onOnboardingDateToChange: (value: string) => void;
  onClearAdvancedFilters: () => void;
  onApplyAdvancedFilters: (filters: {
    designationFilters: string[];
    accessCategoryFilters: string[];
    accessSubcategoryFilters: string[];
    departmentFilters: string[];
    reportingManagerFilters: string[];
    primaryNodeFilters: string[];
    secondaryNodeFilters: string[];
  }) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  hasNewUserEvent: boolean;
  onRefresh: () => void | Promise<void>;
  roles: string[];
  accessCategories: string[];
  accessSubcategories: string[];
  departments: string[];
  reportingManagerOptions: string[];
  primaryNodeOptions: string[];
  secondaryNodeOptions: string[];
  statusCounts: Record<MemberStatusTab, number>;
};

export default function UserFilters({
  statusTab,
  onStatusTabChange,
  search,
  onSearchChange,
  searchSuggestions,
  designationFilters,
  onToggleDesignation,
  accessCategoryFilters,
  onToggleAccessCategory,
  accessSubcategoryFilters,
  onToggleAccessSubcategory,
  departmentFilters,
  onToggleDepartment,
  reportingManagerFilters,
  onToggleReportingManager,
  primaryNodeFilters,
  onTogglePrimaryNode,
  secondaryNodeFilters,
  onToggleSecondaryNode,
  onboardingDateFrom,
  onboardingDateTo,
  onOnboardingDateFromChange,
  onOnboardingDateToChange,
  onClearAdvancedFilters,
  onApplyAdvancedFilters,
  hasNewUserEvent,
  onRefresh,
  onSortOrderChange,
  roles,
  accessCategories,
  accessSubcategories,
  departments,
  reportingManagerOptions,
  primaryNodeOptions,
  secondaryNodeOptions,
  statusCounts,
}: UserFiltersProps) {
  const visibleTabs = STATUS_TABS.filter((tab) => tab.id === "active" || statusCounts[tab.id] > 0);
  const activeFilterCount =
    designationFilters.length +
    accessCategoryFilters.length +
    accessSubcategoryFilters.length +
    departmentFilters.length +
    reportingManagerFilters.length +
    primaryNodeFilters.length +
    secondaryNodeFilters.length +
    (onboardingDateFrom ? 1 : 0) +
    (onboardingDateTo ? 1 : 0);
  const hasAnyFilter = activeFilterCount > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftDesignationFilters, setDraftDesignationFilters] = useState<string[]>(designationFilters);
  const [draftAccessCategoryFilters, setDraftAccessCategoryFilters] = useState<string[]>(accessCategoryFilters);
  const [draftAccessSubcategoryFilters, setDraftAccessSubcategoryFilters] = useState<string[]>(accessSubcategoryFilters);
  const [draftDepartmentFilters, setDraftDepartmentFilters] = useState<string[]>(departmentFilters);
  const [draftReportingManagerFilters, setDraftReportingManagerFilters] = useState<string[]>(reportingManagerFilters);
  const [draftPrimaryNodeFilters, setDraftPrimaryNodeFilters] = useState<string[]>(primaryNodeFilters);
  const [draftSecondaryNodeFilters, setDraftSecondaryNodeFilters] = useState<string[]>(secondaryNodeFilters);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const toggleValue = (current: string[], value: string) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

  const resetDraftFilters = () => {
    setDraftDesignationFilters([]);
    setDraftAccessCategoryFilters([]);
    setDraftAccessSubcategoryFilters([]);
    setDraftDepartmentFilters([]);
    setDraftReportingManagerFilters([]);
    setDraftPrimaryNodeFilters([]);
    setDraftSecondaryNodeFilters([]);
  };

  const syncDraftFromApplied = () => {
    setDraftDesignationFilters(designationFilters);
    setDraftAccessCategoryFilters(accessCategoryFilters);
    setDraftAccessSubcategoryFilters(accessSubcategoryFilters);
    setDraftDepartmentFilters(departmentFilters);
    setDraftReportingManagerFilters(reportingManagerFilters);
    setDraftPrimaryNodeFilters(primaryNodeFilters);
    setDraftSecondaryNodeFilters(secondaryNodeFilters);
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
              if (event.key === "Enter") {
                onSearchChange(search.trim());
              }
            }}
            placeholder="Search by name, email, or designation..."
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
                aria-pressed={statusTab === tab.id}
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
            onOpenChange={(nextOpen) => {
              if (nextOpen) syncDraftFromApplied();
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
              className="w-[460px] rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_26px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
            >
              <div className="border-b border-slate-200 bg-white px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold tracking-[0.01em] text-slate-900">Filter Members</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {hasAnyFilter ? `${activeFilterCount} filters applied` : "No filters applied"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={resetDraftFilters}
                  >
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="max-h-[62vh] space-y-3.5 overflow-y-auto bg-white px-5 py-3.5">
                <FilterSection title="Identity">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FilterDropdown
                      title="Designation"
                      placeholder="All designations"
                      options={roles}
                      selected={draftDesignationFilters}
                      onToggle={(value) => setDraftDesignationFilters((current) => toggleValue(current, value))}
                    />
                    <FilterDropdown
                      title="Node Name"
                      placeholder="All node names"
                      options={departments}
                      selected={draftDepartmentFilters}
                      onToggle={(value) => setDraftDepartmentFilters((current) => toggleValue(current, value))}
                    />
                    <FilterDropdown
                      title="Category"
                      placeholder="All categories"
                      options={accessCategories}
                      selected={draftAccessCategoryFilters}
                      onToggle={(value) => setDraftAccessCategoryFilters((current) => toggleValue(current, value))}
                    />
                    <FilterDropdown
                      title="Subcategory"
                      placeholder="All subcategories"
                      options={accessSubcategories}
                      selected={draftAccessSubcategoryFilters}
                      onToggle={(value) => setDraftAccessSubcategoryFilters((current) => toggleValue(current, value))}
                    />
                    <FilterDropdown
                      title="Primary Node"
                      placeholder="All primary nodes"
                      options={primaryNodeOptions}
                      selected={draftPrimaryNodeFilters}
                      onToggle={(value) => setDraftPrimaryNodeFilters((current) => toggleValue(current, value))}
                    />
                    <FilterDropdown
                      title="Secondary Node"
                      placeholder="All secondary nodes"
                      options={secondaryNodeOptions}
                      selected={draftSecondaryNodeFilters}
                      onToggle={(value) => setDraftSecondaryNodeFilters((current) => toggleValue(current, value))}
                    />
                    <div className="md:col-span-2">
                      <FilterDropdown
                        title="Reporting Manager"
                        placeholder="All reporting managers"
                        options={reportingManagerOptions}
                        selected={draftReportingManagerFilters}
                        onToggle={(value) => setDraftReportingManagerFilters((current) => toggleValue(current, value))}
                      />
                    </div>
                  </div>
                </FilterSection>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    syncDraftFromApplied();
                    setFiltersOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onApplyAdvancedFilters({
                      designationFilters: draftDesignationFilters,
                      accessCategoryFilters: draftAccessCategoryFilters,
                      accessSubcategoryFilters: draftAccessSubcategoryFilters,
                      departmentFilters: draftDepartmentFilters,
                      reportingManagerFilters: draftReportingManagerFilters,
                      primaryNodeFilters: draftPrimaryNodeFilters,
                      secondaryNodeFilters: draftSecondaryNodeFilters,
                    });
                    setFiltersOpen(false);
                  }}
                >
                  Apply
                </Button>
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

          <TooltipProvider delayDuration={120}>
            <Tooltip open={hasNewUserEvent ? true : undefined}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Refresh users"
                  onClick={() => {
                    void onRefresh();
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
              {hasNewUserEvent ? <TooltipContent side="top">New event occured</TooltipContent> : null}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({
  title,
  placeholder,
  options,
  selected,
  onToggle,
}: {
  title: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputId = `${title.replace(/\s+/g, "-").toLowerCase()}-search`;
  const summaryLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? formatRoleTokenLabel(selected[0])
        : `${selected.length} selected`;
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(searchTerm));

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</Label>
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
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-left text-[12px] font-medium hover:border-slate-300",
              selected.length > 0 ? "border-blue-200 bg-blue-50/40 text-blue-800" : "text-slate-700",
            )}
          >
            <span className="truncate">{summaryLabel}</span>
            <span className="ml-2 inline-flex items-center gap-1.5">
              {selected.length > 0 ? (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {selected.length}
                </span>
              ) : null}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <DropdownMenuLabel className="p-0 text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</DropdownMenuLabel>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (isSearchExpanded) {
                  setSearchTerm("");
                  setIsSearchExpanded(false);
                  return;
                }
                setIsSearchExpanded(true);
              }}
              className="h-9 w-9 rounded-lg border-slate-200 bg-slate-50 text-slate-600 shadow-none hover:border-slate-300 hover:bg-white"
              aria-label={isSearchExpanded ? `Close ${title.toLowerCase()} search` : `Open ${title.toLowerCase()} search`}
            >
              {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div
            className={cn(
              "overflow-hidden px-1 transition-all duration-250 ease-out",
              isSearchExpanded ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id={searchInputId}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  // Prevent Radix DropdownMenu typeahead from stealing focus on first key press.
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    setSearchTerm("");
                    setIsSearchExpanded(false);
                  }
                }}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] shadow-none"
                autoComplete="off"
                autoFocus={isSearchExpanded}
              />
            </div>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-slate-400">No options available</div>
          ) : (
            <div className="mt-2 max-h-56 overflow-y-auto">
              {filteredOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={selected.includes(option)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => onToggle(option)}
                className="text-[13px]"
              >
                  {formatRoleTokenLabel(option)}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/45 p-3 shadow-[0_2px_8px_rgba(148,163,184,0.1)]">
      <p className="border-b border-slate-200 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-700">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
