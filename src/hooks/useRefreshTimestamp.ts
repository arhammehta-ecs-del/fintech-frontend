import { useCallback, useEffect, useMemo, useState } from "react";

type UseRefreshTimestampInput = {
  initializedAt?: number | null;
  tickMs?: number;
  minDisplayMinutes?: number;
  minDisplaySeconds?: number;
};

export function useRefreshTimestamp(input: UseRefreshTimestampInput = {}) {
  const { initializedAt = null, tickMs = 30_000, minDisplayMinutes = 1, minDisplaySeconds = 30 } = input;
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [refreshNowMs, setRefreshNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshNowMs(Date.now());
    }, tickMs);
    return () => window.clearInterval(intervalId);
  }, [tickMs]);

  useEffect(() => {
    if (!initializedAt) return;
    if (lastRefreshedAt) return;
    setLastRefreshedAt(initializedAt);
    setRefreshNowMs(initializedAt);
  }, [initializedAt, lastRefreshedAt]);

  const refreshMinutesAgo = useMemo(() => {
    if (!lastRefreshedAt) return 0;
    return Math.floor((refreshNowMs - lastRefreshedAt) / 60_000);
  }, [lastRefreshedAt, refreshNowMs]);

  const refreshSecondsAgo = useMemo(() => {
    if (!lastRefreshedAt) return 0;
    return Math.floor((refreshNowMs - lastRefreshedAt) / 1000);
  }, [lastRefreshedAt, refreshNowMs]);

  const refreshLabel = useMemo(() => {
    if (refreshSecondsAgo < minDisplaySeconds) return "";
    if (refreshSecondsAgo < 60) return `Refreshed ${refreshSecondsAgo} sec ago`;
    if (refreshMinutesAgo < minDisplayMinutes) return "";
    return `Refreshed ${refreshMinutesAgo} minute${refreshMinutesAgo === 1 ? "" : "s"} ago`;
  }, [minDisplayMinutes, minDisplaySeconds, refreshMinutesAgo, refreshSecondsAgo]);

  const markRefreshed = useCallback((at = Date.now()) => {
    setLastRefreshedAt(at);
    setRefreshNowMs(at);
  }, []);

  return {
    refreshLabel,
    lastRefreshedAt,
    markRefreshed,
  };
}
