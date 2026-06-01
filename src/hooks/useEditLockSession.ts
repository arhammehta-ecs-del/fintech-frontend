import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { acquireEditLock, releaseEditLock, type EditLockPayload } from "@/services/edit-lock.service";

type LockTarget = Omit<EditLockPayload, "subtype" | "addMin">;

const LOCK_WINDOW_MS = 10 * 60 * 1000;
const WARNING_WINDOW_MS = 30 * 1000;

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const readBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const readString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const ensureLockAcquired = (response: unknown) => {
  const root = toRecord(response);
  const data = toRecord(root.data);
  const lockAcquired = readBoolean(root.lockAcquired) ?? readBoolean(data.lockAcquired);
  if (lockAcquired === false) {
    const message = readString(root.message) || readString(data.message) || "Unable to acquire edit lock.";
    throw new Error(message);
  }
};

export function useEditLockSession() {
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const targetRef = useRef<LockTarget | null>(null);
  const onTimeoutRef = useRef<(() => void) | null>(null);
  const sessionActiveRef = useRef(false);
  const lastActivityMsRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stopTicker = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const touchActivity = useCallback(() => {
    if (!sessionActiveRef.current) return;
    // When warning modal is visible, only explicit modal actions
    // ("Continue Editing" / "Close Form") should decide the flow.
    if (warningOpen) return;
    lastActivityMsRef.current = Date.now();
  }, [warningOpen]);

  const stopSession = useCallback(
    async (shouldRelease = true) => {
      stopTicker();
      const target = targetRef.current;
      targetRef.current = null;
      onTimeoutRef.current = null;
      sessionActiveRef.current = false;
      setWarningOpen(false);
      if (!shouldRelease || !target) return;
      try {
        await releaseEditLock(target);
      } catch {
        // no-op: release failures should not block UI closure
      }
    },
    [stopTicker],
  );

  const startTicker = useCallback(() => {
    stopTicker();
    timerRef.current = window.setInterval(async () => {
      if (!sessionActiveRef.current) return;
      const elapsed = Date.now() - lastActivityMsRef.current;
      const remaining = Math.max(0, LOCK_WINDOW_MS - elapsed);
      if (remaining <= WARNING_WINDOW_MS && remaining > 0) {
        setSecondsRemaining(Math.ceil(remaining / 1000));
        setWarningOpen(true);
        return;
      }
      if (remaining > WARNING_WINDOW_MS) {
        if (warningOpen) setWarningOpen(false);
        return;
      }
      setWarningOpen(false);
      await stopSession(true);
      onTimeoutRef.current?.();
    }, 1000);
  }, [stopSession, stopTicker, warningOpen]);

  const startSession = useCallback(
    async (target: LockTarget, onTimeout: () => void) => {
      const response = await acquireEditLock({
        ...target,
        subtype: "lock",
        addMin: 10,
      } as EditLockPayload);
      ensureLockAcquired(response);
      targetRef.current = target;
      onTimeoutRef.current = onTimeout;
      sessionActiveRef.current = true;
      lastActivityMsRef.current = Date.now();
      setSecondsRemaining(30);
      setWarningOpen(false);
      startTicker();
    },
    [startTicker],
  );

  const continueEditing = useCallback(async () => {
    const target = targetRef.current;
    if (!target || !sessionActiveRef.current) return;
    const response = await acquireEditLock({
      ...target,
      subtype: "lock",
      addMin: 10,
    } as EditLockPayload);
    ensureLockAcquired(response);
    lastActivityMsRef.current = Date.now();
    setWarningOpen(false);
    setSecondsRemaining(30);
  }, []);

  const endEditingNow = useCallback(async () => {
    await stopSession(true);
    onTimeoutRef.current?.();
  }, [stopSession]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "mousedown", "touchstart", "wheel"];
    const handler = () => touchActivity();
    events.forEach((eventName) => window.addEventListener(eventName, handler, { passive: true }));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler));
      stopTicker();
    };
  }, [stopTicker, touchActivity]);

  const isActive = useMemo(() => sessionActiveRef.current, [warningOpen, secondsRemaining]);

  return {
    warningOpen,
    secondsRemaining,
    isActive,
    startSession,
    stopSession,
    continueEditing,
    endEditingNow,
    touchActivity,
  };
}
