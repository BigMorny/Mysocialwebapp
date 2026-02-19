import type { NextPage } from "next";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout, useDashboardShell } from "../../components/DashboardLayout";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Field";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

function BillingBody() {
  const { push: toast } = useToast();
  const { refreshSummary } = useDashboardShell();

  const [status, setStatus] = useState<any>(null);
  const [info, setInfo] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [method, setMethod] = useState<"MOMO" | "BANK">("MOMO");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [statusJson, infoJson] = await Promise.all([
      apiJson<any>("/api/subscription/status"),
      apiJson<any>("/api/subscription/payment-info"),
    ]);
    setStatus(statusJson);
    setInfo(infoJson);
  };

  useEffect(() => {
    void load();
  }, []);

  const trialDays = useMemo(() => {
    if (!status?.subscription?.trialEndsAt) return null;
    const ms = new Date(status.subscription.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }, [status]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast({ kind: "success", text: `${label} copied.` });
    } catch {
      toast({ kind: "error", text: "Copy failed." });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiJson("/api/subscription/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingCycle, method, reference }),
      });
      toast({ kind: "success", text: "Payment request submitted." });
      setReference("");
      await load();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to submit" });
    } finally {
      setSubmitting(false);
    }
  };

  const viewOnly = Boolean(status?.viewOnly);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Billing</h1>

      <Card>
        <h2 className="text-lg font-semibold">Subscription status</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Current status</p>
            <p className="mt-1 text-lg font-bold">{status?.subscription?.status ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Trial remaining</p>
            <p className="mt-1 text-lg font-bold">{trialDays ?? "-"} {trialDays != null ? "days" : ""}</p>
          </div>
        </div>
        {status?.pendingRequest && <Banner kind="info" className="mt-3">Waiting approval for reference: {status.pendingRequest.reference}</Banner>}
        {viewOnly && <Banner kind="warning" className="mt-3">Your subscription is expired. Submit payment request below to restore write access.</Banner>}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Payment information</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">MoMo</p>
            <p className="mt-1 font-semibold break-words">{info?.momoNumber} ({info?.momoName})</p>
            <Button variant="secondary" className="mt-2 h-9" onClick={() => void copy(info?.momoNumber ?? "", "MoMo number")}>Copy MoMo number</Button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Bank</p>
            <p className="mt-1 break-words">{info?.bankName}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 break-words">{info?.bankAccountName} / {info?.bankAccountNumber}</p>
            <Button variant="secondary" className="mt-2 h-9" onClick={() => void copy(`${info?.bankName}\n${info?.bankAccountName}\n${info?.bankAccountNumber}`, "Bank details")}>Copy bank details</Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Submit payment request</h2>
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Billing cycle">
            <Select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as "MONTHLY" | "ANNUAL")} disabled={Boolean(status?.pendingRequest)}>
              <option value="MONTHLY">Monthly (GHS 59)</option>
              <option value="ANNUAL">Annual (GHS 590)</option>
            </Select>
          </Field>
          <Field label="Payment method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as "MOMO" | "BANK")} disabled={Boolean(status?.pendingRequest)}>
              <option value="MOMO">MoMo</option>
              <option value="BANK">Bank</option>
            </Select>
          </Field>
          <Field label="Reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} disabled={Boolean(status?.pendingRequest)} />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={submitting} disabled={Boolean(status?.pendingRequest)}>
              {status?.pendingRequest ? "Waiting approval" : "Submit request"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const BillingPage: NextPage = () => (
  <DashboardLayout>
    <BillingBody />
  </DashboardLayout>
);

export default BillingPage;
