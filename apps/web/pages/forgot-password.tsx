import type { NextPage } from "next";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "../components/AuthShell";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";

const ForgotPasswordPage: NextPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      setMessage("If an account exists for this email, a reset link has been sent.");
    } catch {
      setMessage("If an account exists for this email, a reset link has been sent.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <p>
          Back to{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200">
            Login
          </Link>
        </p>
      }
    >
      {message && <Banner kind="info">{message}</Banner>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
          <Input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
