import { useCallback, useEffect, useRef, useState } from "react";

type UseSessionTimeoutOptions = {
  onTimeout: () => void | Promise<void>;
  totalTimeMs?: number;
  warningTimeMs?: number;
};

export function useSessionTimeout({
  onTimeout,
  totalTimeMs = 15 * 60 * 1000,
  warningTimeMs = 40 * 1000,
}: UseSessionTimeoutOptions) {
  const warningSeconds = warningTimeMs / 1000;
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(warningSeconds);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    inactivityTimerRef.current = null;
    warningTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const logoutNow = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    setCountdown(warningSeconds);
    void onTimeout();
  }, [clearTimers, onTimeout, warningSeconds]);

  const openWarning = useCallback(() => {
    setShowWarning(true);
    setCountdown(warningSeconds);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, [warningSeconds]);

  const resetTimer = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    setCountdown(warningSeconds);

    warningTimerRef.current = setTimeout(openWarning, totalTimeMs - warningTimeMs);
    inactivityTimerRef.current = setTimeout(() => {
      void onTimeout();
    }, totalTimeMs);
  }, [clearTimers, onTimeout, openWarning, totalTimeMs, warningSeconds, warningTimeMs]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll"];
    const onActivity = () => resetTimer();

    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      clearTimers();
    };
  }, [clearTimers, resetTimer]);

  return {
    showWarning,
    countdown,
    resetTimer,
    logoutNow,
  };
}
