import { apiFetch, buildApiUrl } from "@/services/client";

const NOTIFICATION_SSE_PATH = "/api/v1/notifications/sse";
const NOTIFICATION_READ_PATH = "/api/v1/notifications/read";
const NOTIFICATION_FETCH_PATH = "/api/v1/notifications/fetch";
const NOTIFICATION_SETTINGS_FETCH_PATH = "/api/v1/notifications/fetch-settings";
const NOTIFICATION_SETTINGS_UPDATE_PATH = "/api/v1/notifications/settings";

export type NotificationSseType = "INITIATE" | "APPROVE" | "REJECT";
export type NotificationSseRefType = "USER" | "WORKFLOW" | "ORG" | "COMPANY" | "COMPANYLIST";
export type NotificationSseStatus = "UNREAD" | "READ";

export type NotificationSsePacket = {
  id?: string;
  name?: string;
  message?: string;
  type?: string;
  refType?: string;
  referenceId?: string | null;
  target?: string | null;
  status?: string;
  isPending?: boolean;
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

export type NotificationFetchStatus = "UNREAD" | "READ" | "HIDDEN" | "ALL";
export type NotificationFetchRefType = "USER" | "WORKFLOW" | "ORG" | "COMPANY" | null;
export type NotificationFetchDateRange = "7DAYS" | "15DAYS" | "1MONTH" | "CUSTOM";

export type NotificationFetchRequest = {
  status: NotificationFetchStatus;
  limit: number;
  offset: number;
  refType?: NotificationFetchRefType;
  dateRange?: NotificationFetchDateRange;
  fromDate?: string | null;
  toDate?: string | null;
};

type NotificationFetchResponse = {
  data?: NotificationSsePacket[];
  count?: number;
  allCount?: number;
  unreadCount?: number;
  limit?: number;
  offset?: number;
  status?: string;
  cursorId?: string | null;
  nextCursorId?: string | null;
  hasNextPage?: boolean;
};

export type NotificationFetchResult = {
  data: NotificationSsePacket[];
  count: number;
  allCount: number;
  unreadCount: number | null;
  limit: number;
  offset: number;
  status: string;
  cursorId: string | null;
  nextCursorId: string | null;
  hasNextPage: boolean;
};

export type NotificationSettingsModule = {
  module: string;
  isEnabled: boolean;
};

export type NotificationSettingsNode = {
  nodePath: string;
  nodeName: string;
  nodeType?: string;
  levelCount?: number;
  settings: NotificationSettingsModule[];
};

export type NotificationSettingsCompany = {
  companyName: string;
  companyCode: string;
  nodes: NotificationSettingsNode[];
};

type NotificationSettingsResponse = {
  success?: boolean;
  data?: NotificationSettingsCompany[];
};

export type NotificationSettingsUpdateRequest = Array<{
  companyCode: string;
  settings: Array<{
    nodePath: string;
    module: string;
    isEnabled: boolean;
  }>;
}>;

type NotificationSettingsUpdateResponse = {
  success?: boolean;
  message?: string;
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
    body: JSON.stringify(payload),
  });
}

export async function fetchNotificationPage(payload: NotificationFetchRequest) {
  const response = await apiFetch<NotificationFetchResponse | NotificationSsePacket[]>(NOTIFICATION_FETCH_PATH, {
    body: JSON.stringify(payload),
  });

  if (Array.isArray(response)) {
    return {
      data: response,
      count: response.length,
      allCount: response.length,
      unreadCount: null,
      limit: payload.limit,
      offset: payload.offset,
      status: payload.status,
      cursorId: null,
      nextCursorId: null,
      hasNextPage: false,
    } as NotificationFetchResult;
  }

  return {
    data: Array.isArray(response.data) ? response.data : [],
    count: Number(response.count ?? 0),
    allCount: Number(response.allCount ?? response.count ?? 0),
    unreadCount: typeof response.unreadCount === "number" ? response.unreadCount : null,
    limit: Number(response.limit ?? payload.limit),
    offset: Number(response.offset ?? payload.offset),
    status: String(response.status ?? payload.status),
    cursorId: response.cursorId ?? null,
    nextCursorId: response.nextCursorId ?? null,
    hasNextPage: Boolean(response.hasNextPage),
  } as NotificationFetchResult;
}

export async function fetchNotificationSettings() {
  const response = await apiFetch<NotificationSettingsResponse | NotificationSettingsCompany[]>(
    NOTIFICATION_SETTINGS_FETCH_PATH,
    {
      body: JSON.stringify({}),
    },
  );

  if (Array.isArray(response)) {
    return response;
  }

  return Array.isArray(response.data) ? response.data : [];
}

export async function updateNotificationSettings(payload: NotificationSettingsUpdateRequest) {
  return apiFetch<NotificationSettingsUpdateResponse>(NOTIFICATION_SETTINGS_UPDATE_PATH, {
    body: JSON.stringify(payload),
  });
}



