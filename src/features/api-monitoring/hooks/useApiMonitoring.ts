import { useEffect, useMemo, useState } from "react";
import type { ApiMonitoringDetailsData, ApiMonitoringLog } from "@/features/api-monitoring/types";
import { getApiErrorMessage } from "@/services/client";
import { fetchApiMonitoringDetails, fetchApiMonitoringList } from "@/services/api-monitoring.service";

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
  const [logs, setLogs] = useState<ApiMonitoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [companyCodeFilters, setCompanyCodeFilters] = useState<string[]>([]);
  const [userEmailFilters, setUserEmailFilters] = useState<string[]>([]);
  const [ipFilters, setIpFilters] = useState<string[]>([]);
  const [apiUrlFilters, setApiUrlFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchApiMonitoringList();
        if (!mounted) return;
        setLogs(data);
      } catch (err) {
        if (!mounted) return;
        setError(getApiErrorMessage(err, "Unable to load API monitoring logs"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

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
    const q = normalize(searchText);
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

      if (!q) return true;

      const searchable = [
        log.path,
        log.trackId,
        log.company.name,
        log.company.code,
        log.user.name,
        log.user.email,
        log.clientIp || "",
        log.dateStr,
        log.timeStr,
        log.timeString,
        String(log.status ?? ""),
      ];

      return searchable.some((item) => fuzzyMatch(item || "", q));
    });
  }, [logs, searchText, statusFilters, companyCodeFilters, userEmailFilters, ipFilters, apiUrlFilters, dateFilters]);

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
    setSearchText(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchText("");
  };

  const clearFilters = () => {
    setStatusFilters([]);
    setCompanyCodeFilters([]);
    setUserEmailFilters([]);
    setIpFilters([]);
    setApiUrlFilters([]);
    setDateFilters([]);
  };

  useEffect(() => {
    setPage(1);
  }, [searchText, statusFilters, companyCodeFilters, userEmailFilters, ipFilters, apiUrlFilters, dateFilters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safePage, pageSize]);

  const fetchDetailsForTrack = async (trackId: string): Promise<ApiMonitoringDetailsData> => {
    return fetchApiMonitoringDetails(trackId);
  };

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
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    fetchDetailsForTrack,
  };
}
