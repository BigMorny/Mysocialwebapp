import type { NextPage } from "next";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Banner } from "../../components/ui/Banner";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Field";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

type ReportResponse = {
  range: { start: string; end: string };
  categories: {
    PHONE: { added: number; sold: number; remaining: number };
    LAPTOP: { added: number; sold: number; remaining: number };
    GADGET: { added: number; sold: number; remaining: number };
  };
  breakdown: {
    phonesByModel: Array<{ brand: string; model: string; total: number; sold: number; remaining: number }>;
    laptopsByModel: Array<{ brand: string; model: string; total: number; sold: number; remaining: number }>;
    gadgetsByType: Array<{ gadgetType: string; total: number; sold: number; remaining: number }>;
  };
};

const ReportsPage: NextPage = () => {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { push: toast } = useToast();

  const load = async (y: string, m: string) => {
    setLoading(true);
    try {
      const data = await apiJson<ReportResponse>(`/api/reports/monthly?year=${y}&month=${m}`);
      setData(data);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load report" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(year, month);
  }, [year, month]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2025, i, 1).toLocaleString(undefined, { month: "long" }) })),
    [],
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Monthly Reports</h1>
          <div className="flex gap-2">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-40">
              {months.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </Select>
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-28">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </Select>
          </div>
        </div>

        <Banner kind="info">Remaining is calculated against current inventory status (status != SOLD).</Banner>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["PHONE", "LAPTOP", "GADGET"] as const).map((key) => (
            <Card key={key}>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{key}</p>
              <div className="mt-3 space-y-2 text-sm">
                <p>Added: <span className="font-semibold">{data?.categories[key].added ?? 0}</span></p>
                <p>Sold: <span className="font-semibold">{data?.categories[key].sold ?? 0}</span></p>
                <p>Remaining: <span className="font-semibold">{data?.categories[key].remaining ?? 0}</span></p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold">Phones by model</h2>
            <div className="mt-3 space-y-2">
              {data?.breakdown.phonesByModel.slice(0, 12).map((row) => (
                <div key={`${row.brand}-${row.model}`} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{row.brand} {row.model}</p>
                  <p className="text-slate-600 dark:text-slate-400">Total {row.total} | Sold {row.sold} | Remaining {row.remaining}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Laptops by model</h2>
            <div className="mt-3 space-y-2">
              {data?.breakdown.laptopsByModel.slice(0, 12).map((row) => (
                <div key={`${row.brand}-${row.model}`} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{row.brand} {row.model}</p>
                  <p className="text-slate-600 dark:text-slate-400">Total {row.total} | Sold {row.sold} | Remaining {row.remaining}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Gadgets by type</h2>
            <div className="mt-3 space-y-2">
              {data?.breakdown.gadgetsByType.slice(0, 12).map((row) => (
                <div key={row.gadgetType} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{row.gadgetType}</p>
                  <p className="text-slate-600 dark:text-slate-400">Total {row.total} | Sold {row.sold} | Remaining {row.remaining}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {loading && <p className="text-sm text-slate-600 dark:text-slate-400">Loading report...</p>}
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
