import type { ApiMonitoringLog, ApiMonitoringStep } from "@/features/api-monitoring/types";
import { apiFetch } from "@/services/client";

const API_MONITORING_FETCH_ALL_PATH = "/api/v1/admin/monitoring/fetch-all";
const API_MONITORING_DETAILS_PATH = "/api/v1/admin/monitoring/details";

type FetchAllItem = {
  id: string;
  trackingId: string;
  companyName: string;
  companyCode: string;
  userName: string;
  userEmail: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: number | null;
  latency: number | null;
  spanCount: number;
};

type DetailsResponse = {
  data?: unknown;
};

type DetailMainRequest = {
  trackingId?: string;
};

type DetailChildSpan = {
  type?: string;
  method?: string;
  url?: string;
  status?: number | null;
  reqBody?: unknown;
  resBody?: unknown;
  headers?: Record<string, unknown>;
  startedAt?: string;
};

const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}
);

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const parseTimestamp = (timestamp: string) => {
  if (!timestamp) return { timeStr: "-", dateStr: "-", timeString: "-" };

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return { timeStr: timestamp, dateStr: "-", timeString: timestamp };
  }

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateStr = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    timeStr,
    dateStr,
    timeString: `${dateStr} ${timeStr}`,
  };
};

const mapListItem = (item: FetchAllItem): ApiMonitoringLog => {
  const { timeStr, dateStr, timeString } = parseTimestamp(asString(item.timestamp));
  const statusValue = typeof item.status === "number" ? item.status : null;

  return {
    id: asString(item.id) || asString(item.trackingId),
    trackId: asString(item.trackingId) || asString(item.id),
    company: {
      name: asString(item.companyName) || "N/A",
      code: asString(item.companyCode) || "N/A",
    },
    user: {
      name: asString(item.userName) || "N/A",
      email: asString(item.userEmail) || "N/A",
    },
    timeStr,
    dateStr,
    spanCount: typeof item.spanCount === "number" ? item.spanCount : 0,
    subApis: [],
    method: asString(item.method) || "-",
    path: asString(item.endpoint) || "-",
    status: statusValue,
    timeString,
    accessToken: "",
    refreshToken: "",
    cookies: "",
    reqHeaders: {},
    reqBody: null,
    resHeaders: {},
    resBody: {},
  };
};

const mapDetailStep = (value: unknown, fallbackTrackId: string, index: number): ApiMonitoringStep => {
  const row = asObject(value);
  const headers = asObject(row.headers);
  const parentSpanId = asString(headers["parent-span-id"]);
  const type = asString(row.type).toUpperCase();
  const id = parentSpanId || (type ? `${type}-${index + 1}` : `SPAN-${index + 1}`);
  const trackId = asString(row.trackingId) || asString(row.trackId) || fallbackTrackId;
  const timestamp = asString(row.startedAt) || asString(row.timestamp);
  const { timeString } = parseTimestamp(timestamp);

  const statusRaw = row.status;
  const status = typeof statusRaw === "number" ? statusRaw : null;

  return {
    id,
    trackId,
    method: asString(row.method) || "-",
    path: asString(row.url) || asString(row.endpoint) || asString(row.path) || "-",
    status,
    timeString,
    accessToken: asString(row.accessToken),
    refreshToken: asString(row.refreshToken),
    cookies: asString(row.cookies),
    reqHeaders: headers as Record<string, string>,
    reqBody: row.reqBody && typeof row.reqBody === "object" ? (row.reqBody as Record<string, unknown>) : null,
    resHeaders: asObject(row.resHeaders) as Record<string, string>,
    resBody: asObject(row.resBody),
  };
};

export async function fetchApiMonitoringList(): Promise<ApiMonitoringLog[]> {
  const response = await apiFetch<unknown>(API_MONITORING_FETCH_ALL_PATH, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const rootRows = asArray(response);
  if (rootRows.length > 0) {
    return rootRows.map((item) => mapListItem(item as FetchAllItem));
  }

  const wrappedRows = asArray(asObject(response).data);
  return wrappedRows.map((item) => mapListItem(item as FetchAllItem));
}

export async function fetchApiMonitoringDetails(id: string): Promise<ApiMonitoringStep[]> {
  const response = await apiFetch<DetailsResponse>(API_MONITORING_DETAILS_PATH, {
    method: "POST",
    body: JSON.stringify({ id }),
  });

  const root = asObject(response);
  const data = asObject(response.data);
  const details = Object.keys(data).length > 0 ? data : root;

  const mainRequest = asObject(details.mainRequest) as DetailMainRequest;
  const trackingId = asString(mainRequest.trackingId) || id;

  const childSpans = asArray(details.childSpans) as DetailChildSpan[];
  if (childSpans.length > 0) {
    return childSpans.map((row, index) => mapDetailStep(row, trackingId, index));
  }

  const fallbackRows = asArray(details.steps ?? details.subApis ?? details.details ?? response.data);
  return fallbackRows.map((row, index) => mapDetailStep(row, trackingId, index));
}
