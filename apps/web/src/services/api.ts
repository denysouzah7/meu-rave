const defaultApiUrl =
  typeof window === "undefined" ? "http://localhost:4000" : `${window.location.protocol}//${window.location.hostname}:4000`;

export const API_URL = import.meta.env.VITE_API_URL ?? defaultApiUrl;

type ApiOptions = RequestInit & {
  json?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  let body = options.body;

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const init: RequestInit = {
    ...requestOptions,
    headers,
    credentials: "include"
  };
  if (body !== undefined) {
    init.body = body;
  }

  const response = await fetch(`${API_URL}/api${path}`, init);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ApiError(payload?.error ?? "Falha na requisicao", response.status, payload?.code);
  }

  return (await response.json()) as T;
}

export async function uploadFile(kind: "video" | "image" | "sticker" | "avatar" | "audio", file: File) {
  const form = new FormData();
  form.append("file", file);
  return api<{ upload: { id: string; url: string; mimeType: string; filename: string; size: number } }>(
    `/uploads/${kind}`,
    {
      method: "POST",
      body: form
    }
  );
}

export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return "";

  if (url.startsWith("/uploads/")) {
    return new URL(url, `${API_URL}/`).toString();
  }

  try {
    const parsed = new URL(url);
    const apiUrl = new URL(API_URL);

    // Upload URLs may contain a previous local IP. Their path always belongs
    // to the currently configured API, unlike external media URLs.
    if (parsed.pathname.startsWith("/uploads/")) {
      parsed.protocol = apiUrl.protocol;
      parsed.hostname = apiUrl.hostname;
      parsed.port = apiUrl.port;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
