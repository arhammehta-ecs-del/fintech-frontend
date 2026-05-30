import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiMonitoringDetailsData, ApiMonitoringLog } from "@/features/api-monitoring/types";
import { getApiErrorMessage } from "@/services/client";
import { fetchApiMonitoringDetails, fetchApiMonitoringListPaginated } from "@/services/api-monitoring.service";

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

export function useApiMonitoring() {
  const PAGE_SIZE_OPTIONS = [15, 25, 35, 50] as const;
  const SEARCH_DEBOUNCE_MS = 500;
  const [logs, setLogs] = useState<ApiMonitoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [companyCodeFilters, setCompanyCodeFilters] = useState<string[]>([]);
  const [userEmailFilters, setUserEmailFilters] = useState<string[]>([]);
  const [ipFilters, setIpFilters] = useState<string[]>([]);
  const [apiUrlFilters, setApiUrlFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [topCursor, setTopCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });

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

  const fetchPage = useCallback(
    async (
      params: {
        cursor: string | null;
        topCursor: string | null;
        page: number | null;
        direction: "NEXT" | "PREV";
        targetPage: number;
      },
      showLoader = false,
    ) => {
      if (showLoader) setLoading(true);
      try {
        setError(null);
        const response = await fetchApiMonitoringListPaginated({
          limit: pageSize,
          cursor: params.cursor,
          topCursor: params.topCursor,
          page: params.page,
          direction: params.direction,
          query: debouncedSearchText || null,
        });

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
      } catch (err) {
        setLogs([]);
        setTotalCount(0);
        setResolvedTotalPages(1);
        setError(getApiErrorMessage(err, "Unable to load API monitoring logs"));
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [debouncedSearchText, pageSize],
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
        },
        showLoader,
      );
    },
    [fetchPage],
  );

  useEffect(() => {
    void loadFirstPage(true);
  }, [loadFirstPage]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => values.add(String(log.status ?? "NA")));
    return Array.from(values);
  }, [logs]);

  const companyCodeOptions = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => {
      if (log.company.code && log.company.code !== "N/A") values.add(log.company.code);
    });
    return Array.from(values).sort();
  }, [logs]);

  const userEmailOptions = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => {
      if (log.user.email && log.user.email !== "N/A") values.add(log.user.email);
    });
    return Array.from(values).sort();
  }, [logs]);

  const ipOptions = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => {
      if (log.clientIp) values.add(log.clientIp);
    });
    return Array.from(values).sort();
  }, [logs]);

  const apiUrlOptions = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => {
      if (log.path && log.path !== "-") values.add(log.path);
    });
    return Array.from(values).sort();
  }, [logs]);

  const dateOptions = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => {
      if (log.dateStr && log.dateStr !== "-") values.add(log.dateStr);
    });
    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logStatus = String(log.status ?? "NA");
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(logStatus);
      const matchesCompanyCode = companyCodeFilters.length === 0 || companyCodeFilters.includes(log.company.code);
      const matchesUserEmail = userEmailFilters.length === 0 || userEmailFilters.includes(log.user.email);
      const matchesIp = ipFilters.length === 0 || ipFilters.includes(log.clientIp || "");
      const matchesApiUrl = apiUrlFilters.length === 0 || apiUrlFilters.includes(log.path);
      const matchesDate = dateFilters.length === 0 || dateFilters.includes(log.dateStr);

      if (!(matchesStatus && matchesCompanyCode && matchesUserEmail && matchesIp && matchesApiUrl && matchesDate)) {
        return false;
      }
      return true;
    });
  }, [logs, statusFilters, companyCodeFilters, userEmailFilters, ipFilters, apiUrlFilters, dateFilters]);

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

  const applySearch = () => {
    const normalized = searchInput.trim();
    setSearchText(normalized);
    setDebouncedSearchText(normalized);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchText("");
    setDebouncedSearchText("");
  };

  const clearFilters = () => {
    setStatusFilters([]);
    setCompanyCodeFilters([]);
    setUserEmailFilters([]);
    setIpFilters([]);
    setApiUrlFilters([]);
    setDateFilters([]);
  };

  const totalPages = Math.max(1, resolvedTotalPages);
  const safePage = page;
  const paginatedLogs = filteredLogs;

  const handlePrevPage = useCallback(async () => {
    if (page <= 1) return;
    const previousPage = page - 1;
    const prevCursor = pageCursors[previousPage] ?? null;
    await fetchPage(
      {
        cursor: prevCursor,
        topCursor,
        page: null,
        direction: "PREV",
        targetPage: previousPage,
      },
      true,
    );
  }, [fetchPage, page, pageCursors, topCursor]);

  const handleNextPage = useCallback(async () => {
    if (!hasNext) return;
    const upcomingPage = page + 1;
    const cursor = pageCursors[upcomingPage] ?? nextCursor;
    if (!cursor) return;

    await fetchPage(
      {
        cursor,
        topCursor,
        page: null,
        direction: "NEXT",
        targetPage: upcomingPage,
      },
      true,
    );
  }, [fetchPage, hasNext, nextCursor, page, pageCursors, topCursor]);

  const handleJumpToPage = useCallback(
    async (requestedPage: number) => {
      const targetPage = Math.max(1, Math.min(totalPages, requestedPage));
      if (targetPage === page) return;

      const direction: "NEXT" | "PREV" = targetPage > page ? "NEXT" : "PREV";
      const jumpCursor = pageCursors[targetPage] ?? (direction === "NEXT" ? nextCursor : topCursor) ?? null;
      await fetchPage(
        {
          cursor: jumpCursor,
          topCursor,
          page: targetPage,
          direction,
          targetPage,
        },
        true,
      );
    },
    [fetchPage, nextCursor, page, pageCursors, topCursor, totalPages],
  );

  const fetchDetailsForTrack = async (trackId: string): Promise<ApiMonitoringDetailsData> => {
    return fetchApiMonitoringDetails(trackId);
  };

  const refreshLogs = useCallback(async () => {
    await loadFirstPage(true);
  }, [loadFirstPage]);

  return {
    logs,
    filteredLogs,
    paginatedLogs,
    loading,
    error,
    searchInput,
    setSearchInput,
    searchText,
    setSearchText,
    applySearch,
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
  };
}
