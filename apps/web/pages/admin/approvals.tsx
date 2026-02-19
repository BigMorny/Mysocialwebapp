import type { NextPage } from "next";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Field";
import { ModalConfirm } from "../../components/ui/ModalConfirm";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

type PaymentRequest = {
  id: string;
  shopId: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  method: "MOMO" | "BANK";
  reference: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  shop: { name: string; phone?: string | null; email?: string | null };
  owner: { name: string | null; phone: string | null; email: string | null } | null;
};

const statusKind = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

const ApprovalsPage: NextPage = () => {
  const { push: toast } = useToast();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PaymentRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<PaymentRequest[]>(`/api/admin/payment-requests?status=${status}`);
      setRows(data);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load approvals" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const approve = async () => {
    if (!approveTarget) return;
    setActing(true);
    try {
      await apiJson(`/api/admin/payment-requests/${approveTarget.id}/approve`, { method: "POST" });
      toast({ kind: "success", text: "Payment request approved." });
      setApproveTarget(null);
      await load();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to approve" });
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setActing(true);
    try {
      await apiJson(`/api/admin/payment-requests/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectReason || undefined }),
      });
      toast({ kind: "success", text: "Payment request rejected." });
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to reject" });
    } finally {
      setActing(false);
    }
  };

  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === "PENDING").length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    rejected: rows.filter((r) => r.status === "REJECTED").length,
  }), [rows]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <div className="flex gap-2">
            {(["PENDING", "APPROVED", "REJECTED"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === key ? "bg-brand-600 text-white" : "border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="px-3 py-2">Shop</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Cycle</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-3 py-3 font-medium">{r.shop.name}</td>
                  <td className="px-3 py-3">{r.owner?.name ?? "-"}</td>
                  <td className="px-3 py-3">{r.owner?.phone ?? r.shop.phone ?? "-"}</td>
                  <td className="px-3 py-3">{r.owner?.email ?? r.shop.email ?? "-"}</td>
                  <td className="px-3 py-3">{r.billingCycle}</td>
                  <td className="px-3 py-3">{r.method}</td>
                  <td className="px-3 py-3 break-all">{r.reference}</td>
                  <td className="px-3 py-3">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-3"><Badge kind={statusKind[r.status]}>{r.status}</Badge></td>
                  <td className="px-3 py-3">
                    {r.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button className="h-9" onClick={() => setApproveTarget(r)}>Approve</Button>
                        <Button variant="danger" className="h-9" onClick={() => setRejectTarget(r)}>Reject</Button>
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-600 dark:text-slate-400">No requests in this filter.</p>
          ) : null}
        </Card>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Visible counts in current list: pending {counts.pending}, approved {counts.approved}, rejected {counts.rejected}.
        </p>
      </div>

      <ModalConfirm
        open={Boolean(approveTarget)}
        title="Approve payment request"
        description={`Approve request for ${approveTarget?.shop?.name ?? "this shop"}?`}
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => void approve()}
        loading={acting}
      />

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 dark:bg-slate-950/70">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold">Reject payment request</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Optional reason</p>
            <Input className="mt-3" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (optional)" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(""); }} disabled={acting}>Cancel</Button>
              <Button variant="danger" onClick={() => void reject()} loading={acting}>Reject</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminLayout>
  );
};

export default ApprovalsPage;
