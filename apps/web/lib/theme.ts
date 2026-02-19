export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "mysocial_theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "light" ? "light" : "dark";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  html.classList.add(mode);
}

export function saveTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function setTheme(mode: ThemeMode) {
  saveTheme(mode);
  applyTheme(mode);
}
