import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, CircleCheck, Filter, RefreshCw, Search, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PaginationFooter from "@/components/PaginationFooter";
import { cn } from "@/lib/utils";
import {
  API_MONITORING_DATE_OPTIONS,
  API_MONITORING_RESPONSE_SIZE_OPTIONS,
  API_MONITORING_RESPONSE_SORT_OPTIONS,
  API_MONITORING_STATUS_OPTIONS,
  useApiMonitoring,
  type ApiMonitoringAppliedFiltersDraft,
} from "@/features/api-monitoring/hooks/useApiMonitoring";
import type { ApiMonitoringLog } from "@/features/api-monitoring/types";
import ApiMonitoringDetailsDialog from "@/features/api-monitoring/components/ApiMonitoringDetailsDialog";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";

const getStatusIcon = (status: number | null) => {
  if (status === null) return <AlertTriangle className="h-5 w-5 text-slate-400" />;
  if (status >= 200 && status < 300) return <CircleCheck className="h-5 w-5 text-emerald-600" />;
  if (status >= 400 && status < 500) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
};

const companyBadgeStyle = (code: string) => {
  const source = (code || "N/A").trim();
  const hash = source.split("").reduce((acc, ch, index) => acc + (ch.charCodeAt(0) * (index + 1)), 0);
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsl(${hue} 85% 92%)`,
    color: `hsl(${hue} 65% 28%)`,
    borderColor: `hsl(${hue} 70% 78%)`,
  };
};

const buildEmptyDraft = (): ApiMonitoringAppliedFiltersDraft => ({
  date: null,
  fromDate: "",
  toDate: "",
  status: [],
  subtrack: [],
  responseSize: null,
  responseSizeSort: null,
});

const countFilters = (draft: ApiMonitoringAppliedFiltersDraft) =>
  (draft.date ? 1 : 0) +
  draft.status.length +
  draft.subtrack.length +
  (draft.responseSize ? 1 : 0) +
  (draft.responseSizeSort ? 1 : 0) +
  (draft.fromDate ? 1 : 0) +
  (draft.toDate ? 1 : 0);

const dateLabel = (value: (typeof API_MONITORING_DATE_OPTIONS)[number]) =>
  value === "7days" ? "7 Days" : value === "15days" ? "15 Days" : value === "1month" ? "1 Month" : "Custom";

export default function ApiMonitoringView() {
  const {
    filteredLogs,
    paginatedLogs,
    loading,
    error,
    searchInput,
    setSearchInput,
    searchText,
    clearSearch,
    suggestions,
    appliedFilters,
    applyFilters,
    clearFilters,
    pageSize,
    setPageSize,
    safePage,
    totalPages,
    totalCount,
    pageSizeOptions,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
    fetchDetailsForTrack,
    refreshLogs,
    todayIso,
  } = useApiMonitoring();
  const [selectedLog, setSelectedLog] = useState<ApiMonitoringLog | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<ApiMonitoringAppliedFiltersDraft>(buildEmptyDraft());
  const [subtrackInput, setSubtrackInput] = useState("");
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const { refreshLabel, lastRefreshedAt, markRefreshed } = useRefreshTimestamp();

  const activeFilterCount = countFilters(appliedFilters);

  const syncDraft = () => {
    setDraft({
      ...appliedFilters,
      status: [...appliedFilters.status],
      subtrack: [...appliedFilters.subtrack],
    });
    setSubtrackInput("");
  };

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading API logs...";
    if (error) return error;
    if (searchText.trim()) return "No logs found for this search.";
    return "No API monitoring logs available.";
  }, [loading, error, searchText]);

  const currentRangeSummary = useMemo(() => {
    if (totalCount <= 0 || paginatedLogs.length === 0) return "Range: 0-0/0";
    const start = Math.max(1, (safePage - 1) * pageSize + 1);
    const end = Math.min(totalCount, start + paginatedLogs.length - 1);
    return `Range: ${start}-${end}/${totalCount}`;
  }, [pageSize, paginatedLogs.length, safePage, totalCount]);

  useEffect(() => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [safePage]);

  useEffect(() => {
    if (loading || error) return;
    if (lastRefreshedAt) return;
    markRefreshed();
  }, [error, lastRefreshedAt, loading, markRefreshed]);

  const toggleStatus = (status: number) =>
    setDraft((current) => ({
      ...current,
      status: current.status.includes(status) ? current.status.filter((item) => item !== status) : [...current.status, status],
    }));

  const addSubtrack = (value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    setDraft((current) => ({
      ...current,
      subtrack: current.subtrack.includes(parsed) ? current.subtrack : [...current.subtrack, parsed].sort((a, b) => a - b),
    }));
    setSubtrackInput("");
  };

  const removeSubtrack = (value: number) =>
    setDraft((current) => ({ ...current, subtrack: current.subtrack.filter((item) => item !== value) }));

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
    <div className="space-y-4">
      <Card className="rounded-xl border border-border px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">API Monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real-time traffic and latency tracking</p>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm md:flex md:h-[760px] md:flex-col">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative w-full lg:flex-1 lg:pr-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-9 pr-9"
                placeholder="Search by company name/code, user name/email, IP, URL, track ID..."
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    clearSearch();
                    setShowSuggestions(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              {showSuggestions && suggestions.length > 0 ? (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setSearchInput(suggestion);
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
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Popover
                open={filtersOpen}
                onOpenChange={(nextOpen) => {
                  if (nextOpen) syncDraft();
                  setFiltersOpen(nextOpen);
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("gap-1.5", activeFilterCount > 0 && "border-primary/40 text-primary")}>
                    <Filter className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">{activeFilterCount}</span> : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[640px] p-0">
                  <div className="border-b px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-semibold tracking-[0.01em] text-slate-900">Filter Logs</p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No filters applied"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        onClick={async () => {
                          const empty = buildEmptyDraft();
                          setDraft(empty);
                          setSubtrackInput("");
                          clearFilters();
                          setFiltersOpen(false);
                        }}
                      >
                        Clear all
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[68vh] space-y-5 overflow-y-auto bg-white px-5 py-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DateDropdown
                        value={draft.date}
                        fromDate={draft.fromDate}
                        toDate={draft.toDate}
                        placeholder="Select date"
                        todayIso={todayIso}
                        onValueChange={(option) =>
                          setDraft((current) => ({
                            ...current,
                            date: current.date === option ? null : option,
                            fromDate: option === "custom" ? current.fromDate : "",
                            toDate: option === "custom" ? current.toDate : "",
                          }))
                        }
                        onFromDateChange={setFromDate}
                        onToDateChange={setToDate}
                      />
                      <MultiSelectDropdown
                        title="Status"
                        placeholder="Select statuses"
                        options={API_MONITORING_STATUS_OPTIONS.map((status) => ({ value: String(status), label: String(status) }))}
                        selected={draft.status.map(String)}
                        onToggle={(value) => toggleStatus(Number(value))}
                      />
                      <SubtrackDropdown
                        placeholder="Select subtracks"
                        value={subtrackInput}
                        selected={draft.subtrack}
                        onInputChange={setSubtrackInput}
                        onAdd={() => addSubtrack(subtrackInput)}
                        onRemove={removeSubtrack}
                      />
                      <SingleSelectDropdown
                        title="Response Size"
                        placeholder="Select response size"
                        options={API_MONITORING_RESPONSE_SIZE_OPTIONS.map((range) => ({ value: range, label: `${range} KB` }))}
                        value={draft.responseSize}
                        emptySummary=""
                        onSelect={(value) => setDraft((current) => ({ ...current, responseSize: current.responseSize === value ? null : value as typeof current.responseSize }))}
                      />
                      <SingleSelectDropdown
                        title="Response Size Flow"
                        placeholder="Select flow"
                        options={API_MONITORING_RESPONSE_SORT_OPTIONS.map((sort) => ({ value: sort, label: sort === "asc" ? "Ascending" : "Descending" }))}
                        value={draft.responseSizeSort}
                        emptySummary=""
                        onSelect={(value) => setDraft((current) => ({ ...current, responseSizeSort: current.responseSizeSort === value ? null : value as typeof current.responseSizeSort }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        applyFilters(draft);
                        setFiltersOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="relative flex h-11 w-10 items-center justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    void refreshLogs().then(() => {
                      markRefreshed();
                    });
                  }}
                  aria-label="Refresh API monitor"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
                {refreshLabel ? (
                  <p className="pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap text-right text-xs font-medium text-muted-foreground">
                    {refreshLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div ref={tableScrollRef} className="flex-1 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead className="text-sm uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-6 py-4 font-semibold">Company</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">User</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">Date & Time</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">API Endpoint</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">Response Size</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={async () => {
                    setSelectedLog(log);
                    try {
                      const details = await fetchDetailsForTrack(log.trackId || log.id);
                      setSelectedLog((current) => {
                        if (!current || current.trackId !== log.trackId) return current;
                        const parsed = details.mainRequest.timeString.split(" ");
                        const nextDate = parsed[0] || current.dateStr;
                        const nextTime = parsed.slice(1).join(" ") || current.timeStr;
                        return { ...current, id: details.mainRequest.id, trackId: details.mainRequest.trackId, method: details.mainRequest.method, path: details.mainRequest.path, status: details.mainRequest.status, timeString: details.mainRequest.timeString, timeStr: nextTime, dateStr: nextDate, subApis: [details.mainRequest, ...details.childSpans] };
                      });
                    } catch {
                      return;
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition hover:bg-muted/40"
                >
                  <td className="px-6 py-3 align-top">
                    <p className="text-sm font-medium text-foreground">{log.company.name}</p>
                    <span className={cn("mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold")} style={companyBadgeStyle(log.company.code)}>
                      {log.company.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-medium text-foreground">{log.user.name}</p>
                    <p className="mt-0.5 text-[11px] text-sky-700">{log.user.email}</p>
                    {log.clientIp ? <p className="mt-0.5 text-[11px] text-amber-700">{log.clientIp}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex flex-col leading-tight">
                      <span>{log.timeStr || "-"}</span>
                      <span className="mt-1 text-xs text-slate-500">{log.dateStr || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="max-w-[280px] truncate font-mono text-sm text-foreground">{log.path}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">{log.spanCount} sub-tracks</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <span className="font-medium text-slate-700">{log.responseSize || "-"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-start">{getStatusIcon(log.status)}</div>
                  </td>
                </tr>
              ))}
              {!filteredLogs.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          currentCount={Math.max(totalCount, filteredLogs.length)}
          recordCurrentCount={paginatedLogs.length}
          recordTotalCount={totalCount}
          recordLabel="Records"
          summaryTextOverride={currentRangeSummary}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={(value) => setPageSize(value as (typeof pageSizeOptions)[number])}
          safePage={safePage}
          totalPages={totalPages}
          onPrevPage={() => void handlePrevPage()}
          onNextPage={() => void handleNextPage()}
          onJumpToPage={(value) => void handleJumpToPage(value)}
        />
      </div>

      <ApiMonitoringDetailsDialog log={selectedLog} open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)} />
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>;
}

function SectionHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

function DropdownField({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <SectionLabel title={title} />
      {children}
      {summary ? <SectionHint>{summary}</SectionHint> : null}
    </div>
  );
}

function SingleSelectDropdown({
  title,
  placeholder,
  options,
  value,
  emptySummary = "No selection applied",
  onSelect,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  value: string | null;
  emptySummary?: string;
  onSelect: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;
  return (
    <DropdownField title={title} summary={value ? selectedLabel : emptySummary}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", value && "border-primary/40 text-primary")}>
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border border-slate-200 p-2">
          {options.map((option) => (
            <DropdownMenuItem key={option.value} onSelect={() => onSelect(option.value)} className="cursor-pointer rounded-md">
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownField>
  );
}

function MultiSelectDropdown({
  title,
  placeholder,
  options,
  selected,
  onToggle,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const summary =
    selected.length === 0
      ? ""
      : selected.length === 1
        ? options.find((option) => option.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;
  return (
    <DropdownField title={title} summary={summary}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", selected.length > 0 && "border-primary/40 text-primary")}>
            <span className="truncate">{selected.length === 0 ? placeholder : summary}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border border-slate-200 p-2">
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
              onSelect={(event) => event.preventDefault()}
              className="cursor-pointer rounded-md"
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownField>
  );
}

function DateDropdown({
  value,
  fromDate,
  toDate,
  placeholder,
  todayIso,
  onValueChange,
  onFromDateChange,
  onToDateChange,
}: {
  value: (typeof API_MONITORING_DATE_OPTIONS)[number] | null;
  fromDate: string;
  toDate: string;
  placeholder: string;
  todayIso: string;
  onValueChange: (value: (typeof API_MONITORING_DATE_OPTIONS)[number]) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
}) {
  const summary =
    value === "custom"
      ? fromDate || toDate
        ? `${fromDate || "Start"} to ${toDate || "End"}`
        : "Custom range"
      : value
        ? dateLabel(value)
        : "";
  return (
    <DropdownField title="Date" summary={summary}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", value && "border-primary/40 text-primary")}>
            <span className="truncate">{value ? dateLabel(value) : placeholder}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] rounded-xl border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            {API_MONITORING_DATE_OPTIONS.map((option) => (
              <Button key={option} type="button" variant={value === option ? "default" : "outline"} size="sm" className="h-9 px-2 text-[12px]" onClick={() => onValueChange(option)}>
                {dateLabel(option)}
              </Button>
            ))}
          </div>
          {value === "custom" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <SectionHint>From</SectionHint>
                <Input type="date" max={toDate || todayIso} value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} className="h-10" />
              </div>
              <div className="space-y-1">
                <SectionHint>To</SectionHint>
                <Input type="date" min={fromDate || undefined} max={todayIso} value={toDate} onChange={(event) => onToDateChange(event.target.value)} className="h-10" />
              </div>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownField>
  );
}

function SubtrackDropdown({
  placeholder,
  value,
  selected,
  onInputChange,
  onAdd,
  onRemove,
}: {
  placeholder: string;
  value: string;
  selected: number[];
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: number) => void;
}) {
  const summary = selected.length === 0 ? "No subtracks selected" : `${selected.length} selected`;
  const normalizedSummary = selected.length === 0 ? "" : summary;
  return (
    <DropdownField title="Subtracks" summary={normalizedSummary}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", selected.length > 0 && "border-primary/40 text-primary")}>
            <span className="truncate">{selected.length === 0 ? placeholder : summary}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={value}
              onChange={(event) => onInputChange(event.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAdd();
                }
              }}
              placeholder="Add subtrack number"
            />
            <Button type="button" variant="outline" onClick={onAdd}>Add</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.length === 0 ? null : selected.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onRemove(item)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {item}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownField>
  );
}
