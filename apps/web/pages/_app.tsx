import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import { useEffect } from "react";
import { ToastProvider } from "../components/providers/ToastProvider";
import { applyTheme, getStoredTheme } from "../lib/theme";
import "../styles/globals.css";

const interDisplay = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-display",
});

function ensureDeviceIdCookie() {
  if (typeof window === "undefined") return;
  try {
    const existing = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("device_id="));
    if (existing) return;

    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + oneYearMs).toUTCString();
    document.cookie = `device_id=${encodeURIComponent(
      id,
    )}; Expires=${expires}; Path=/; SameSite=Lax`;
  } catch {
    // ignore; device binding will just not work if this fails
  }
}

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    ensureDeviceIdCookie();
    applyTheme(getStoredTheme());
  }, []);

  return (
    <div className={`${interDisplay.variable} font-sans`}>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </div>
  );
}


