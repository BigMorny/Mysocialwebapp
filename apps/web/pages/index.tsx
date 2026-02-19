import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { apiFetch } from "../lib/api";

const HomeGatePage: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const res = await apiFetch("/api/auth/me", undefined, { redirectOn401: false });
        if (res.ok) {
          await router.replace("/dashboard");
          return;
        }
      } catch {
        // ignore and fall through
      }
      await router.replace("/login");
    };
    void run();
  }, [router]);

  return <main className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-slate-400">Loading...</main>;
};

export default HomeGatePage;
