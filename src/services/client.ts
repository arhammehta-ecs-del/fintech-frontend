import { v7 as uuidv7 } from "uuid";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

const generateTrackId = () => uuidv7();

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers ?? {});
  headers.set("track-id", generateTrackId());

   console.log("document.cookie:", document.cookie);
   
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

  console.log(`API Request: ${options.method ?? "GET"} ${url} - Track ID: ${headers.get("track-id")}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
