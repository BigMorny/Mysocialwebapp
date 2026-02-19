import Link from "next/link";
import { useRouter } from "next/router";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  ChevronDown,
  CreditCard,
  FileBarChart2,
  Handshake,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Store,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { logoutRequest } from "../lib/logout";
import { apiJson, ApiError } from "../lib/api";
import { useToast } from "./providers/ToastProvider";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Banner } from "./ui/Banner";

type Summary = {
  user: { id: string; isAdmin: boolean };
  shop: { id: string; name: string; phone: string; locationNote?: string | null } | null;
  subscription: { status: string; trialEndsAt?: string | null; viewOnly?: boolean } | null;
  counts: { inventory: number; dealers: number; consignments: number; overdueConsignments: number };
  unreadNotifications: number;
};

type DashboardCtxType = {
  summary: Summary | null;
  loadingSummary: boolean;
  viewOnly: boolean;
  refreshSummary: () => Promise<void>;
};

const DashboardCtx = createContext<DashboardCtxType | null>(null);

export function useDashboardShell() {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboardShell must be used within DashboardLayout");
  return ctx;
}

const navBase = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/dealers", label: "Dealers", icon: Users },
  { href: "/dashboard/consignments", label: "Consignments", icon: Handshake },
  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle2 },
] as const;
export function DashboardLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadSummary = async () => {
    try {
      const me = await apiJson<{ user: { isAdmin?: boolean } }>("/api/auth/me");
      if (me?.user?.isAdmin) {
        await router.replace("/admin");
        return;
      }
      const data = await apiJson<Summary>("/api/dashboard/summary");
      setSummary(data);
    } catch (error) {
      setSummary(null);
      if (!(error instanceof ApiError && error.status === 401)) {
        pushToast({ kind: "error", text: "Cannot reach API server. Ensure backend is running on port 4000." });
      }
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    void loadSummary();
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [router.asPath]);

  const viewOnly = Boolean(summary?.subscription?.viewOnly);
  const badgeKind = summary?.subscription?.status === "ACTIVE" ? "success" : viewOnly ? "warning" : "info";

  const nav = useMemo(
    () => [
      ...navBase,
      ...(summary?.user?.isAdmin
        ? [{ href: "/dashboard/admin/payments", label: "Payments", icon: ShieldCheck } as const]
        : []),
    ],
    [summary?.user?.isAdmin],
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutRequest();
      await router.push("/login");
    } catch (error) {
      pushToast({ kind: "error", text: error instanceof Error ? error.message : "Logout failed." });
    } finally {
      setLoggingOut(false);
    }
  };

  const active = (href: string) =>
    router.pathname === href
      ? "bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-300"
      : "text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100";

  return (
    <DashboardCtx.Provider value={{ summary, loadingSummary, viewOnly, refreshSummary: loadSummary }}>
      <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
          <div className="mb-6 flex items-center gap-2.5">
            <Store className="h-5 w-5 text-brand-500 dark:text-brand-400" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">MySocial</h1>
          </div>
          <nav className="space-y-1.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(item.href)}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-100/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5 lg:px-7">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  className="btn-base h-10 w-10 rounded-lg border border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  type="button"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4.5 w-4.5" />
                </button>
                <p className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {summary?.shop?.name ?? "My Shop"}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Badge kind={badgeKind}>{viewOnly ? "VIEW-ONLY" : summary?.subscription?.status ?? "UNKNOWN"}</Badge>
                <Link href="/dashboard/notifications" className="chip-muted inline-flex items-center gap-2 rounded-lg px-2.5 py-2 sm:text-sm">
                  <Bell className="h-4 w-4" />
                  <span>{summary?.unreadNotifications ?? 0}</span>
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    className="chip-muted inline-flex items-center gap-1 rounded-lg px-2.5 py-2 sm:text-sm"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    Account
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-soft dark:border-slate-700 dark:bg-slate-900">
                      <Link href="/dashboard/profile" className="block rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        disabled={loggingOut}
                      >
                        {loggingOut ? "Logging out..." : "Log out"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {viewOnly && (
              <div className="px-3 pb-3 sm:px-5 lg:px-7">
                <Banner kind="warning">
                  View-only mode is active. To re-enable actions, go to{" "}
                  <Link href="/dashboard/billing" className="underline">
                    Billing
                  </Link>
                  .
                </Banner>
              </div>
            )}
          </header>

          <main className="min-w-0 p-3 sm:p-5 lg:p-7">
            {loadingSummary || !summary ? (
              <div className="panel p-6 text-sm text-slate-600 dark:text-slate-300">Loading dashboard...</div>
            ) : (
              children
            )}
          </main>
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-slate-950/80 lg:hidden" onClick={() => setMobileNavOpen(false)}>
            <aside className="h-full w-72 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-brand-500 dark:text-brand-400" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">MySocial</h2>
                </div>
                <Button variant="secondary" className="h-9 px-3" onClick={() => setMobileNavOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="space-y-1.5">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active(item.href)}`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}
      </div>
    </DashboardCtx.Provider>
  );
}
