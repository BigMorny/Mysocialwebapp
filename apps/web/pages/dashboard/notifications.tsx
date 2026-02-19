import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson } from "../../lib/api";

type Notification = {
  id: string;
  message: string;
  type: string;
  consignmentId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

function NotificationsBody() {
  const { push: toast } = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Notification[]>("/api/notifications");
      setItems(data);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load notifications" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiJson(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      toast({ kind: "success", text: "Notification marked as read." });
      await load();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to mark read" });
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>

      {items.length === 0 ? (
        <Card className="text-center text-slate-700 dark:text-slate-300">No notifications.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {!n.readAt && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />}
                  <p className="font-medium break-words">{n.message}</p>
                  <Badge kind={n.readAt ? "info" : "warning"}>{n.readAt ? "READ" : "UNREAD"}</Badge>
                </div>
                <p className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
                {n.consignmentId && (
                  <Link className="text-xs font-semibold text-brand-700 underline dark:text-brand-300" href="/dashboard/consignments">
                    View related consignment
                  </Link>
                )}
              </div>
              <Button variant="secondary" className="h-9" disabled={Boolean(n.readAt)} onClick={() => void markRead(n.id)}>
                {n.readAt ? "Already read" : "Mark as read"}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {loading && <div className="text-sm text-slate-600 dark:text-slate-400">Loading...</div>}
    </div>
  );
}

const NotificationsPage: NextPage = () => (
  <DashboardLayout>
    <NotificationsBody />
  </DashboardLayout>
);

export default NotificationsPage;
