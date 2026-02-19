import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useMemo, useState } from "react";
import { AuthShell } from "../components/AuthShell";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";

const ResetPasswordPage: NextPage = () => {
  const router = useRouter();
  const token = useMemo(() => (typeof router.query.token === "string" ? router.query.token : ""), [router.query.token]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage("Missing reset token.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage(json.error?.message ?? "Reset failed");
        return;
      }
      await router.push("/login?message=Password reset successful. Please login.");
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="Create a new password for your account."
      footer={
        <p>
          Back to{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200">
            Login
          </Link>
        </p>
      }
    >
      {message && <Banner kind="error">{message}</Banner>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">New password</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm password</span>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </label>
        <Button type="submit" className="w-full" loading={loading}>
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
