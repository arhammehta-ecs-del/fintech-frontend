import { v7 as uuidv7 } from "uuid";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

const generateTrackId = () => uuidv7();

type ApiErrorDetail = {
  field?: string;
  message?: string;
};

type ApiErrorPayload = {
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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers ?? {});
  headers.set("x-tracking-id", generateTrackId());

  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
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

    throw new ApiRequestError(
      response.status,
      `Request failed: ${response.status}`,
      apiMessage,
      details,
      payload,
    );
  }

  return response.json() as Promise<T>;
}
