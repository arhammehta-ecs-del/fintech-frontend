import { useEffect, useMemo, useState } from "react";
import type { ApiMonitoringLog, ApiMonitoringStep } from "@/features/api-monitoring/types";
import { getApiErrorMessage } from "@/services/client";
import { fetchApiMonitoringDetails, fetchApiMonitoringList } from "@/services/api-monitoring.service";

export function useApiMonitoring() {
  const [logs, setLogs] = useState<ApiMonitoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

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

  const filteredLogs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return logs;

    return logs.filter((log) => (
      log.path.toLowerCase().includes(q)
      || log.company.name.toLowerCase().includes(q)
      || log.company.code.toLowerCase().includes(q)
      || log.user.name.toLowerCase().includes(q)
    ));
  }, [logs, searchText]);

  const fetchDetailsForTrack = async (trackId: string): Promise<ApiMonitoringStep[]> => {
    return fetchApiMonitoringDetails(trackId);
  };

  return {
    logs,
    filteredLogs,
    loading,
    error,
    searchText,
    setSearchText,
    fetchDetailsForTrack,
  };
}
