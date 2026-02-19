import type { NextPage } from "next";
import { FormEvent, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Field";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

const SupportPage: NextPage = () => {
  const { push: toast } = useToast();
  const [target, setTarget] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      await apiJson("/api/admin/support/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      setMessage("If account exists, password reset email was sent.");
      toast({ kind: "success", text: "Support reset trigger completed." });
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to send reset" });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <Card>
          <h2 className="text-lg font-semibold">Send password reset</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Enter shop user email or phone. We always return a generic success response.</p>
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={submit}>
            <Input className="min-w-[260px] flex-1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="email or phone" />
            <Button type="submit" loading={sending} disabled={!target}>Send password reset</Button>
          </form>
          {message ? <Banner className="mt-3" kind="info">{message}</Banner> : null}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SupportPage;
