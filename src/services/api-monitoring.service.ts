import type { ApiMonitoringDetailsData, ApiMonitoringLog, ApiMonitoringStep } from "@/features/api-monitoring/types";
import { apiFetch } from "@/services/client";

const API_MONITORING_FETCH_ALL_PATH = "/api/v1/admin/monitoring/fetch-all";
const API_MONITORING_DETAILS_PATH = "/api/v1/admin/monitoring/details";

type FetchAllItem = {
  trackingId: string;
  companyName: string | null;
  companyCode: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
  method?: string;
  apiUrl: string;
  responseSize?: string | number | null;
  statusCode: number | null;
  ip: string | null;
  spanCount: number;
};

type ApiMonitoringPageInfo = {
  page: number;
  totalPages: number;
  nextCursor: string | null;
  prevCursor: string | null;
  topCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
  hasNewData?: boolean;
  newCount?: number;
};

type ApiMonitoringFetchAllResponse = {
  data?: FetchAllItem[];
  pageInfo?: Partial<ApiMonitoringPageInfo>;
  totalCount?: number;
  filter?: {
    users?: Array<{
      userId?: string | null;
      userName?: string | null;
      userEmail?: string | null;
      count?: number | null;
    }>;
    ips?: Array<{
      ip?: string | null;
      count?: number | null;
    }>;
    urls?: Array<{
      apiUrl?: string | null;
      count?: number | null;
    }>;
    statusCodes?: Array<{
      statusCode?: number | null;
      count?: number | null;
    }>;
    responseSizeRanges?: Array<{
      label?: string | null;
      minBytes?: number | null;
      maxBytes?: number | null;
      count?: number | null;
    }>;
    companies?: Array<{
      companyId?: string | null;
      companyName?: string | null;
      companyCode?: string | null;
      count?: number | null;
    }>;
  };
};

export type ApiMonitoringPaginatedRequest = {
  limit: number;
  cursor: string | null;
  topCursor: string | null;
  page?: number | null;
  direction?: "NEXT" | "PREV";
  query?: string | null;
  filter?: boolean;
  softFilter?: boolean;
  applied?: {
    date: "7days" | "15days" | "1month" | "custom" | null;
    formDate: string | null;
    toDate: string | null;
    users: string[] | null;
    ips: string[] | null;
    urls: string[] | null;
    companies: string[] | null;
    status: number[] | null;
    responseSize: string | null;
    responseSizeSort: "asc" | "desc" | null;
    subtrack: number[] | null;
  } | null;
};

export type ApiMonitoringFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type ApiMonitoringResponseSizeFilterOption = {
  value: string;
  label: string;
  count: number;
  minBytes: number;
  maxBytes: number;
};

export type ApiMonitoringFilterMetadata = {
  companies: ApiMonitoringFilterOption[];
  users: ApiMonitoringFilterOption[];
  ips: ApiMonitoringFilterOption[];
  urls: ApiMonitoringFilterOption[];
  statusCodes: Array<{
    value: number;
    label: string;
    count: number;
  }>;
  responseSizeRanges: ApiMonitoringResponseSizeFilterOption[];
};

export type ApiMonitoringPaginatedResult = {
  logs: ApiMonitoringLog[];
  pageInfo: ApiMonitoringPageInfo;
  totalCount: number;
  filterMetadata: ApiMonitoringFilterMetadata;
};

type DetailMainRequest = {
  trackingId: string;
  subCount?: string;
  type?: string;
  method: string;
  apiUrl: string;
  responseSize?: string | number | null;
  statusCode: number | null;
  latency?: number | null;
  ip?: string | null;
  createdAt: string;
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
  subCount?: string;
  type?: string;
  method: string;
  apiUrl: string;
  responseSize?: string | number | null;
  statusCode?: number | null;
  latency?: number | null;
  ip?: string | null;
  req?: {
    header?: Record<string, unknown>;
    body?: unknown;
  };
  res?: {
    header?: Record<string, unknown>;
    body?: unknown;
  };
  createdAt: string;
};

type ApiMonitoringDetailsResponse = {
  parent?: DetailMainRequest;
  child?: DetailChildSpan[];
};

const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}
);

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const asNullableString = (value: unknown): string | null => {
  const parsed = asString(value);
  return parsed || null;
};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const toHeaderValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const formatResponseSize = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
    return `${(value / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  }
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
  const timestampValue = asString(item.createdAt);
  const { timeStr, dateStr, timeString } = parseTimestamp(timestampValue);
  const statusValue = typeof item.statusCode === "number" ? item.statusCode : null;
  const spanCountValue = typeof item.spanCount === "number" ? item.spanCount : 0;

  return {
    id: asString(item.trackingId),
    trackId: asString(item.trackingId),
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
    totalSpanCount: spanCountValue,
    subApis: [],
    method: asString(item.method) || "-",
    path: asString(item.apiUrl) || "-",
    responseSize: formatResponseSize(item.responseSize) || "-",
    status: statusValue,
    clientIp: asString(item.ip) || undefined,
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
  const headers = mapHeaders(reqObj.header);
  const resHeaders = mapHeaders(resObj.header);
  const type = resolveSpanTypeFromSubCount(row.subCount) || asString(row.type).toUpperCase();
  const id = asString(row.subCount) || (type ? `${type}-${index + 1}` : `SPAN-${index + 1}`);
  const trackId = fallbackTrackId;
  const timestamp = asString(row.createdAt);
  const { timeString } = parseTimestamp(timestamp);

  const status = typeof row.statusCode === "number" ? row.statusCode : null;
  const latency = typeof row.latency === "number" ? row.latency : null;
  const clientIp = asString(row.ip);

  return {
    id,
    trackId,
    spanType: type || "SPAN",
    method: asString(row.method) || "-",
    path: asString(row.apiUrl) || "-",
    responseSize: formatResponseSize(row.responseSize) || "-",
    status,
    latency,
    clientIp: clientIp || undefined,
    timeString,
    accessToken: "",
    refreshToken: "",
    cookies: "",
    reqHeaders: headers,
    reqBody: reqObj.body && typeof reqObj.body === "object"
      ? (reqObj.body as Record<string, unknown>)
      : null,
    resHeaders,
    resBody: asObject(resObj.body),
  };
};

const mapMainRequest = (value: unknown, fallbackId: string): ApiMonitoringStep => {
  const row = asObject(value);
  const trackId = asString(row.trackingId) || fallbackId;
  const timestamp = asString(row.createdAt);
  const { timeString } = parseTimestamp(timestamp);
  const statusRaw = row.statusCode;
  const reqObj = asObject(row.req);
  const resObj = asObject(row.res);
  const clientIp = asString(row.ip);
  const latency = typeof row.latency === "number" ? row.latency : null;
  const type = resolveSpanTypeFromSubCount(row.subCount) || asString(row.type).toUpperCase();

  return {
    id: trackId,
    trackId,
    spanType: type || "MAIN",
    method: asString(row.method) || "-",
    path: asString(row.apiUrl) || "-",
    responseSize: formatResponseSize(row.responseSize) || "-",
    status: typeof statusRaw === "number" ? statusRaw : null,
    latency,
    clientIp: clientIp || undefined,
    timeString,
    accessToken: "",
    refreshToken: "",
    cookies: "",
    reqHeaders: mapHeaders(reqObj.header),
    reqBody: reqObj.body && typeof reqObj.body === "object"
      ? (reqObj.body as Record<string, unknown>)
      : null,
    resHeaders: mapHeaders(resObj.header),
    resBody: asObject(resObj.body),
  };
};

export async function fetchApiMonitoringList(): Promise<ApiMonitoringLog[]> {
  const response = await apiFetch<ApiMonitoringFetchAllResponse>(API_MONITORING_FETCH_ALL_PATH, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return (response.data ?? []).map(mapListItem);
}

const mapPageInfo = (pageInfo?: Partial<ApiMonitoringPageInfo>): ApiMonitoringPageInfo => ({
  page: Number(pageInfo?.page ?? 1) || 1,
  totalPages: Number(pageInfo?.totalPages ?? 0) || 0,
  nextCursor: asNullableString(pageInfo?.nextCursor),
  prevCursor: asNullableString(pageInfo?.prevCursor),
  topCursor: asNullableString(pageInfo?.topCursor),
  hasNext: Boolean(pageInfo?.hasNext),
  hasPrev: Boolean(pageInfo?.hasPrev),
});

const toSafeCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapFilterMetadata = (filter?: ApiMonitoringFetchAllResponse["filter"]): ApiMonitoringFilterMetadata => ({
  companies: (filter?.companies ?? [])
    .map((item) => ({
      value: asString(item.companyCode),
      label: [asString(item.companyName), asString(item.companyCode)].filter(Boolean).join(" • ") || "N/A",
      count: toSafeCount(item.count),
    }))
    .filter((item) => item.value),
  users: (filter?.users ?? [])
    .map((item) => ({
      value: asString(item.userEmail),
      label: [asString(item.userName), asString(item.userEmail)].filter(Boolean).join(" • ") || "N/A",
      count: toSafeCount(item.count),
    }))
    .filter((item) => item.value),
  ips: (filter?.ips ?? [])
    .map((item) => ({
      value: asString(item.ip),
      label: asString(item.ip) || "N/A",
      count: toSafeCount(item.count),
    }))
    .filter((item) => item.value),
  urls: (filter?.urls ?? [])
    .map((item) => ({
      value: asString(item.apiUrl),
      label: asString(item.apiUrl) || "N/A",
      count: toSafeCount(item.count),
    }))
    .filter((item) => item.value),
  statusCodes: (filter?.statusCodes ?? [])
    .map((item) => ({
      value: typeof item.statusCode === "number" ? item.statusCode : Number(item.statusCode ?? 0),
      label: String(item.statusCode ?? ""),
      count: toSafeCount(item.count),
    }))
    .filter((item) => Number.isFinite(item.value) && item.label),
  responseSizeRanges: (filter?.responseSizeRanges ?? [])
    .map((item) => ({
      value: asString(item.label),
      label: asString(item.label) || "N/A",
      count: toSafeCount(item.count),
      minBytes: Number(item.minBytes ?? 0) || 0,
      maxBytes: Number(item.maxBytes ?? 0) || 0,
    }))
    .filter((item) => item.value),
});

export async function fetchApiMonitoringListPaginated(
  payload: ApiMonitoringPaginatedRequest,
): Promise<ApiMonitoringPaginatedResult> {
  const response = await apiFetch<ApiMonitoringFetchAllResponse>(API_MONITORING_FETCH_ALL_PATH, {
    method: "POST",
    body: JSON.stringify({
      limit: payload.limit,
      cursor: payload.cursor ?? null,
      topCursor: payload.topCursor ?? null,
      page: payload.page ?? null,
      direction: payload.direction ?? "NEXT",
      query: asNullableString(payload.query),
      filter: Boolean(payload.filter),
      softFilter: Boolean(payload.softFilter),
      applied: payload.filter || payload.softFilter ? payload.applied ?? null : null,
    }),
  });

  const wrappedRows = response.data ?? [];
  const pageInfo = mapPageInfo(response.pageInfo);
  const totalCount = Number(response.totalCount ?? 0) || wrappedRows.length;

  return {
    logs: wrappedRows.map(mapListItem),
    pageInfo,
    totalCount,
    filterMetadata: mapFilterMetadata(response.filter),
  };
}

export async function fetchApiMonitoringDetails(trackId: string): Promise<ApiMonitoringDetailsData> {
  const response = await apiFetch<ApiMonitoringDetailsResponse>(API_MONITORING_DETAILS_PATH, {
    method: "POST",
    body: JSON.stringify({ trackingId: trackId }),
  });

  const mainRequest = asObject(response.parent) as DetailMainRequest;
  const trackingId = asString(mainRequest.trackingId) || trackId;
  const childSpans = asArray(response.child) as DetailChildSpan[];
  const mainRequestStep = mapMainRequest(response.parent, trackId);

  return {
    mainRequest: { ...mainRequestStep, trackId: trackingId, id: trackingId },
    childSpans: childSpans.map((row, index) => mapDetailStep(row, trackingId, index)),
  };
}
