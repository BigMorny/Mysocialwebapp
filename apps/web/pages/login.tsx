import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { Banner } from "../components/ui/Banner";
import { apiFetch, clearSessionExpiredFlag } from "../lib/api";

const LoginPage: NextPage = () => {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(typeof router.query.message === "string" ? router.query.message : null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, password }),
      }, { redirectOn401: false });
      const json = await res.json();
      if (!json.ok) {
        setMessage(json.error?.message ?? "Login failed");
        return;
      }
      clearSessionExpiredFlag();
      await router.push("/dashboard");
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your phone or email to continue."
      footer={
        <div className="flex flex-col gap-2">
          <Link href="/forgot-password" className="text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200">
            Forgot password?
          </Link>
          <p className="text-slate-700 dark:text-slate-300">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200">
              Create one
            </Link>
          </p>
        </div>
      }
    >
      {message && <Banner kind="error">{message}</Banner>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone or Email</span>
          <Input type="text" placeholder="e.g. 233xxxxxxxxx or you@email.com" value={target} onChange={(e) => setTarget(e.target.value)} required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
          <Input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
