import { apiFetch, buildApiUrl } from "@/services/client";

const NOTIFICATION_SSE_PATH = "/api/v1/notifications/sse";
const NOTIFICATION_READ_PATH = "/api/v1/notifications/read";
const NOTIFICATION_FETCH_PATH = "/api/v1/notifications/fetch";

export type NotificationSseType = "INITIATE" | "APPROVE" | "REJECT";
export type NotificationSseRefType = "USER" | "WORKFLOW" | "ORG" | "COMPANYLIST";
export type NotificationSseStatus = "UNREAD" | "READ";

export type NotificationSsePacket = {
  id?: string;
  name?: string;
  message?: string;
  type?: string;
  refType?: string;
  status?: string;
  createdByname?: string;
  createdByemail?: string;
  createat_timestamp?: string;
};

type NotificationReadRequest = {
  id: string;
  status: "READ";
};

type NotificationReadResponse = {
  message?: string;
};

export type NotificationFetchStatus = "UNREAD" | "READ" | "ALL";

export type NotificationFetchRequest = {
  status: NotificationFetchStatus;
  limit: number;
  offset: number;
};

type NotificationFetchResponse = {
  data?: NotificationSsePacket[];
  count?: number;
  limit?: number;
  offset?: number;
  status?: string;
  cursorId?: string | null;
  nextCursorId?: string | null;
  hasNextPage?: boolean;
};

type NotificationSseCallbacks = {
  onNotification: (packet: NotificationSsePacket) => void;
  onError?: (error: Event) => void;
};

export function connectNotificationStream(callbacks: NotificationSseCallbacks) {
  const source = new EventSource(buildApiUrl(NOTIFICATION_SSE_PATH), {
    withCredentials: true,
  });

  const handleIncomingPacket = (event: Event) => {
    const messageEvent = event as MessageEvent<string>;
    try {
      const payload = JSON.parse(messageEvent.data) as NotificationSsePacket;
      callbacks.onNotification(payload);
    } catch {
      // Ignore malformed packets and continue stream.
    }
  };

  source.addEventListener("notification", handleIncomingPacket);
  source.onmessage = handleIncomingPacket;

  source.onerror = (error) => {
    callbacks.onError?.(error);
  };

  return () => {
    source.close();
  };
}

export async function updateNotificationReadStatus(payload: NotificationReadRequest) {
  return apiFetch<NotificationReadResponse>(NOTIFICATION_READ_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchNotificationPage(payload: NotificationFetchRequest) {
  const response = await apiFetch<NotificationFetchResponse | NotificationSsePacket[]>(NOTIFICATION_FETCH_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (Array.isArray(response)) return response;
  return Array.isArray(response.data) ? response.data : [];
}
