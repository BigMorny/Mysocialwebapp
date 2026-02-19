import type { NextPage } from "next";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout, useDashboardShell } from "../../components/DashboardLayout";
import { Badge } from "../../components/ui/Badge";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Field";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson, API_BASE_URL } from "../../lib/api";

type InventoryItem = { id: string; brand: string; model: string; status: string };
type Dealer = { id: string; name: string };
type Consignment = {
  id: string;
  status: "OUT_WITH_DEALER" | "SOLD" | "RETURNED" | "LOST";
  expectedReturnAt?: string | null;
  agreedPrice?: number | null;
  soldPrice?: number | null;
  handedOutAt: string;
  dealer: { id: string; name: string; phone: string };
  inventoryItem: { id: string; name: string; category: string; status: string };
};

const statusKind: Record<Consignment["status"], "warning" | "success" | "info" | "danger"> = {
  OUT_WITH_DEALER: "warning",
  SOLD: "success",
  RETURNED: "info",
  LOST: "danger",
};

function ConsignmentBody() {
  const { push: toast } = useToast();
  const { viewOnly, refreshSummary } = useDashboardShell();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(false);

  const [inventoryItemId, setInventoryItemId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [expectedPresetHours, setExpectedPresetHours] = useState("");
  const [notes, setNotes] = useState("");

  const now = Date.now();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [invRes, dealerRes, consRes] = await Promise.all([
        apiJson<InventoryItem[]>("/api/inventory"),
        apiJson<Dealer[]>("/api/dealers"),
        apiJson<Consignment[]>("/api/consignments"),
      ]);
      setInventory(invRes.filter((item) => item.status === "IN_SHOP"));
      setDealers(dealerRes);
      setConsignments(consRes);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load consignments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const canCreate = dealers.length > 0 && inventory.length > 0;

  const createConsignment = async (e: FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    if (!canCreate) {
      toast({ kind: "error", text: dealers.length === 0 ? "Add a dealer first." : "Add inventory in shop first." });
      return;
    }

    try {
      await apiJson("/api/consignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryItemId,
          dealerId,
          agreedPrice: agreedPrice ? Number(agreedPrice) : null,
          expectedPresetHours: expectedPresetHours ? Number(expectedPresetHours) : undefined,
          expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : null,
          notes: notes || null,
        }),
      });
      toast({ kind: "success", text: "Consignment created." });
      setInventoryItemId("");
      setDealerId("");
      setAgreedPrice("");
      setExpectedPresetHours("");
      setExpectedReturnAt("");
      setNotes("");
      await loadAll();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to create consignment" });
    }
  };

  const markStatus = async (id: string, status: "SOLD" | "RETURNED" | "LOST") => {
    if (viewOnly) return;
    try {
      const soldPriceInput = status === "SOLD" ? window.prompt("Sold price (optional):") : null;
      await apiJson(`/api/consignments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, soldPrice: soldPriceInput ? Number(soldPriceInput) : null }),
      });
      toast({ kind: "success", text: `Consignment marked ${status}.` });
      await loadAll();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to update consignment" });
    }
  };

  const rows = useMemo(() => consignments.map((c) => ({ ...c, overdue: c.status === "OUT_WITH_DEALER" && !!c.expectedReturnAt && now > new Date(c.expectedReturnAt).getTime() })), [consignments, now]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Consignments</h1>
        <a href={`${API_BASE_URL}/api/export/consignments.csv`} className="btn-outline">Export CSV</a>
      </div>

      {viewOnly && <Banner kind="warning">View-only mode: creating and status updates are disabled.</Banner>}
      {!canCreate && !viewOnly && (
        <Banner kind="info">
          {dealers.length === 0 ? "Add a dealer before creating consignments." : "Add inventory in shop before creating consignments."}
        </Banner>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Create consignment</h2>
        <form onSubmit={createConsignment} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Dealer">
            <Select value={dealerId} onChange={(e) => setDealerId(e.target.value)} disabled={viewOnly || dealers.length === 0}>
              <option value="">Select dealer</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Inventory (IN_SHOP)">
            <Select value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)} disabled={viewOnly || inventory.length === 0}>
              <option value="">Select item</option>
              {inventory.map((i) => <option key={i.id} value={i.id}>{i.brand} {i.model}</option>)}
            </Select>
          </Field>
          <Field label="Agreed price"><Input type="number" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} /></Field>
          <Field label="Expected preset">
            <Select value={expectedPresetHours} onChange={(e) => setExpectedPresetHours(e.target.value)}>
              <option value="">Custom datetime</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
            </Select>
          </Field>
          <Field label="Expected return (custom)"><Input type="datetime-local" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} /></Field>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" disabled={viewOnly || !canCreate || !dealerId || !inventoryItemId}>Create consignment</Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card className="text-center text-slate-700 dark:text-slate-300">No consignments yet.</Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((c) => (
              <Card key={c.id} className={c.overdue ? "border-rose-500/40 bg-rose-500/10" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.dealer.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{c.inventoryItem.category} {c.inventoryItem.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Badge kind={statusKind[c.status]}>{c.status}</Badge>
                    {c.overdue && <Badge kind="danger">OVERDUE</Badge>}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Expected: {c.expectedReturnAt ? new Date(c.expectedReturnAt).toLocaleString() : "-"}</p>
                {c.status === "OUT_WITH_DEALER" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button className="h-9" onClick={() => void markStatus(c.id, "SOLD")} disabled={viewOnly}>Mark SOLD</Button>
                    <Button variant="secondary" className="h-9" onClick={() => void markStatus(c.id, "RETURNED")} disabled={viewOnly}>RETURNED</Button>
                    <Button variant="danger" className="h-9" onClick={() => void markStatus(c.id, "LOST")} disabled={viewOnly}>LOST</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-3 py-2">Dealer</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Expected return</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={`table-row ${c.overdue ? "bg-rose-100 dark:bg-rose-500/10" : ""}`}>
                    <td className="px-3 py-3">{c.dealer.name}</td>
                    <td className="px-3 py-3">{c.inventoryItem.category} {c.inventoryItem.name}</td>
                    <td className="px-3 py-3">{c.expectedReturnAt ? new Date(c.expectedReturnAt).toLocaleString() : "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <Badge kind={statusKind[c.status]}>{c.status}</Badge>
                        {c.overdue && <Badge kind="danger">OVERDUE</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {c.status === "OUT_WITH_DEALER" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button className="h-9" onClick={() => void markStatus(c.id, "SOLD")} disabled={viewOnly}>Mark SOLD</Button>
                          <Button variant="secondary" className="h-9" onClick={() => void markStatus(c.id, "RETURNED")} disabled={viewOnly}>RETURNED</Button>
                          <Button variant="danger" className="h-9" onClick={() => void markStatus(c.id, "LOST")} disabled={viewOnly}>LOST</Button>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {loading && <div className="text-sm text-slate-600 dark:text-slate-400">Loading...</div>}
    </div>
  );
}

const ConsignmentsPage: NextPage = () => (
  <DashboardLayout>
    <ConsignmentBody />
  </DashboardLayout>
);

export default ConsignmentsPage;
