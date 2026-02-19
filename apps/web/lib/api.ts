const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const EXPIRED_KEY = "mysocial_session_expired_notified";

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type ApiOptions = {
  redirectOn401?: boolean;
};

function handle401Redirect() {
  if (typeof window === "undefined") return;
  if (!sessionStorage.getItem(EXPIRED_KEY)) {
    sessionStorage.setItem(EXPIRED_KEY, "1");
  }
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login?message=Session%20expired.%20Please%20log%20in%20again.");
  }
}

export function clearSessionExpiredFlag() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(EXPIRED_KEY);
}

export async function apiFetch(path: string, init?: RequestInit, options?: ApiOptions) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && (options?.redirectOn401 ?? true)) {
    handle401Redirect();
  }
  return res;
}

export async function apiJson<T = any>(path: string, init?: RequestInit, options?: ApiOptions): Promise<T> {
  const res = await apiFetch(path, init, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const message = json?.error?.message ?? json?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, json);
  }
  return json.data as T;
}

export { API_BASE_URL };
