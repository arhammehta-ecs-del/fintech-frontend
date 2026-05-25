import type { ApiMonitoringDetailsData, ApiMonitoringLog, ApiMonitoringStep } from "@/features/api-monitoring/types";
import { apiFetch } from "@/services/client";

const API_MONITORING_FETCH_ALL_PATH = "/api/v1/admin/monitoring/fetch-all";
const API_MONITORING_DETAILS_PATH = "/api/v1/admin/monitoring/details";

type FetchAllItem = {
  id?: string;
  trackingId?: string;
  companyName?: string | null;
  companyCode?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  timestamp?: string;
  createdAt?: string;
  method?: string;
  apiUrl?: string;
  endpoint?: string;
  url?: string;
  status?: number | null;
  statusCode?: number | null;
  latency?: number | null;
  ip?: string | null;
  ipAddress?: string | null;
  clientIp?: string | null;
  spanCount?: number;
  subCount?: string;
  totalSpanCount?: number;
};

type DetailMainRequest = {
  trackingId?: string;
  subCount?: string;
  type?: string;
  method?: string;
  apiUrl?: string;
  url?: string;
  statusCode?: number | null;
  status?: number | null;
  latency?: number | null;
  ip?: string | null;
  clientIp?: string | null;
  startedAt?: string;
  createdAt?: string;
  req?: {
    header?: Record<string, unknown>;
    body?: unknown;
  };
  res?: {
    header?: Record<string, unknown>;
    body?: unknown;
  };
};

type DetailChildSpan = {
  id?: string;
  parentSpanId?: string | null;
  subCount?: string;
  type?: string;
  method?: string;
  apiUrl?: string;
  url?: string;
  statusCode?: number | null;
  status?: number | null;
  latency?: number | null;
  ip?: string | null;
  clientIp?: string | null;
  reqBody?: unknown;
  resBody?: unknown;
  req?: {
    header?: Record<string, unknown>;
    body?: unknown;
  };
  res?: {
    header?: Record<string, unknown>;
    body?: unknown;
  };
  headers?: Record<string, unknown>;
  startedAt?: string;
  createdAt?: string;
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

const resolveSpanTypeFromSubCount = (subCount: unknown): string => {
  const normalized = asString(subCount).toLowerCase();
  if (!normalized) return "";

  const prefix = normalized[0];
  const numericPart = normalized.slice(1).replace(/[^\d]/g, "");

  if (prefix === "m") return "MIDDLELAYER";
  if (prefix === "b") return numericPart ? `BACKEND-${numericPart}` : "BACKEND";
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
  const timestampValue = asString(item.createdAt) || asString(item.timestamp);
  const { timeStr, dateStr, timeString } = parseTimestamp(timestampValue);
  const statusValue = typeof item.statusCode === "number"
    ? item.statusCode
    : (typeof item.status === "number" ? item.status : null);
  const spanCountValue = typeof item.spanCount === "number"
    ? item.spanCount
    : (typeof item.totalSpanCount === "number" ? item.totalSpanCount : 0);

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
    spanCount: spanCountValue,
    totalSpanCount: typeof item.totalSpanCount === "number"
      ? item.totalSpanCount
      : spanCountValue,
    subApis: [],
    method: asString(item.method) || "-",
    path: asString(item.apiUrl) || asString(item.url) || asString(item.endpoint) || "-",
    status: statusValue,
    clientIp: asString(item.ip) || asString(item.clientIp) || asString(item.ipAddress) || undefined,
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
  const reqObj = asObject(row.req);
  const resObj = asObject(row.res);
  const headers = mapHeaders(row.headers ?? reqObj.header);
  const resHeaders = mapHeaders(row.resHeaders ?? resObj.header);
  const parentSpanId = asString(row.parentSpanId) || asString(headers["parent-span-id"]);
  const type = resolveSpanTypeFromSubCount(row.subCount) || asString(row.type).toUpperCase();
  const id = asString(row.id) || asString(row.subCount) || parentSpanId || (type ? `${type}-${index + 1}` : `SPAN-${index + 1}`);
  const trackId = asString(row.trackingId) || asString(row.trackId) || fallbackTrackId;
  const timestamp = asString(row.createdAt) || asString(row.startedAt) || asString(row.timestamp);
  const { timeString } = parseTimestamp(timestamp);

  const statusRaw = row.statusCode ?? row.status;
  const status = typeof statusRaw === "number" ? statusRaw : null;
  const latency = typeof row.latency === "number" ? row.latency : null;
  const clientIp = asString(row.ip) || asString(row.clientIp) || asString(headers["client-ip"]) || asString(headers["x-client-ip"]);

  return {
    id,
    trackId,
    spanType: type || "SPAN",
    method: asString(row.method) || "-",
    path: asString(row.apiUrl) || asString(row.url) || asString(row.endpoint) || asString(row.path) || "-",
    status,
    latency,
    clientIp: clientIp || undefined,
    timeString,
    accessToken: asString(row.accessToken),
    refreshToken: asString(row.refreshToken),
    cookies: asString(row.cookies),
    reqHeaders: headers,
    reqBody: (row.reqBody ?? reqObj.body) && typeof (row.reqBody ?? reqObj.body) === "object"
      ? ((row.reqBody ?? reqObj.body) as Record<string, unknown>)
      : null,
    resHeaders,
    resBody: asObject(row.resBody ?? resObj.body),
  };
};

const mapMainRequest = (value: unknown, fallbackId: string): ApiMonitoringStep => {
  const row = asObject(value);
  const trackId = asString(row.trackingId) || fallbackId;
  const timestamp = asString(row.createdAt) || asString(row.startedAt) || asString(row.timestamp);
  const { timeString } = parseTimestamp(timestamp);
  const statusRaw = row.statusCode ?? row.status;
  const reqObj = asObject(row.req);
  const resObj = asObject(row.res);
  const clientIp = asString(row.ip) || asString(row.clientIp);
  const latency = typeof row.latency === "number" ? row.latency : null;
  const type = resolveSpanTypeFromSubCount(row.subCount) || asString(row.type).toUpperCase();

  return {
    id: trackId,
    trackId,
    spanType: type || "MAIN",
    method: asString(row.method) || "-",
    path: asString(row.apiUrl) || asString(row.url) || asString(row.endpoint) || "-",
    status: typeof statusRaw === "number" ? statusRaw : null,
    latency,
    clientIp: clientIp || undefined,
    timeString,
    accessToken: "",
    refreshToken: "",
    cookies: "",
    reqHeaders: mapHeaders(row.reqHeaders ?? row.requestHeaders ?? reqObj.header),
    reqBody: (row.reqBody ?? row.requestBody ?? reqObj.body) && typeof (row.reqBody ?? row.requestBody ?? reqObj.body) === "object"
      ? ((row.reqBody ?? row.requestBody ?? reqObj.body) as Record<string, unknown>)
      : null,
    resHeaders: mapHeaders(row.resHeaders ?? row.responseHeaders ?? resObj.header),
    resBody: asObject(row.resBody ?? row.responseBody ?? resObj.body),
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

export async function fetchApiMonitoringDetails(trackId: string): Promise<ApiMonitoringDetailsData> {
  const response = await apiFetch<unknown>(API_MONITORING_DETAILS_PATH, {
    method: "POST",
    body: JSON.stringify({ trackingId: trackId }),
  });

  const root = asObject(response);
  const data = asObject(root.data);
  const details = Object.keys(data).length > 0 ? data : root;
  const mainRequest = asObject(details.mainRequest ?? details.parent) as DetailMainRequest;
  const trackingId = asString(mainRequest.trackingId) || trackId;
  const childSpans = asArray(details.childSpans ?? details.child) as DetailChildSpan[];
  const mainRequestStep = mapMainRequest(details.mainRequest ?? details.parent, trackId);

  if (childSpans.length > 0) {
    return {
      mainRequest: { ...mainRequestStep, trackId: trackingId, id: trackingId },
      childSpans: childSpans.map((row, index) => mapDetailStep(row, trackingId, index)),
    };
  }

  const fallbackRows = asArray(details.steps ?? details.subApis ?? details.details ?? root.data);
  return {
    mainRequest: { ...mainRequestStep, trackId: trackingId, id: trackingId },
    childSpans: fallbackRows.map((row, index) => mapDetailStep(row, trackingId, index)),
  };
}
