import { useEffect, useState } from "react";

const EVENT_NAME = "notifications-panel-open-change";
const DATA_KEY = "notificationsPanelOpen";

const readOpenState = () => {
  if (typeof document === "undefined") return false;
  return document.body.dataset[DATA_KEY] === "true";
};

export function useNotificationsPanelOpen() {
  const [isOpen, setIsOpen] = useState<boolean>(() => readOpenState());

  useEffect(() => {
    const handleChange = () => setIsOpen(readOpenState());
    handleChange();
    window.addEventListener(EVENT_NAME, handleChange as EventListener);
    return () => window.removeEventListener(EVENT_NAME, handleChange as EventListener);
  }, []);

  return isOpen;
}

export const setNotificationsPanelOpenFlag = (open: boolean) => {
  if (typeof document === "undefined") return;
  document.body.dataset[DATA_KEY] = open ? "true" : "false";
  window.dispatchEvent(new Event(EVENT_NAME));
};

