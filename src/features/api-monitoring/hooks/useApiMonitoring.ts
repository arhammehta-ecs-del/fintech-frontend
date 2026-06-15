import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiMonitoringDetailsData, ApiMonitoringLog } from "@/features/api-monitoring/types";
import { getApiErrorMessage } from "@/services/client";
import { useToast } from "@/hooks/use-toast";
import {
  fetchApiMonitoringDetails,
  fetchApiMonitoringListPaginated,
  type ApiMonitoringFilterMetadata,
  type ApiMonitoringPaginatedRequest,
} from "@/services/api-monitoring.service";

const PAGE_SIZE_OPTIONS = [15, 25, 35, 50] as const;
const SEARCH_DEBOUNCE_MS = 500;
export const API_MONITORING_DATE_OPTIONS = ["7days", "15days", "1month", "custom"] as const;
export const API_MONITORING_RESPONSE_SORT_OPTIONS = ["asc", "desc"] as const;
export const API_MONITORING_TIME_OPTIONS = ["10min", "1hours", "3hour", "custom"] as const;

const normalize = (value: string) => value.trim().toLowerCase();

const fuzzyMatch = (text: string, query: string) => {
  const source = normalize(text).replace(/\s+/g, "");
  const target = normalize(query).replace(/\s+/g, "");
  if (!target) return true;
  if (source.includes(target)) return true;

  let index = 0;
  for (const ch of source) {
    if (ch === target[index]) index += 1;
    if (index === target.length) return true;
  }
  return false;
};

const todayIso = () => {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type DateFilterValue = (typeof API_MONITORING_DATE_OPTIONS)[number] | null;
type TimeFilterValue = (typeof API_MONITORING_TIME_OPTIONS)[number] | null;
type ResponseSizeRange = string | null;
type ResponseSizeSort = (typeof API_MONITORING_RESPONSE_SORT_OPTIONS)[number] | null;

export type ApiMonitoringAppliedFiltersDraft = {
  date: DateFilterValue;
  time: TimeFilterValue;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  companies: string[];
  users: string[];
  ips: string[];
  urls: string[];
  status: number[];
  subtrack: number[];
  responseSize: ResponseSizeRange;
  responseSizeSort: ResponseSizeSort;
};

const EMPTY_FILTER_METADATA: ApiMonitoringFilterMetadata = {
  companies: [],
  users: [],
  ips: [],
  urls: [],
  statusCodes: [],
  responseSizeRanges: [],
};

const buildEmptyDraft = (): ApiMonitoringAppliedFiltersDraft => ({
  date: null,
  time: null,
  fromDate: "",
  toDate: "",
  fromTime: "",
  toTime: "",
  companies: [],
  users: [],
  ips: [],
  urls: [],
  status: [],
  subtrack: [],
  responseSize: null,
  responseSizeSort: null,
});

const hasFiltersApplied = (draft: ApiMonitoringAppliedFiltersDraft) =>
  Boolean(
    draft.date ||
    draft.time ||
    draft.fromDate ||
    draft.toDate ||
    draft.fromTime ||
    draft.toTime ||
    draft.companies.length > 0 ||
    draft.users.length > 0 ||
    draft.ips.length > 0 ||
    draft.urls.length > 0 ||
    draft.status.length > 0 ||
    draft.subtrack.length > 0 ||
    draft.responseSize ||
    draft.responseSizeSort,
  );

const toResponseSizeByteRange = (value: ResponseSizeRange): string | null => {
  if (!value) return null;
  const [minRaw, maxRaw] = value.split("-").map((part) => Number(part.trim()));
  if (!Number.isFinite(minRaw) || !Number.isFinite(maxRaw)) return null;
  return `${minRaw * 1024} - ${maxRaw * 1024}`;
};

const toApiDateRange = (value: DateFilterValue): "7days" | "15days" | "1month" | "custom" | null => {
  if (value === "7days") return "7days";
  if (value === "15days") return "15days";
  if (value === "1month") return "1month";
  if (value === "custom") return "custom";
  return null;
};

const shiftIsoDate = (dateValue: string, offsetDays: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveDatePresetRange = (value: DateFilterValue, today: string): { fromDate: string; toDate: string; dateMode: "custom" | "7day" | "15day" | "1month" | null } => {
  if (value === "7days") return { fromDate: shiftIsoDate(today, -6), toDate: today, dateMode: "7day" };
  if (value === "15days") return { fromDate: shiftIsoDate(today, -14), toDate: today, dateMode: "15day" };
  if (value === "1month") return { fromDate: shiftIsoDate(today, -29), toDate: today, dateMode: "1month" };
  return { fromDate: "", toDate: "", dateMode: value === "custom" ? "custom" : null };
};

const buildDateTimeValue = (date: string, time: string, fallback: "start" | "end"): string | null => {
  if (!date) return null;
  const normalizedTime = time || (fallback === "start" ? "00:00" : "23:59");
  return `${date} ${normalizedTime}:00`;
};

const formatDateToIso = (date: Date) => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeToHourMinute = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const buildAppliedRequest = (draft: ApiMonitoringAppliedFiltersDraft): ApiMonitoringPaginatedRequest["applied"] => {
  if (!hasFiltersApplied(draft)) return null;

  const today = todayIso();
  const datePresetRange = resolveDatePresetRange(draft.date, today);
  let resolvedDate = toApiDateRange(draft.date);
  let resolvedFromDate = draft.date === "custom" ? draft.fromDate : datePresetRange.fromDate;
  let resolvedToDate = draft.date === "custom" ? draft.toDate : datePresetRange.toDate;
  let formDate: string | null = draft.date === "custom" ? buildDateTimeValue(draft.fromDate, draft.fromTime, "start") : null;
  let toDate: string | null = draft.date === "custom" ? buildDateTimeValue(draft.toDate, draft.toTime, "end") : null;

  if (draft.time === "10min" || draft.time === "1hours" || draft.time === "3hour") {
    const now = new Date();
    const start = new Date(now);
    if (draft.time === "10min") start.setMinutes(start.getMinutes() - 10);
    if (draft.time === "1hours") start.setHours(start.getHours() - 1);
    if (draft.time === "3hour") start.setHours(start.getHours() - 3);

    resolvedDate = "custom";
    resolvedFromDate = formatDateToIso(start);
    resolvedToDate = formatDateToIso(now);
    formDate = buildDateTimeValue(resolvedFromDate, formatTimeToHourMinute(start), "start");
    toDate = buildDateTimeValue(resolvedToDate, formatTimeToHourMinute(now), "end");
  } else if (draft.time === "custom") {
    const effectiveFromDate = resolvedFromDate || today;
    const effectiveToDate = resolvedToDate || effectiveFromDate;
    resolvedDate = "custom";
    formDate = buildDateTimeValue(effectiveFromDate, draft.fromTime, "start");
    toDate = buildDateTimeValue(effectiveToDate, draft.toTime, "end");
  }

  return {
    date: resolvedDate,
    formDate,
    toDate,
    companies: draft.companies.length > 0 ? draft.companies : null,
    users: draft.users.length > 0 ? draft.users : null,
    ips: draft.ips.length > 0 ? draft.ips : null,
    urls: draft.urls.length > 0 ? draft.urls : null,
    status: draft.status.length > 0 ? draft.status : null,
    responseSize: toResponseSizeByteRange(draft.responseSize),
    responseSizeSort: draft.responseSizeSort,
    subtrack: draft.subtrack.length > 0 ? draft.subtrack : null,
  };
};

export function useApiMonitoring() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ApiMonitoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [topCursor, setTopCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });
  const [appliedFilters, setAppliedFilters] = useState<ApiMonitoringAppliedFiltersDraft>(buildEmptyDraft());
  const [isFilterRequestActive, setIsFilterRequestActive] = useState(false);
  const [filterMetadata, setFilterMetadata] = useState<ApiMonitoringFilterMetadata>(EMPTY_FILTER_METADATA);

  useEffect(() => {
    const trimmedSearch = searchInput.trim();
    if (!trimmedSearch) {
      setSearchText("");
      setDebouncedSearchText("");
      return;
    }

    setSearchText(trimmedSearch);
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(trimmedSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const requestApplied = useMemo(() => buildAppliedRequest(appliedFilters), [appliedFilters]);

  const fetchPage = useCallback(
    async (
      params: {
        cursor: string | null;
        topCursor: string | null;
        page: number | null;
        direction: "NEXT" | "PREV";
        targetPage: number;
        filterOverride?: boolean;
        softFilterOverride?: boolean;
        appliedOverride?: ApiMonitoringPaginatedRequest["applied"];
        preserveListState?: boolean;
      },
      showLoader = false,
    ) => {
      const shouldPreserveListState = Boolean(params.preserveListState);
      if (showLoader && !shouldPreserveListState) setLoading(true);
      try {
        setError(null);
        const response = await fetchApiMonitoringListPaginated({
          limit: pageSize,
          cursor: params.cursor,
          topCursor: params.topCursor,
          page: params.page,
          direction: params.direction,
          query: debouncedSearchText || null,
          filter: params.filterOverride ?? isFilterRequestActive,
          softFilter: params.softFilterOverride ?? false,
          applied: params.appliedOverride ?? requestApplied,
        });

        setFilterMetadata(response.filterMetadata);
        if (!shouldPreserveListState) {
          setLogs(response.logs);
          setPage(params.targetPage);
          setTotalCount(response.totalCount);
          setTopCursor(response.pageInfo.topCursor || params.topCursor || null);
          setNextCursor(response.pageInfo.nextCursor);
          setHasNext(response.pageInfo.hasNext);
          setPageCursors((current) => ({
            ...current,
            [params.targetPage]: params.cursor,
            [params.targetPage + 1]: response.pageInfo.nextCursor,
          }));
          const fallbackTotalPages = Math.max(1, Math.ceil((response.totalCount || response.logs.length) / pageSize));
          setResolvedTotalPages(Math.max(response.pageInfo.totalPages || 0, fallbackTotalPages));
        }
      } catch (err) {
        setFilterMetadata(EMPTY_FILTER_METADATA);
        const errorMessage = getApiErrorMessage(err, "Unable to load API monitoring logs");
        toast({
          title: "Error fetching logs",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        if (showLoader && !shouldPreserveListState) setLoading(false);
      }
    },
    [debouncedSearchText, isFilterRequestActive, pageSize, requestApplied],
  );

  const loadFirstPage = useCallback(
    async (showLoader = false) => {
      setPageCursors({ 1: null });
      setTopCursor(null);
      setNextCursor(null);
      setHasNext(false);
      await fetchPage(
        {
          cursor: null,
          topCursor: null,
          page: null,
        direction: "NEXT",
        targetPage: 1,
        softFilterOverride: false,
      },
      showLoader,
      );
    },
    [fetchPage],
  );

  useEffect(() => {
    void loadFirstPage(true);
  }, [loadFirstPage]);

  const suggestions = useMemo(() => {
    const q = normalize(searchInput);
    if (!q) return [];

    const values = new Set<string>();
    logs.forEach((log) => {
      [
        log.trackId,
        log.path,
        log.company.name,
        log.company.code,
        log.user.name,
        log.user.email,
        log.clientIp || "",
        log.dateStr,
        log.timeStr,
      ].forEach((field) => {
        if (field && fuzzyMatch(field, q)) values.add(field);
      });
    });

    return Array.from(values).slice(0, 8);
  }, [logs, searchInput]);

  const clearSearch = () => {
    setSearchInput("");
    setSearchText("");
    setDebouncedSearchText("");
  };

  const clearFilters = useCallback(() => {
    setAppliedFilters(buildEmptyDraft());
    setIsFilterRequestActive(false);
    setPage(1);
    setPageCursors({ 1: null });
    setTopCursor(null);
    setNextCursor(null);
    setHasNext(false);
  }, []);

  const applyFilters = useCallback((draft: ApiMonitoringAppliedFiltersDraft) => {
    setAppliedFilters(draft);
    setIsFilterRequestActive(hasFiltersApplied(draft));
    setPage(1);
    setPageCursors({ 1: null });
    setTopCursor(null);
    setNextCursor(null);
    setHasNext(false);
  }, []);

  const totalPages = Math.max(1, resolvedTotalPages);
  const safePage = page;
  const paginatedLogs = logs;

  const handlePrevPage = useCallback(async () => {
    if (page <= 1) return;
    const previousPage = page - 1;
    const prevCursor = pageCursors[previousPage] ?? null;
    await fetchPage({ cursor: prevCursor, topCursor, page: null, direction: "PREV", targetPage: previousPage }, true);
  }, [fetchPage, page, pageCursors, topCursor]);

  const handleNextPage = useCallback(async () => {
    if (!hasNext) return;
    const upcomingPage = page + 1;
    const cursor = pageCursors[upcomingPage] ?? nextCursor;
    if (!cursor) return;
    await fetchPage({ cursor, topCursor, page: null, direction: "NEXT", targetPage: upcomingPage }, true);
  }, [fetchPage, hasNext, nextCursor, page, pageCursors, topCursor]);

  const handleJumpToPage = useCallback(async (requestedPage: number) => {
    const targetPage = Math.max(1, Math.min(totalPages, requestedPage));
    if (targetPage === page) return;
    const direction: "NEXT" | "PREV" = targetPage > page ? "NEXT" : "PREV";
    const jumpCursor = pageCursors[targetPage] ?? (direction === "NEXT" ? nextCursor : topCursor) ?? null;
    await fetchPage({ cursor: jumpCursor, topCursor, page: targetPage, direction, targetPage }, true);
  }, [fetchPage, nextCursor, page, pageCursors, topCursor, totalPages]);

  const fetchDetailsForTrack = async (trackId: string): Promise<ApiMonitoringDetailsData> => fetchApiMonitoringDetails(trackId);
  const refreshLogs = useCallback(async () => {
    await loadFirstPage(true);
  }, [loadFirstPage]);

  const fetchFilterPanelData = useCallback(async () => {
    await fetchPage(
      {
        cursor: null,
        topCursor: null,
        page: null,
        direction: "NEXT",
        targetPage: 1,
        filterOverride: false,
        softFilterOverride: true,
        appliedOverride: requestApplied,
        preserveListState: true,
      },
      false,
    );
  }, [fetchPage, requestApplied]);

  return {
    logs,
    filteredLogs: logs,
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
    isFilterRequestActive,
    page,
    setPage,
    pageSize,
    setPageSize,
    safePage,
    totalPages,
    totalCount,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
    fetchDetailsForTrack,
    refreshLogs,
    fetchFilterPanelData,
    filterMetadata,
    todayIso: todayIso(),
  };
}
