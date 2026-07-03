import { v7 as uuidv7 } from "uuid";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

const generateTrackId = () => uuidv7();

type ApiErrorDetail = {
  field?: string;
  message?: string;
};

type ApiErrorPayload = {
  status?: string;
  statusCode?: number | string;
  message?: string;
  details?: ApiErrorDetail[];
  forceLogToken?: string;
  [key: string]: unknown;
};

export class ApiRequestError extends Error {
  status: number;
  apiMessage?: string;
  details?: ApiErrorDetail[];
  payload?: ApiErrorPayload;

  constructor(status: number, message: string, apiMessage?: string, details?: ApiErrorDetail[], payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.apiMessage = apiMessage;
    this.details = details;
    this.payload = payload;
  }
}

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiRequestError) {
    const detailMessage = error.details
      ?.map((detail) => detail.message?.trim())
      .filter((message): message is string => Boolean(message))
      .join(", ");
    if (detailMessage) return detailMessage;
    if (error.apiMessage?.trim()) return error.apiMessage.trim();
  }

  return error instanceof Error && error.message.trim() ? error.message : fallback;
};

const extractApiError = async (response: Response) => {
  let apiMessage: string | undefined;
  let details: ApiErrorDetail[] | undefined;
  let payload: ApiErrorPayload | undefined;

  try {
    payload = (await response.json()) as ApiErrorPayload;
    apiMessage = typeof payload.message === "string" ? payload.message : undefined;
    details = Array.isArray(payload.details) ? payload.details : undefined;
  } catch {
    apiMessage = undefined;
    details = undefined;
    payload = undefined;
  }

  return { apiMessage, details, payload };
};

const buildRequestInit = (path: string, options: RequestInit = {}) => {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers ?? {});
  headers.set("x-tracking-id", generateTrackId());

  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return {
    url,
    init: {
      ...options,
      method: options.method ?? "POST",
      credentials: "include" as const,
      headers,
    },
  };
};

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { url, init } = buildRequestInit(path, options);
  const response = await fetch(url, init);

  if (!response.ok) {
    const { apiMessage, details, payload } = await extractApiError(response);
    throw new ApiRequestError(
      response.status,
      `Request failed: ${response.status}`,
      apiMessage,
      details,
      payload,
    );
  }

  const payload = (await response.json()) as T;
  const maybeErrorPayload = payload as ApiErrorPayload;
  const normalizedStatus = typeof maybeErrorPayload?.status === "string" ? maybeErrorPayload.status.trim().toLowerCase() : "";
  const statusCode =
    typeof maybeErrorPayload?.statusCode === "number"
      ? maybeErrorPayload.statusCode
      : (typeof maybeErrorPayload?.statusCode === "string" ? Number(maybeErrorPayload.statusCode) : NaN);
  const shouldTreatAsApiError =
    normalizedStatus === "error" || (Number.isFinite(statusCode) && statusCode >= 400);

  if (shouldTreatAsApiError) {
    throw new ApiRequestError(
      Number.isFinite(statusCode) ? Number(statusCode) : response.status,
      `Request failed: ${Number.isFinite(statusCode) ? Number(statusCode) : response.status}`,
      typeof maybeErrorPayload?.message === "string" ? maybeErrorPayload.message : undefined,
      Array.isArray(maybeErrorPayload?.details) ? maybeErrorPayload.details : undefined,
      maybeErrorPayload,
    );
  }

  return payload;
}

export async function apiFetchBlob(path: string, options: RequestInit = {}) {
  const { url, init } = buildRequestInit(path, options);
  const response = await fetch(url, init);

  if (!response.ok) {
    const { apiMessage, details, payload } = await extractApiError(response);
    throw new ApiRequestError(
      response.status,
      `Request failed: ${response.status}`,
      apiMessage,
      details,
      payload,
    );
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") || "";
  const fileNameMatch =
    contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ??
    contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1].trim()) : null;

  return {
    blob,
    fileName,
    contentType: response.headers.get("content-type"),
  };
}
