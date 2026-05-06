import { v7 as uuidv7 } from "uuid";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

const generateTrackId = () => uuidv7();

type ApiErrorDetail = {
  field?: string;
  message?: string;
};

type ApiErrorPayload = {
  message?: string;
  details?: ApiErrorDetail[];
};

export class ApiRequestError extends Error {
  status: number;
  apiMessage?: string;
  details?: ApiErrorDetail[];

  constructor(status: number, message: string, apiMessage?: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.apiMessage = apiMessage;
    this.details = details;
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
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers ?? {});
  headers.set("track-id", generateTrackId());

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

    try {
      const payload = (await response.json()) as ApiErrorPayload;
      apiMessage = typeof payload.message === "string" ? payload.message : undefined;
      details = Array.isArray(payload.details) ? payload.details : undefined;
    } catch {
      apiMessage = undefined;
      details = undefined;
    }

    throw new ApiRequestError(
      response.status,
      `Request failed: ${response.status}`,
      apiMessage,
      details,
    );
  }

  return response.json() as Promise<T>;
}
