import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, CircleCheck, Filter, RefreshCw, Search, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PaginationFooter from "@/components/PaginationFooter";
import { cn } from "@/lib/utils";
import { useApiMonitoring } from "@/features/api-monitoring/hooks/useApiMonitoring";
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
    statusFilters,
    setStatusFilters,
    companyCodeFilters,
    setCompanyCodeFilters,
    userEmailFilters,
    setUserEmailFilters,
    ipFilters,
    setIpFilters,
    apiUrlFilters,
    setApiUrlFilters,
    dateFilters,
    setDateFilters,
    clearFilters,
    statusOptions,
    companyCodeOptions,
    userEmailOptions,
    ipOptions,
    apiUrlOptions,
    dateOptions,
    page,
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
  } = useApiMonitoring();
  const [selectedLog, setSelectedLog] = useState<ApiMonitoringLog | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [draftStatusFilters, setDraftStatusFilters] = useState<string[]>(statusFilters);
  const [draftCompanyCodeFilters, setDraftCompanyCodeFilters] = useState<string[]>(companyCodeFilters);
  const [draftUserEmailFilters, setDraftUserEmailFilters] = useState<string[]>(userEmailFilters);
  const [draftIpFilters, setDraftIpFilters] = useState<string[]>(ipFilters);
  const [draftApiUrlFilters, setDraftApiUrlFilters] = useState<string[]>(apiUrlFilters);
  const [draftDateFilters, setDraftDateFilters] = useState<string[]>(dateFilters);
  const { refreshLabel, lastRefreshedAt, markRefreshed } = useRefreshTimestamp();

  const activeFilterCount = statusFilters.length + companyCodeFilters.length + userEmailFilters.length + ipFilters.length + apiUrlFilters.length + dateFilters.length;

  const toggleValue = (current: string[], value: string) => (
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
  );

  const syncDraftFilters = () => {
    setDraftStatusFilters(statusFilters);
    setDraftCompanyCodeFilters(companyCodeFilters);
    setDraftUserEmailFilters(userEmailFilters);
    setDraftIpFilters(ipFilters);
    setDraftApiUrlFilters(apiUrlFilters);
    setDraftDateFilters(dateFilters);
  };

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading API logs...";
    if (error) return error;
    if (searchText.trim()) return "No logs found for this search.";
    return "No API monitoring logs available.";
  }, [loading, error, searchText]);
  const cumulativeRecordCount = useMemo(
    () => Math.min(totalCount, Math.max(0, (safePage - 1) * pageSize) + paginatedLogs.length),
    [pageSize, paginatedLogs.length, safePage, totalCount],
  );

  useEffect(() => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [safePage]);

  useEffect(() => {
    if (loading || error) return;
    if (lastRefreshedAt) return;
    markRefreshed();
  }, [error, lastRefreshedAt, loading, markRefreshed]);

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-border px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">API Monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real-time traffic and latency tracking</p>
      </Card>

      <Card className="flex h-[760px] flex-col overflow-hidden border border-border shadow-sm">
        <div className="border-b border-border bg-muted/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative w-full lg:flex-1 lg:pr-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                }}
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
                  if (nextOpen) syncDraftFilters();
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
                <PopoverContent align="end" className="w-[520px] p-0">
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
                        onClick={() => {
                          clearFilters();
                          setDraftStatusFilters([]);
                          setDraftCompanyCodeFilters([]);
                          setDraftUserEmailFilters([]);
                          setDraftIpFilters([]);
                          setDraftApiUrlFilters([]);
                          setDraftDateFilters([]);
                        }}
                      >
                        Clear all
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[62vh] space-y-3.5 overflow-y-auto bg-white px-5 py-3.5">
                    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/45 p-3 shadow-[0_2px_8px_rgba(148,163,184,0.1)]">
                      <p className="border-b border-slate-200 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Identity
                      </p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <ApiFilterDropdown title="Status" placeholder="All statuses" options={statusOptions} selected={draftStatusFilters} onToggle={(value) => setDraftStatusFilters((current) => toggleValue(current, value))} />
                        <ApiFilterDropdown title="Company Code" placeholder="All company codes" options={companyCodeOptions} selected={draftCompanyCodeFilters} onToggle={(value) => setDraftCompanyCodeFilters((current) => toggleValue(current, value))} />
                        <ApiFilterDropdown title="User Email" placeholder="All user emails" options={userEmailOptions} selected={draftUserEmailFilters} onToggle={(value) => setDraftUserEmailFilters((current) => toggleValue(current, value))} />
                        <ApiFilterDropdown title="IP" placeholder="All IPs" options={ipOptions} selected={draftIpFilters} onToggle={(value) => setDraftIpFilters((current) => toggleValue(current, value))} />
                        <ApiFilterDropdown title="API URL" placeholder="All API URLs" options={apiUrlOptions} selected={draftApiUrlFilters} onToggle={(value) => setDraftApiUrlFilters((current) => toggleValue(current, value))} />
                        <ApiFilterDropdown title="Date" placeholder="All dates" options={dateOptions} selected={draftDateFilters} onToggle={(value) => setDraftDateFilters((current) => toggleValue(current, value))} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => {
                      setStatusFilters(draftStatusFilters);
                      setCompanyCodeFilters(draftCompanyCodeFilters);
                      setUserEmailFilters(draftUserEmailFilters);
                      setIpFilters(draftIpFilters);
                      setApiUrlFilters(draftApiUrlFilters);
                      setDateFilters(draftDateFilters);
                      setFiltersOpen(false);
                    }}>
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
                  <p className="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-muted-foreground">
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
                        return {
                          ...current,
                          id: details.mainRequest.id,
                          trackId: details.mainRequest.trackId,
                          method: details.mainRequest.method,
                          path: details.mainRequest.path,
                          status: details.mainRequest.status,
                          timeString: details.mainRequest.timeString,
                          timeStr: nextTime,
                          dateStr: nextDate,
                          subApis: [details.mainRequest, ...details.childSpans],
                        };
                      });
                    } catch {
                      // Keep table payload as fallback if details call fails.
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition hover:bg-muted/40"
                >
                  <td className="px-6 py-3 align-top">
                    <p className="text-sm font-medium text-foreground">{log.company.name}</p>
                    <span
                      className={cn("mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold")}
                      style={companyBadgeStyle(log.company.code)}
                    >
                      {log.company.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-medium text-foreground">{log.user.name}</p>
                    <p className="mt-0.5 text-[11px] text-sky-700">{log.user.email}</p>
                    {log.clientIp ? (
                      <p className="mt-0.5 text-[11px] text-amber-700">{log.clientIp}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex flex-col leading-tight">
                      <span>{log.timeStr || "-"}</span>
                      <span className="mt-1 text-xs text-slate-500">{log.dateStr || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="max-w-[280px] truncate font-mono text-sm text-foreground">{log.path}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                      {log.spanCount} sub-tracks
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-start">
                      {getStatusIcon(log.status)}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredLogs.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          currentCount={Math.max(totalCount, filteredLogs.length)}
          recordCurrentCount={cumulativeRecordCount}
          recordTotalCount={totalCount}
          recordLabel="Records"
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={(value) => setPageSize(value as (typeof pageSizeOptions)[number])}
          safePage={safePage}
          totalPages={totalPages}
          onPrevPage={() => void handlePrevPage()}
          onNextPage={() => void handleNextPage()}
          onJumpToPage={(value) => void handleJumpToPage(value)}
        />
      </Card>

      <ApiMonitoringDetailsDialog log={selectedLog} open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)} />
    </div>
  );
}

function ApiFilterDropdown({
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
  const summaryLabel = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const normalized = searchTerm.trim().toLowerCase();
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(normalized));

  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-600">{title}</p>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSearchTerm("");
            setIsSearchExpanded(false);
          }
          setOpen(nextOpen);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-left text-[15px] text-slate-700 shadow-sm hover:border-slate-300"
          >
            <span className="truncate">{summaryLabel}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border border-slate-200 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
            <button
              type="button"
              onClick={() => {
                if (isSearchExpanded) {
                  setSearchTerm("");
                  setIsSearchExpanded(false);
                  return;
                }
                setIsSearchExpanded(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-700"
              aria-label={isSearchExpanded ? `Close ${title.toLowerCase()} search` : `Open ${title.toLowerCase()} search`}
            >
              {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          <div className={cn("overflow-hidden transition-all duration-200", isSearchExpanded ? "mb-2 max-h-12 opacity-100" : "max-h-0 opacity-0")}>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="h-9"
              autoFocus={isSearchExpanded}
            />
          </div>
          <div className="max-h-52 overflow-auto px-1 pb-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No options</div>
            ) : filteredOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={selected.includes(option)}
                onCheckedChange={() => onToggle(option)}
                className="cursor-pointer rounded-md"
              >
                {option}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
