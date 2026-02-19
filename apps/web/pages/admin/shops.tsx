import type { NextPage } from "next";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input, Select } from "../../components/ui/Field";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

type ShopRow = {
  id: string;
  name: string;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "VIEW_ONLY";
  trialEndsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  pendingApprovals: number;
};

type Action =
  | { type: "ACTIVATE"; shop: ShopRow }
  | { type: "EXTEND_TRIAL"; shop: ShopRow }
  | { type: "SUSPEND"; shop: ShopRow }
  | { type: "DELETE"; shop: ShopRow };

const ShopsPage: NextPage = () => {
  const { push: toast } = useToast();
  const [rows, setRows] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "ACTIVE" | "VIEW_ONLY">("ALL");
  const [action, setAction] = useState<Action | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [amountGhs, setAmountGhs] = useState("");
  const [reason, setReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<ShopRow[]>("/api/admin/shops");
      setRows(data);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load shops" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchSearch =
        !q ||
        [r.name, r.ownerName, r.phone, r.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchFilter =
        filter === "ALL" ||
        (filter === "PENDING" && r.pendingApprovals > 0) ||
        (filter === "ACTIVE" && r.subscriptionStatus === "ACTIVE") ||
        (filter === "VIEW_ONLY" && r.subscriptionStatus === "VIEW_ONLY");
      return matchSearch && matchFilter;
    });
  }, [rows, search, filter]);

  const executeAction = async () => {
    if (!action) return;
    setActing(true);
    try {
      if (action.type === "ACTIVATE") {
        await apiJson(`/api/admin/shops/${action.shop.id}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycle, amountGhs: amountGhs ? Number(amountGhs) : undefined }),
        });
        toast({ kind: "success", text: "Shop activated." });
      }
      if (action.type === "EXTEND_TRIAL") {
        await apiJson(`/api/admin/shops/${action.shop.id}/extend-trial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: 7 }),
        });
        toast({ kind: "success", text: "Trial extended." });
      }
      if (action.type === "SUSPEND") {
        await apiJson(`/api/admin/shops/${action.shop.id}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason || undefined }),
        });
        toast({ kind: "success", text: "Shop suspended." });
      }
      if (action.type === "DELETE") {
        await apiJson(`/api/admin/shops/${action.shop.id}`, { method: "DELETE" });
        toast({ kind: "success", text: "Shop deleted permanently." });
      }
      setAction(null);
      setCycle("MONTHLY");
      setAmountGhs("");
      setReason("");
      setDeleteConfirmText("");
      await load();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Action failed" });
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Shops</h1>
          <div className="flex flex-wrap gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shop/owner/phone/email" className="w-64" />
            <Select value={filter} onChange={(e) => setFilter(e.target.value as "ALL" | "PENDING" | "ACTIVE" | "VIEW_ONLY")} className="w-44">
              <option value="ALL">All</option>
              <option value="PENDING">Pending approvals</option>
              <option value="ACTIVE">Active</option>
              <option value="VIEW_ONLY">View-only</option>
            </Select>
          </div>
        </div>

        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="px-3 py-2">Shop / Owner</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Key dates</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="table-row align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{r.ownerName ?? "-"}</p>
                  </td>
                  <td className="px-3 py-3">{r.phone ?? "-"}</td>
                  <td className="px-3 py-3">{r.email ?? "-"}</td>
                  <td className="px-3 py-3">
                    <Badge kind={r.subscriptionStatus === "ACTIVE" ? "success" : r.subscriptionStatus === "TRIALING" ? "info" : "warning"}>
                      {r.subscriptionStatus}
                    </Badge>
                    {r.pendingApprovals > 0 ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Pending approvals: {r.pendingApprovals}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Trial ends: {r.trialEndsAt ? new Date(r.trialEndsAt).toLocaleDateString() : "-"}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Subscription ends: {r.endsAt ? new Date(r.endsAt).toLocaleDateString() : "-"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button className="h-9" onClick={() => setAction({ type: "ACTIVATE", shop: r })}>Activate</Button>
                      <Button variant="secondary" className="h-9" onClick={() => setAction({ type: "EXTEND_TRIAL", shop: r })}>Extend Trial</Button>
                      <Button variant="danger" className="h-9" onClick={() => setAction({ type: "SUSPEND", shop: r })}>Suspend</Button>
                      <Button variant="danger" className="h-9" onClick={() => setAction({ type: "DELETE", shop: r })}>Delete shop</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-600 dark:text-slate-400">No shops found.</p>
          ) : null}
        </Card>
      </div>

      {action && action.type === "ACTIVATE" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 dark:bg-slate-950/70">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold">Activate shop subscription</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{action.shop.name}</p>
            <div className="mt-3 grid gap-3">
              <Select value={cycle} onChange={(e) => setCycle(e.target.value as "MONTHLY" | "ANNUAL")}>
                <option value="MONTHLY">MONTHLY</option>
                <option value="ANNUAL">ANNUAL</option>
              </Select>
              <p className="text-xs text-slate-600 dark:text-slate-400">Duration is automatic: MONTHLY = 30 days, ANNUAL = 365 days.</p>
              <Input type="number" value={amountGhs} onChange={(e) => setAmountGhs(e.target.value)} placeholder="Amount GHS (optional)" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAction(null)} disabled={acting}>Cancel</Button>
              <Button onClick={() => void executeAction()} loading={acting}>Activate</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {action && action.type === "EXTEND_TRIAL" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 dark:bg-slate-950/70">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold">Extend trial by 7 days</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              This will add 7 days to the current trial end date (or start from now if expired).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAction(null)} disabled={acting}>Cancel</Button>
              <Button onClick={() => void executeAction()} loading={acting}>Extend 7 days</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {action && action.type === "SUSPEND" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 dark:bg-slate-950/70">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold">Suspend shop</h3>
            <Input className="mt-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAction(null)} disabled={acting}>Cancel</Button>
              <Button variant="danger" onClick={() => void executeAction()} loading={acting}>Suspend</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {action && action.type === "DELETE" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 dark:bg-slate-950/70">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Delete shop permanently</h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              This will permanently delete this shop and all data.
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Type <span className="font-semibold">{action.shop.name}</span> or <span className="font-semibold">DELETE</span> to confirm.
            </p>
            <Input className="mt-3" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type shop name or DELETE" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setAction(null); setDeleteConfirmText(""); }} disabled={acting}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => void executeAction()}
                loading={acting}
                disabled={deleteConfirmText.trim() !== action.shop.name && deleteConfirmText.trim().toUpperCase() !== "DELETE"}
              >
                Delete shop
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

    </AdminLayout>
  );
};

export default ShopsPage;
