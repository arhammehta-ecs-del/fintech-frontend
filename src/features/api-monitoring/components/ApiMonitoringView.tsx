import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, CircleCheck, Filter, Minus, Plus, RefreshCw, Search, X, XCircle } from "lucide-react";
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
  API_MONITORING_RESPONSE_SORT_OPTIONS,
  API_MONITORING_TIME_OPTIONS,
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
  time: null,
  fromDate: "",
  toDate: "",
  fromTime: "",
  toTime: "",
  users: [],
  ips: [],
  urls: [],
  status: [],
  subtrack: [],
  responseSize: null,
  responseSizeSort: null,
});

const countFilters = (draft: ApiMonitoringAppliedFiltersDraft) =>
  (draft.date ? 1 : 0) +
  (draft.time ? 1 : 0) +
  draft.users.length +
  draft.ips.length +
  draft.urls.length +
  draft.status.length +
  draft.subtrack.length +
  (draft.responseSize ? 1 : 0) +
  (draft.responseSizeSort ? 1 : 0) +
  (draft.fromDate ? 1 : 0) +
  (draft.toDate ? 1 : 0) +
  (draft.fromTime ? 1 : 0) +
  (draft.toTime ? 1 : 0);

const dateLabel = (value: (typeof API_MONITORING_DATE_OPTIONS)[number]) =>
  value === "7days" ? "7 Days" : value === "15days" ? "15 Days" : value === "1month" ? "1 Month" : "Custom";

const timeLabel = (value: (typeof API_MONITORING_TIME_OPTIONS)[number]) =>
  value === "10min" ? "10 Min" : value === "1hours" ? "1 Hours" : value === "3hour" ? "3 Hour" : "Custom";

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
    filterMetadata,
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
    fetchFilterPanelData,
    todayIso,
  } = useApiMonitoring();
  const [selectedLog, setSelectedLog] = useState<ApiMonitoringLog | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<ApiMonitoringAppliedFiltersDraft>(buildEmptyDraft());
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const { refreshLabel, lastRefreshedAt, markRefreshed } = useRefreshTimestamp();

  const activeFilterCount = countFilters(appliedFilters);

  const syncDraft = () => {
    setDraft({
      ...appliedFilters,
      users: [...appliedFilters.users],
      ips: [...appliedFilters.ips],
      urls: [...appliedFilters.urls],
      status: [...appliedFilters.status],
      subtrack: [...appliedFilters.subtrack],
    });
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

  const setSubtrackValue = (value: number) => {
    const normalized = Math.max(1, Math.trunc(value || 1));
    setDraft((current) => ({ ...current, subtrack: [normalized] }));
  };

  const changeSubtrackValue = (delta: number) => {
    const currentValue = draft.subtrack[0] ?? 1;
    setSubtrackValue(currentValue + delta);
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

  const setFromTime = (value: string) => {
    setDraft((current) => ({
      ...current,
      fromTime: value,
      toTime: current.fromDate && current.toDate && current.fromDate === current.toDate && current.toTime && value > current.toTime
        ? value
        : current.toTime,
    }));
  };

  const setToTime = (value: string) => {
    setDraft((current) => ({
      ...current,
      toTime: value,
      fromTime: current.fromDate && current.toDate && current.fromDate === current.toDate && current.fromTime && value < current.fromTime
        ? value
        : current.fromTime,
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
                  if (nextOpen) {
                    void fetchFilterPanelData().then(() => {
                      markRefreshed();
                    });
                  }
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
                        onClear={() =>
                          setDraft((current) => ({
                            ...current,
                            date: null,
                            time: null,
                            fromDate: "",
                            toDate: "",
                            fromTime: "",
                            toTime: "",
                          }))
                        }
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
                      <TimeDropdown
                        value={draft.time}
                        fromTime={draft.fromTime}
                        toTime={draft.toTime}
                        onClear={() =>
                          setDraft((current) => ({
                            ...current,
                            time: null,
                            fromTime: "",
                            toTime: "",
                          }))
                        }
                        onValueChange={(option) =>
                          setDraft((current) => ({
                            ...current,
                            time: current.time === option ? null : option,
                            fromTime: option === "custom" ? current.fromTime : "",
                            toTime: option === "custom" ? current.toTime : "",
                          }))
                        }
                        onFromTimeChange={setFromTime}
                        onToTimeChange={setToTime}
                      />
                      <MultiSelectDropdown
                        title="User"
                        placeholder="Select user"
                        options={filterMetadata.users}
                        optionCount={filterMetadata.users.length}
                        selected={draft.users}
                        onClear={() => setDraft((current) => ({ ...current, users: [] }))}
                        onToggle={(value) =>
                          setDraft((current) => ({
                            ...current,
                            users: current.users.includes(value) ? current.users.filter((item) => item !== value) : [...current.users, value],
                          }))
                        }
                      />
                      <MultiSelectDropdown
                        title="IP Address"
                        placeholder="Select IP"
                        options={filterMetadata.ips}
                        optionCount={filterMetadata.ips.length}
                        selected={draft.ips}
                        onClear={() => setDraft((current) => ({ ...current, ips: [] }))}
                        onToggle={(value) =>
                          setDraft((current) => ({
                            ...current,
                            ips: current.ips.includes(value) ? current.ips.filter((item) => item !== value) : [...current.ips, value],
                          }))
                        }
                      />
                      <MultiSelectDropdown
                        title="API"
                        placeholder="Select API"
                        options={filterMetadata.urls}
                        optionCount={filterMetadata.urls.length}
                        contentClassName="max-h-[420px] overflow-y-auto"
                        selected={draft.urls}
                        onClear={() => setDraft((current) => ({ ...current, urls: [] }))}
                        onToggle={(value) =>
                          setDraft((current) => ({
                            ...current,
                            urls: current.urls.includes(value) ? current.urls.filter((item) => item !== value) : [...current.urls, value],
                          }))
                        }
                      />
                      <MultiSelectDropdown
                        title="Status"
                        placeholder="Select status"
                        options={filterMetadata.statusCodes.map((status) => ({
                          value: String(status.value),
                          label: status.label,
                          count: status.count,
                        }))}
                        optionCount={filterMetadata.statusCodes.length}
                        selected={draft.status.map(String)}
                        onClear={() => setDraft((current) => ({ ...current, status: [] }))}
                        onToggle={(value) => toggleStatus(Number(value))}
                      />
                      <SubtrackDropdown
                        value={draft.subtrack[0] ?? 1}
                        isActive={draft.subtrack.length > 0}
                        onChange={setSubtrackValue}
                        onIncrement={() => changeSubtrackValue(1)}
                        onDecrement={() => changeSubtrackValue(-1)}
                        onClear={() => setDraft((current) => ({ ...current, subtrack: [] }))}
                      />
                      <SingleSelectDropdown
                        title="Response Size"
                        placeholder="Select response size"
                        options={filterMetadata.responseSizeRanges.map((range) => ({
                          value: range.value,
                          label: range.label,
                          count: range.count,
                        }))}
                        optionCount={filterMetadata.responseSizeRanges.length}
                        value={draft.responseSize}
                        emptySummary=""
                        onClear={() => setDraft((current) => ({ ...current, responseSize: null }))}
                        onSelect={(value) => setDraft((current) => ({ ...current, responseSize: current.responseSize === value ? null : value as typeof current.responseSize }))}
                      />
                      <SingleSelectDropdown
                        title="Sort Response Size "
                        placeholder="Select flow"
                        options={API_MONITORING_RESPONSE_SORT_OPTIONS.map((sort) => ({ value: sort, label: sort === "asc" ? "Ascending" : "Descending" }))}
                        optionCount={API_MONITORING_RESPONSE_SORT_OPTIONS.length}
                        value={draft.responseSizeSort}
                        emptySummary=""
                        onClear={() => setDraft((current) => ({ ...current, responseSizeSort: null }))}
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

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {title}
      {typeof count === "number" ? ` (${count})` : ""}
    </p>
  );
}

function SectionHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

function DropdownField({
  title,
  optionCount,
  summary,
  canClear = false,
  onClear,
  children,
}: {
  title: string;
  optionCount?: number;
  summary: string;
  canClear?: boolean;
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel title={title} count={optionCount} />
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
  onClear,
  onSelect,
  optionCount,
  contentClassName,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string; count?: number }>;
  value: string | null;
  emptySummary?: string;
  onClear?: () => void;
  onSelect: (value: string) => void;
  optionCount?: number;
  contentClassName?: string;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;
  return (
    <DropdownField title={title} optionCount={optionCount} summary={value ? selectedLabel : emptySummary} canClear={Boolean(value)} onClear={onClear}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", value && "border-primary/40 text-primary")}>
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className={cn("min-w-[var(--radix-dropdown-menu-trigger-width)] w-fit max-w-[80vw] rounded-xl border border-slate-200 p-2", contentClassName)}
        >
          {options.map((option) => {
            const disabled = typeof option.count === "number" && option.count === 0;
            return (
            <DropdownMenuItem
              key={option.value}
              disabled={disabled}
              onSelect={() => {
                if (!disabled) onSelect(option.value);
              }}
              className={cn("rounded-md", !disabled && "cursor-pointer", disabled && "cursor-not-allowed opacity-50")}
            >
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 flex-1">{option.label}</span>
                {typeof option.count === "number" ? <span className="shrink-0 text-xs font-semibold text-sky-600">{option.count}</span> : null}
              </div>
            </DropdownMenuItem>
          )})}
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
  onClear,
  onToggle,
  optionCount,
  contentClassName,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string; count?: number }>;
  selected: string[];
  onClear?: () => void;
  onToggle: (value: string) => void;
  optionCount?: number;
  contentClassName?: string;
}) {
  const summary =
    selected.length === 0
      ? ""
      : selected.length === 1
        ? options.find((option) => option.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;
  return (
    <DropdownField title={title} optionCount={optionCount} summary={summary} canClear={selected.length > 0} onClear={onClear}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", selected.length > 0 && "border-primary/40 text-primary")}>
            <span className="truncate">{selected.length === 0 ? placeholder : summary}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className={cn("min-w-[var(--radix-dropdown-menu-trigger-width)] w-fit max-w-[80vw] rounded-xl border border-slate-200 p-2", contentClassName)}
        >
          {options.map((option) => {
            const disabled = typeof option.count === "number" && option.count === 0;
            return (
            <DropdownMenuCheckboxItem
              key={option.value}
              disabled={disabled}
              checked={selected.includes(option.value)}
              onCheckedChange={() => {
                if (!disabled) onToggle(option.value);
              }}
              onSelect={(event) => event.preventDefault()}
              className={cn("rounded-md", !disabled && "cursor-pointer", disabled && "cursor-not-allowed opacity-50")}
            >
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 flex-1">{option.label}</span>
                {typeof option.count === "number" ? <span className="shrink-0 text-xs font-semibold text-sky-600">{option.count}</span> : null}
              </div>
            </DropdownMenuCheckboxItem>
          )})}
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
  onClear,
  onValueChange,
  onFromDateChange,
  onToDateChange,
}: {
  value: (typeof API_MONITORING_DATE_OPTIONS)[number] | null;
  fromDate: string;
  toDate: string;
  placeholder: string;
  todayIso: string;
  onClear?: () => void;
  onValueChange: (value: (typeof API_MONITORING_DATE_OPTIONS)[number]) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
}) {
  const fromSummary = fromDate || "Start";
  const toSummary = toDate || "End";
  const summary =
    value === "custom"
      ? fromDate || toDate
        ? `${fromSummary} to ${toSummary}`
        : "Custom range"
      : value
        ? dateLabel(value)
        : "";
  return (
    <DropdownField title="Date" summary={summary} canClear={Boolean(value || fromDate || toDate)} onClear={onClear}>
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
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <SectionHint>From</SectionHint>
                <Input type="date" max={toDate || todayIso} value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} className="h-10" />
              </div>
              <div className="space-y-2">
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

function TimeDropdown({
  value,
  fromTime,
  toTime,
  onClear,
  onValueChange,
  onFromTimeChange,
  onToTimeChange,
}: {
  value: (typeof API_MONITORING_TIME_OPTIONS)[number] | null;
  fromTime: string;
  toTime: string;
  onClear?: () => void;
  onValueChange: (value: (typeof API_MONITORING_TIME_OPTIONS)[number]) => void;
  onFromTimeChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
}) {
  const summary =
    value === "custom"
      ? fromTime || toTime
        ? `${fromTime || "Start"} to ${toTime || "End"}`
        : "Custom time"
      : value
        ? timeLabel(value)
        : "";

  return (
    <DropdownField title="Time" optionCount={API_MONITORING_TIME_OPTIONS.length} summary={summary} canClear={Boolean(value || fromTime || toTime)} onClear={onClear}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-11 w-full justify-between rounded-xl border-slate-200 bg-white px-3.5 text-left text-[15px]", value && "border-primary/40 text-primary")}>
            <span className="truncate">{value ? timeLabel(value) : "Select time"}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] rounded-xl border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            {API_MONITORING_TIME_OPTIONS.map((option) => (
              <Button key={option} type="button" variant={value === option ? "default" : "outline"} size="sm" className="h-9 px-2 text-[12px]" onClick={() => onValueChange(option)}>
                {timeLabel(option)}
              </Button>
            ))}
          </div>
          {value === "custom" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <SectionHint>From</SectionHint>
                <Input type="time" value={fromTime} onChange={(event) => onFromTimeChange(event.target.value)} className="h-10" aria-label="From time" />
              </div>
              <div className="space-y-2">
                <SectionHint>To</SectionHint>
                <Input type="time" value={toTime} onChange={(event) => onToTimeChange(event.target.value)} className="h-10" aria-label="To time" />
              </div>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownField>
  );
}

function SubtrackDropdown({
  value,
  isActive,
  onChange,
  onIncrement,
  onDecrement,
  onClear,
}: {
  value: number;
  isActive: boolean;
  onChange: (value: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onClear?: () => void;
}) {
  const summary = isActive ? `Subtrack ${value}` : "";
  return (
    <DropdownField title="Subtracks" summary={summary} canClear={isActive} onClear={onClear}>
      <div className={cn("flex h-11 items-center rounded-xl border border-slate-200 bg-white", isActive && "border-primary/40 text-primary")}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDecrement}
          className="h-full w-11 rounded-l-xl rounded-r-none border-r border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          aria-label="Decrease subtrack"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          inputMode="numeric"
          value={String(value)}
          onChange={(event) => {
            const normalized = event.target.value.replace(/[^\d]/g, "");
            onChange(normalized ? Number(normalized) : 1);
          }}
          className="h-full flex-1 rounded-none border-0 text-center text-[15px] shadow-none focus-visible:ring-0"
          aria-label="Subtrack number"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onIncrement}
          className="h-full w-11 rounded-l-none rounded-r-xl border-l border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          aria-label="Increase subtrack"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </DropdownField>
  );
}
