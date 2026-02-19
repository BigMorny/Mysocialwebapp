import type { NextPage } from "next";
import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Field";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

type AuditRow = {
  id: string;
  action: string;
  targetType: "SHOP" | "PAYMENT_REQUEST" | "SUPPORT";
  targetId: string;
  metaJson: Record<string, unknown> | null;
  createdAt: string;
  adminUser: { name: string | null; email: string | null; phone: string | null };
};

const AuditPage: NextPage = () => {
  const { push: toast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [limit, setLimit] = useState("100");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<AuditRow[]>(`/api/admin/audit?limit=${Number(limit || 100)}`);
      setRows(data);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load audit log" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <div className="flex items-center gap-2">
            <Input className="w-32" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
            <button className="btn-outline" onClick={() => void load()} type="button">Reload</button>
          </div>
        </div>

        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-3 py-3">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-3">{r.action}</td>
                  <td className="px-3 py-3">{r.targetType}: {r.targetId}</td>
                  <td className="px-3 py-3">{r.adminUser?.name ?? r.adminUser?.email ?? r.adminUser?.phone ?? "-"}</td>
                  <td className="px-3 py-3 break-all text-xs text-slate-600 dark:text-slate-400">{r.metaJson ? JSON.stringify(r.metaJson) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 ? <p className="px-2 py-4 text-sm text-slate-600 dark:text-slate-400">No audit entries.</p> : null}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AuditPage;
