import Link from "next/link";
import { useRouter } from "next/router";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { CreditCard, FileClock, LifeBuoy, LogOut, ShieldCheck, Store, Users } from "lucide-react";
import { apiJson, ApiError } from "../lib/api";
import { logoutRequest } from "../lib/logout";
import { useToast } from "./providers/ToastProvider";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Field";

type MeResponse = {
  user: { id: string; isAdmin: boolean; name: string | null };
};

type Stats = {
  pendingApprovals: number;
  expiredShops: number;
};

const nav = [
  { href: "/admin/approvals", label: "Approvals", icon: CreditCard },
  { href: "/admin/shops", label: "Shops", icon: Store },
  { href: "/admin/audit", label: "Audit Log", icon: FileClock },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/approvals", label: "Payment", icon: ShieldCheck },
] as const;

export function AdminLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const { push: toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pendingApprovals: 0, expiredShops: 0 });
  const [loggingOut, setLoggingOut] = useState(false);

  const active = (href: string) =>
    router.pathname === href
      ? "bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-300"
      : "text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800";

  const load = async () => {
    setLoading(true);
    try {
      const me = await apiJson<MeResponse>("/api/auth/me");
      if (!me.user?.isAdmin) {
        await router.replace("/dashboard");
        return;
      }
      setIsAdmin(true);
      const status = await apiJson<{ verified: boolean }>("/api/admin/verification-status", undefined, { redirectOn401: false });
      setVerified(Boolean(status.verified));
      if (status.verified) {
        const s = await apiJson<Stats>("/api/admin/stats");
        setStats(s);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load admin" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [router.asPath]);

  const verifyPassword = async () => {
    setVerifyError(null);
    setVerifying(true);
    try {
      await apiJson("/api/admin/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }, { redirectOn401: false });
      setVerified(true);
      setPassword("");
      const s = await apiJson<Stats>("/api/admin/stats");
      setStats(s);
      toast({ kind: "success", text: "Admin verified." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid admin password";
      setVerifyError(message);
      toast({ kind: "error", text: message });
    } finally {
      setVerifying(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await logoutRequest();
      await router.push("/login");
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Logout failed." });
    } finally {
      setLoggingOut(false);
    }
  };

  const page = useMemo(() => children, [children]);

  if (loading || !isAdmin) {
    return <main className="min-h-screen grid place-items-center text-sm text-slate-600 dark:text-slate-300">Loading admin...</main>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex">
      <aside className="w-full border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <p className="text-lg font-bold">MySocial Admin</p>
        </div>
        <nav className="space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={`${item.label}-${item.href}`} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active(item.href)}`}>
                <Icon className="h-4.5 w-4.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
            <LogOut className="h-4.5 w-4.5" />
            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-100/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <p className="text-lg font-bold">MySocial Admin</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge kind="warning">{`Pending ${stats.pendingApprovals}`}</Badge>
              <Badge kind="info">{`Expired ${stats.expiredShops}`}</Badge>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{page}</main>
      </div>

      {!verified ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 dark:bg-slate-950/70">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-semibold">Enter Admin Password</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Admin verification is required for admin tools.</p>
            <div className="mt-4 space-y-3">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" />
              {verifyError ? <p className="text-sm text-rose-600 dark:text-rose-300">{verifyError}</p> : null}
              <div className="flex justify-end">
                <Button onClick={() => void verifyPassword()} loading={verifying} disabled={!password}>Verify</Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
