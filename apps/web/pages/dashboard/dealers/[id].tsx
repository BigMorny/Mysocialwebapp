import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout, useDashboardShell } from "../../../components/DashboardLayout";
import { Badge } from "../../../components/ui/Badge";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useToast } from "../../../components/providers/ToastProvider";
import { apiJson } from "../../../lib/api";

type Dealer = {
  id: string;
  name: string;
  phone: string;
  locationNote?: string | null;
  idType?: string | null;
  idNumber?: string | null;
};

type Consignment = {
  id: string;
  status: "OUT_WITH_DEALER" | "SOLD" | "RETURNED" | "LOST";
  expectedReturnAt?: string | null;
  dealer: { id: string; name: string };
  inventoryItem: { brand: string; model: string; storage?: string | null; status: string };
};

const statusKind: Record<Consignment["status"], "warning" | "success" | "info" | "danger"> = {
  OUT_WITH_DEALER: "warning",
  SOLD: "success",
  RETURNED: "info",
  LOST: "danger",
};

function DealerDetailsBody() {
  const router = useRouter();
  const { id } = router.query;
  const { viewOnly, refreshSummary } = useDashboardShell();
  const { push: toast } = useToast();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (dealerId: string) => {
    setLoading(true);
    try {
      const [dealerRes, consignRes] = await Promise.all([
        apiJson<Dealer>(`/api/dealers/${dealerId}`),
        apiJson<Consignment[]>(`/api/consignments?dealerId=${dealerId}`),
      ]);
      setDealer(dealerRes);
      setConsignments(consignRes);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load dealer details" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof id === "string") void load(id);
  }, [id]);

  const active = useMemo(() => consignments.filter((c) => c.status === "OUT_WITH_DEALER"), [consignments]);
  const closed = useMemo(() => consignments.filter((c) => c.status !== "OUT_WITH_DEALER").slice(0, 10), [consignments]);

  const markStatus = async (consignmentId: string, status: "SOLD" | "RETURNED" | "LOST") => {
    if (viewOnly) return;
    try {
      await apiJson(`/api/consignments/${consignmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast({ kind: "success", text: `Marked ${status}` });
      if (typeof id === "string") await load(id);
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to update status" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dealer details</h1>
        <Link href="/dashboard/dealers" className="text-sm font-semibold text-brand-600 dark:text-brand-300">Back to Dealers</Link>
      </div>

      {viewOnly && <Banner kind="warning">View-only mode: status updates are disabled.</Banner>}

      <Card>
        <h2 className="text-lg font-semibold">{dealer?.name ?? "Dealer"}</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <p>Phone: <span className="font-medium">{dealer?.phone ?? "-"}</span></p>
          <p>Location: <span className="font-medium">{dealer?.locationNote ?? "-"}</span></p>
          <p>ID Type: <span className="font-medium">{dealer?.idType ?? "-"}</span></p>
          <p>ID Number: <span className="font-medium">{dealer?.idNumber ?? "-"}</span></p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Active consignments ({active.length})</h2>
        <div className="mt-3 space-y-3">
          {active.map((c) => {
            const overdue = c.expectedReturnAt && Date.now() > new Date(c.expectedReturnAt).getTime();
            return (
              <div key={c.id} className={`rounded-xl border p-3 ${overdue ? "border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10" : "border-slate-200 dark:border-slate-800"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.inventoryItem.brand} {c.inventoryItem.model} {c.inventoryItem.storage ? `(${c.inventoryItem.storage})` : ""}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Expected: {c.expectedReturnAt ? new Date(c.expectedReturnAt).toLocaleString() : "-"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Badge kind={statusKind[c.status]}>{c.status}</Badge>
                    {overdue ? <Badge kind="danger">OVERDUE</Badge> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="h-9" onClick={() => void markStatus(c.id, "SOLD")} disabled={viewOnly}>Mark SOLD</Button>
                  <Button variant="secondary" className="h-9" onClick={() => void markStatus(c.id, "RETURNED")} disabled={viewOnly}>RETURNED</Button>
                  <Button variant="danger" className="h-9" onClick={() => void markStatus(c.id, "LOST")} disabled={viewOnly}>LOST</Button>
                </div>
              </div>
            );
          })}
          {!active.length && <p className="text-sm text-slate-600 dark:text-slate-400">No active consignments.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Recent closed consignments</h2>
        <div className="mt-3 space-y-2">
          {closed.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{c.inventoryItem.brand} {c.inventoryItem.model}</p>
                <Badge kind={statusKind[c.status]}>{c.status}</Badge>
              </div>
            </div>
          ))}
          {!closed.length && <p className="text-sm text-slate-600 dark:text-slate-400">No closed consignments yet.</p>}
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-600 dark:text-slate-400">Loading dealer details...</p>}
    </div>
  );
}

const DealerDetailsPage: NextPage = () => (
  <DashboardLayout>
    <DealerDetailsBody />
  </DashboardLayout>
);

export default DealerDetailsPage;
