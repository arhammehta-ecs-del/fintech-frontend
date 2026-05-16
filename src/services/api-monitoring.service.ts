import type { ApiMonitoringDetailsData, ApiMonitoringLog, ApiMonitoringStep } from "@/features/api-monitoring/types";
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
  status?: number | null;
  statusCode?: number | null;
  latency: number | null;
  clientIp?: string | null;
  spanCount: number;
  totalSpanCount?: number;
};

type DetailsResponse = {
  data?: unknown;
};

type DetailMainRequest = {
  trackingId?: string;
  method?: string;
  url?: string;
  statusCode?: number | null;
  status?: number | null;
  clientIp?: string | null;
  startedAt?: string;
};

type DetailChildSpan = {
  id?: string;
  parentSpanId?: string | null;
  type?: string;
  method?: string;
  url?: string;
  statusCode?: number | null;
  status?: number | null;
  clientIp?: string | null;
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
const toHeaderValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

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
  const statusValue = typeof item.statusCode === "number"
    ? item.statusCode
    : (typeof item.status === "number" ? item.status : null);

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
    totalSpanCount: typeof item.totalSpanCount === "number"
      ? item.totalSpanCount
      : (typeof item.spanCount === "number" ? item.spanCount : 0),
    subApis: [],
    method: asString(item.method) || "-",
    path: asString(item.endpoint) || "-",
    status: statusValue,
    clientIp: asString(item.clientIp) || undefined,
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

const mapHeaders = (value: unknown): Record<string, string> => {
  const obj = asObject(value);
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, headerValue]) => {
    const normalized = toHeaderValue(headerValue);
    if (normalized) acc[key] = normalized;
    return acc;
  }, {});
};

const mapDetailStep = (value: unknown, fallbackTrackId: string, index: number): ApiMonitoringStep => {
  const row = asObject(value);
  const headers = mapHeaders(row.headers);
  const parentSpanId = asString(row.parentSpanId) || asString(headers["parent-span-id"]);
  const type = asString(row.type).toUpperCase();
  const id = asString(row.id) || parentSpanId || (type ? `${type}-${index + 1}` : `SPAN-${index + 1}`);
  const trackId = asString(row.trackingId) || asString(row.trackId) || fallbackTrackId;
  const timestamp = asString(row.startedAt) || asString(row.timestamp);
  const { timeString } = parseTimestamp(timestamp);

  const statusRaw = row.statusCode ?? row.status;
  const status = typeof statusRaw === "number" ? statusRaw : null;
  const clientIp = asString(row.clientIp) || asString(headers["client-ip"]) || asString(headers["x-client-ip"]);

  return {
    id,
    trackId,
    spanType: type || "SPAN",
    method: asString(row.method) || "-",
    path: asString(row.url) || asString(row.endpoint) || asString(row.path) || "-",
    status,
    clientIp: clientIp || undefined,
    timeString,
    accessToken: asString(row.accessToken),
    refreshToken: asString(row.refreshToken),
    cookies: asString(row.cookies),
    reqHeaders: headers,
    reqBody: row.reqBody && typeof row.reqBody === "object" ? (row.reqBody as Record<string, unknown>) : null,
    resHeaders: asObject(row.resHeaders) as Record<string, string>,
    resBody: asObject(row.resBody),
  };
};

const mapMainRequest = (value: unknown, fallbackId: string): ApiMonitoringStep => {
  const row = asObject(value);
  const trackId = asString(row.trackingId) || fallbackId;
  const timestamp = asString(row.startedAt) || asString(row.timestamp);
  const { timeString } = parseTimestamp(timestamp);
  const statusRaw = row.statusCode ?? row.status;
  const clientIp = asString(row.clientIp);

  return {
    id: trackId,
    trackId,
    spanType: "MAIN",
    method: asString(row.method) || "-",
    path: asString(row.url) || asString(row.endpoint) || "-",
    status: typeof statusRaw === "number" ? statusRaw : null,
    clientIp: clientIp || undefined,
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

export async function fetchApiMonitoringDetails(id: string): Promise<ApiMonitoringDetailsData> {
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
  const mainRequestStep = mapMainRequest(details.mainRequest, id);

  if (childSpans.length > 0) {
    return {
      mainRequest: { ...mainRequestStep, trackId: trackingId, id: trackingId },
      childSpans: childSpans.map((row, index) => mapDetailStep(row, trackingId, index)),
    };
  }

  const fallbackRows = asArray(details.steps ?? details.subApis ?? details.details ?? response.data);
  return {
    mainRequest: { ...mainRequestStep, trackId: trackingId, id: trackingId },
    childSpans: fallbackRows.map((row, index) => mapDetailStep(row, trackingId, index)),
  };
}
