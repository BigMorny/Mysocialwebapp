import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Boxes, CreditCard, FileBarChart2, Handshake, Plus, Search, Users } from "lucide-react";
import { DashboardLayout, useDashboardShell } from "../components/DashboardLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { apiJson } from "../lib/api";

type InventoryLite = {
  id: string;
  brand: string;
  model: string;
  storage?: string | null;
  condition: "NEW" | "USED" | string;
  imei?: string | null;
  serialNumber?: string | null;
  gadgetType?: string | null;
  status: "IN_SHOP" | "OUT_WITH_DEALER" | "SOLD";
  price: number;
};

function variantTitle(item: InventoryLite) {
  const condition = item.condition === "NEW" ? "New" : "Used";
  const model = item.model || item.gadgetType || "Item";
  return `${model}${item.storage ? ` - ${item.storage}` : ""} - ${condition}`;
}

function matchText(item: InventoryLite) {
  return [
    item.brand,
    item.model,
    item.storage,
    item.condition,
    item.imei,
    item.serialNumber,
    item.gadgetType,
    String(item.price ?? ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function DashboardBody() {
  const router = useRouter();
  const { summary } = useDashboardShell();
  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<InventoryLite[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const actions = [
    { label: "Add Inventory", href: "/dashboard/inventory", icon: Boxes },
    { label: "Add Dealer", href: "/dashboard/dealers", icon: Users },
    { label: "New Consignment", href: "/dashboard/consignments", icon: Handshake },
    { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
    { label: "Reports", href: "/dashboard/reports", icon: FileBarChart2 },
  ] as const;

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (inventory.length > 0) {
        setSearchOpen(true);
        return;
      }
      setLoadingSearch(true);
      try {
        const data = await apiJson<InventoryLite[]>("/api/inventory");
        setInventory(data);
        setSearchOpen(true);
      } catch {
        setSearchOpen(false);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inventory.length, query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return inventory.filter((item) => matchText(item).includes(q)).slice(0, 8);
  }, [inventory, query]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="relative">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim()) setSearchOpen(true);
            }}
            placeholder="Search inventory (model, storage, IMEI/serial)..."
            className="w-full"
          />
        </div>

        {searchOpen && query.trim() ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-xl border border-slate-200 bg-white p-2 shadow-soft dark:border-slate-700 dark:bg-slate-900">
            {loadingSearch ? <p className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400">Searching...</p> : null}
            {!loadingSearch && results.length === 0 ? (
              <p className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400">No matches found.</p>
            ) : null}
            <div className="space-y-1">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void router.push({
                      pathname: "/dashboard/inventory",
                      query: {
                        itemId: item.id,
                        model: item.model || undefined,
                        storage: item.storage || undefined,
                        condition: item.condition === "NEW" ? "NEW" : "USED",
                      },
                    });
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{variantTitle(item)}</p>
                    <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {(item.imei || item.serialNumber || "-")} - GHS {Number(item.price || 0)}
                    </p>
                  </div>
                  <Badge kind={item.status === "IN_SHOP" ? "success" : item.status === "OUT_WITH_DEALER" ? "warning" : "info"}>
                    {item.status}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Inventory</p><p className="mt-2 text-3xl font-bold">{summary?.counts.inventory ?? 0}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">With Dealer</p><p className="mt-2 text-3xl font-bold">{summary?.counts.consignments ?? 0}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Overdue</p><p className="mt-2 text-3xl font-bold text-rose-700 dark:text-rose-300">{summary?.counts.overdueConsignments ?? 0}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Dealers</p><p className="mt-2 text-3xl font-bold">{summary?.counts.dealers ?? 0}</p></Card>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-brand-400" />
          <h2 className="text-xl font-semibold">Quick Actions</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900">
                <div className="mb-4 inline-flex rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                  <Icon className="h-4.5 w-4.5 text-brand-700 dark:text-brand-300" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{action.label}</p>
                  <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-slate-800 dark:group-hover:text-slate-200" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 sm:hidden">
          <Link href="/dashboard/inventory">
            <Button className="w-full">Go to inventory</Button>
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Shop Snapshot</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-sm text-slate-500 dark:text-slate-400">Shop phone</p>
            <p className="mt-1 break-words text-base font-semibold">{summary?.shop?.phone ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-sm text-slate-500 dark:text-slate-400">Location</p>
            <p className="mt-1 break-words text-base font-semibold">{summary?.shop?.locationNote ?? "Not set"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Need to manage subscription?</p>
              <Link href="/dashboard/billing">
                <Button variant="secondary" className="h-10">Open Billing</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const DashboardPage: NextPage = () => (
  <DashboardLayout>
    <DashboardBody />
  </DashboardLayout>
);

export default DashboardPage;
