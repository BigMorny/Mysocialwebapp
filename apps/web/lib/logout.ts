import { apiFetch } from "./api";

export async function logoutRequest() {
  const res = await apiFetch("/api/auth/logout", {
    method: "POST",
  }, { redirectOn401: false });
  const json = await res.json().catch(() => ({ ok: false }));
  if (!res.ok || !json.ok) {
    throw new Error(json?.error?.message ?? json?.error ?? "Logout failed. Please try again.");
  }
}
