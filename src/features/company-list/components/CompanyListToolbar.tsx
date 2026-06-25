import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Filter, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  SearchableMultiSelectMenu,
  SearchableSingleSelectMenu,
} from "@/components/filter-search-dropdown";
import {
  COMPANY_LIST_BOOLEAN_OPTIONS,
  COMPANY_LIST_DATE_OPTIONS,
  COMPANY_LIST_SIGNATORY_OPTIONS,
  type CompanyListAppliedFiltersDraft,
  type CompanyListBooleanFilterValue,
  type CompanyListToolbarProps,
  type StatusTab,
} from "@/features/company-list/types";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";

const STATUS_TABS: Array<{ id: StatusTab; label: string; badgeClassName: string }> = [
  { id: "active", label: "Active", badgeClassName: "bg-emerald-100 text-emerald-700" },
  { id: "pending", label: "Pending", badgeClassName: "bg-amber-100 text-amber-700" },
  { id: "inactive", label: "Inactive", badgeClassName: "bg-rose-100 text-rose-700" },
];

const buildEmptyDraft = (): CompanyListAppliedFiltersDraft => ({
  incorporationDate: null,
  fromDate: "",
  toDate: "",
  gstcode: null,
  isCode: null,
  signatoryCount: [],
});

const countFilters = (draft: CompanyListAppliedFiltersDraft) =>
  (draft.incorporationDate ? 1 : 0) +
  (draft.gstcode ? 1 : 0) +
  (draft.isCode ? 1 : 0) +
  draft.signatoryCount.length;

const dateLabel = (value: (typeof COMPANY_LIST_DATE_OPTIONS)[number]) =>
  value === "7days" ? "7 Days" : value === "15days" ? "15 Days" : value === "1month" ? "1 Month" : "Custom";

export default function CompanyListToolbar({
  searchInput,
  onSearchInputChange,
  onClearSearch,
  searchSuggestions,
  selectedStatusTab,
  onStatusTabChange,
  statusCounts,
  appliedFilters,
  onApplyFilters,
  onClearAdvancedFilters,
  todayIso,
  onOpenOnboarding,
  hasNewCompanyListEvent,
  suppressAutoEventTooltip = false,
  isRefreshing = false,
  onRefresh,
  refreshInitializedAt,
}: CompanyListToolbarProps) {
  const visibleStatusTabs = STATUS_TABS.filter((option) => {
    if (option.id === "active") return true;
    if (option.id === "pending") return statusCounts.pending > 0;
    return statusCounts[option.id] > 0;
  });
  const activeFilterCount = countFilters(appliedFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<CompanyListAppliedFiltersDraft>(buildEmptyDraft());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const { refreshLabel, markRefreshed } = useRefreshTimestamp({ initializedAt: refreshInitializedAt });

  useEffect(() => {
    if (!isApplyingFilters) return;
    if (isRefreshing) {
      setFiltersOpen(false);
      return;
    }
    if (!filtersOpen) {
      setIsApplyingFilters(false);
    }
  }, [filtersOpen, isApplyingFilters, isRefreshing]);

  const syncDraft = () => {
    setDraft({
      ...appliedFilters,
      signatoryCount: [...appliedFilters.signatoryCount],
    });
  };

  const setFromDate = (value: string) => {
    const normalized = value && value > todayIso ? todayIso : value;
    setDraft((current) => ({
      ...current,
      fromDate: normalized,
      toDate: current.toDate && normalized && normalized > current.toDate ? normalized : current.toDate,
    }));
  };

  const setToDate = (value: string) => {
    const normalized = value && value > todayIso ? todayIso : value;
    setDraft((current) => ({
      ...current,
      toDate: normalized,
      fromDate: current.fromDate && normalized && normalized < current.fromDate ? normalized : current.fromDate,
    }));
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Company List</h1>
        </div>
        <Button onClick={onOpenOnboarding} className="gap-2 bg-[hsl(235,60%,50%)] hover:bg-[hsl(235,60%,45%)] text-white shadow-[0_10px_24px_rgba(30,35,80,0.22)]">
          <Plus className="h-4 w-4" /> Add New Company
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              onChange={(event) => onSearchInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchInputChange(searchInput.trim());
              }}
              placeholder="Search companies or groups..."
              className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-9 text-[15px] shadow-sm"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => {
                  onClearSearch();
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
                      onSearchInputChange(suggestion);
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
              {visibleStatusTabs.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onStatusTabChange(option.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                    selectedStatusTab === option.id
                      ? "bg-[hsl(235,60%,50%)] text-white shadow-[0_10px_24px_rgba(30,35,80,0.22)]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  )}
                  aria-pressed={selectedStatusTab === option.id}
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      selectedStatusTab === option.id ? "bg-white/18 text-white ring-1 ring-white/25" : option.badgeClassName,
                    )}
                  >
                    {statusCounts[option.id]}
                  </span>
                </button>
              ))}
            </div>

            <Popover
              open={filtersOpen}
              onOpenChange={(nextOpen) => {
                if (nextOpen) syncDraft();
                setFiltersOpen(nextOpen);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-12 rounded-xl border-slate-200 bg-white px-5 text-[15px] font-medium shadow-sm transition-all hover:border-slate-300",
                    activeFilterCount > 0 && "border-primary/40 bg-primary/[0.04] text-primary",
                  )}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[560px] rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_26px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
              >
                <div className="border-b border-slate-200 bg-white px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold tracking-[0.01em] text-slate-900">Filter Companies</p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No filters applied"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      onClick={async () => {
                        setDraft(buildEmptyDraft());
                        await onClearAdvancedFilters();
                        setFiltersOpen(false);
                      }}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>

                <div className="max-h-[68vh] overflow-y-auto bg-white px-5 py-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <DateDropdown
                      value={draft.incorporationDate}
                      fromDate={draft.fromDate}
                      toDate={draft.toDate}
                      todayIso={todayIso}
                      onClear={() =>
                        setDraft((current) => ({
                          ...current,
                          incorporationDate: null,
                          fromDate: "",
                          toDate: "",
                        }))
                      }
                      onValueChange={(option) =>
                        setDraft((current) => ({
                          ...current,
                          incorporationDate: current.incorporationDate === option ? null : option,
                          fromDate: option === "custom" ? current.fromDate : "",
                          toDate: option === "custom" ? current.toDate : "",
                        }))
                      }
                      onFromDateChange={setFromDate}
                      onToDateChange={setToDate}
                    />
                    <SingleSelectDropdown
                      title="GST Code"
                      placeholder="Select GST code"
                      options={COMPANY_LIST_BOOLEAN_OPTIONS.map((option) => ({
                        value: option,
                        label: option.toUpperCase(),
                      }))}
                      value={draft.gstcode}
                      onClear={() => setDraft((current) => ({ ...current, gstcode: null }))}
                      onSelect={(value) => setDraft((current) => ({ ...current, gstcode: current.gstcode === value ? null : value as CompanyListBooleanFilterValue }))}
                    />
                    <SingleSelectDropdown
                      title="IE Code"
                      placeholder="Select IE code"
                      options={COMPANY_LIST_BOOLEAN_OPTIONS.map((option) => ({
                        value: option,
                        label: option.toUpperCase(),
                      }))}
                      value={draft.isCode}
                      onClear={() => setDraft((current) => ({ ...current, isCode: null }))}
                      onSelect={(value) => setDraft((current) => ({ ...current, isCode: current.isCode === value ? null : value as CompanyListBooleanFilterValue }))}
                    />
                    <MultiSelectDropdown
                      title="Signatory Count"
                      placeholder="Select signatory count"
                      options={COMPANY_LIST_SIGNATORY_OPTIONS.map((count) => ({
                        value: String(count),
                        label: String(count),
                      }))}
                      selected={draft.signatoryCount.map(String)}
                      onClear={() => setDraft((current) => ({ ...current, signatoryCount: [] }))}
                      onToggle={(value) =>
                        setDraft((current) => {
                          const count = Number(value);
                          return {
                            ...current,
                            signatoryCount: current.signatoryCount.includes(count)
                              ? current.signatoryCount.filter((item) => item !== count)
                              : [...current.signatoryCount, count].sort((a, b) => a - b),
                          };
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isApplyingFilters}
                    onClick={() => {
                      syncDraft();
                      setFiltersOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={isApplyingFilters}
                    onClick={() => {
                      setIsApplyingFilters(true);
                      onApplyFilters(draft);
                    }}
                  >
                    {isApplyingFilters ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Apply
                      </>
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative flex h-12 w-12 items-center justify-center">
              <TooltipProvider delayDuration={120}>
                <Tooltip open={!suppressAutoEventTooltip && hasNewCompanyListEvent ? true : undefined}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Refresh company list"
                      onClick={async () => {
                        await onRefresh();
                        markRefreshed();
                      }}
                      className={cn(
                        "h-12 w-12 rounded-xl border-slate-200 bg-white shadow-sm transition-all duration-200",
                        isRefreshing && "scale-[1.03] border-[hsl(235,60%,50%)]/35 shadow-[0_10px_24px_rgba(30,35,80,0.16)]",
                        hasNewCompanyListEvent &&
                          "border-[hsl(235,60%,50%)] bg-[hsl(235,60%,50%)] text-white shadow-[0_10px_24px_rgba(30,35,80,0.22)] hover:bg-[hsl(235,60%,50%)] hover:text-white",
                      )}
                    >
                      <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {hasNewCompanyListEvent ? "New event occurred" : "Refresh company list"}
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
    </>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>;
}

function DropdownField({
  title,
  canClear = false,
  onClear,
  children,
}: {
  title: string;
  canClear?: boolean;
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel title={title} />
        {canClear && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 transition hover:text-blue-700"
          >
            Clear
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SingleSelectDropdown({
  title,
  placeholder,
  options,
  value,
  onClear,
  onSelect,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onClear?: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownField title={title} canClear={Boolean(value)} onClear={onClear}>
      <SearchableSingleSelectMenu
        title={title}
        placeholder={placeholder}
        options={options}
        value={value}
        onChange={onSelect}
        triggerClassName="h-11 rounded-xl px-3.5 text-[15px]"
        contentClassName="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl"
        sideOffset={8}
      />
    </DropdownField>
  );
}

function MultiSelectDropdown({
  title,
  placeholder,
  options,
  selected,
  onClear,
  onToggle,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onClear?: () => void;
  onToggle: (value: string) => void;
}) {
  return (
    <DropdownField title={title} canClear={selected.length > 0} onClear={onClear}>
      <SearchableMultiSelectMenu
        title={title}
        placeholder={placeholder}
        options={options}
        selected={selected}
        onToggle={onToggle}
        onSelectAll={(values) => {
          values.forEach((value) => {
            if (!selected.includes(value)) onToggle(value);
          });
        }}
        triggerClassName="h-11 rounded-xl px-3.5 text-[15px]"
        contentClassName="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl"
        sideOffset={8}
      />
    </DropdownField>
  );
}

function DateDropdown({
  value,
  fromDate,
  toDate,
  todayIso,
  onClear,
  onValueChange,
  onFromDateChange,
  onToDateChange,
}: {
  value: CompanyListAppliedFiltersDraft["incorporationDate"];
  fromDate: string;
  toDate: string;
  todayIso: string;
  onClear?: () => void;
  onValueChange: (value: NonNullable<CompanyListAppliedFiltersDraft["incorporationDate"]>) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
}) {
  const selectedLabel =
    value === "custom"
      ? fromDate || toDate
        ? `${fromDate || "From"} to ${toDate || "To"}`
        : "Custom"
      : value
        ? dateLabel(value)
        : "Select date";

  return (
    <DropdownField title="Incorporation Date" canClear={Boolean(value || fromDate || toDate)} onClear={onClear}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]",
              value && "border-primary/40 text-primary",
            )}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] rounded-xl border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            {COMPANY_LIST_DATE_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={value === option ? "default" : "outline"}
                size="sm"
                className="h-9 px-2 text-[12px]"
                onClick={() => onValueChange(option)}
              >
                {dateLabel(option)}
              </Button>
            ))}
          </div>
          {value === "custom" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">From</p>
                <Input
                  type="date"
                  max={toDate || todayIso}
                  value={fromDate}
                  onChange={(event) => onFromDateChange(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">To</p>
                <Input
                  type="date"
                  min={fromDate || undefined}
                  max={todayIso}
                  value={toDate}
                  onChange={(event) => onToDateChange(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownField>
  );
}
