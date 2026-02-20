import type { NextPage } from "next";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout, useDashboardShell } from "../../components/DashboardLayout";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/Field";
import { ModalConfirm } from "../../components/ui/ModalConfirm";
import { useToast } from "../../components/providers/ToastProvider";
import { apiJson, API_BASE_URL } from "../../lib/api";

type Dealer = {
  id: string;
  name: string;
  phone: string;
  locationNote?: string | null;
  idType?: string | null;
  idNumber?: string | null;
};

type Consignment = { id: string; dealerId: string; status: string };

function DealersBody() {
  const { push: toast } = useToast();
  const { viewOnly, refreshSummary } = useDashboardShell();

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", locationNote: "", idType: "", idNumber: "" });

  const [deleteTarget, setDeleteTarget] = useState<Dealer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeCount = useMemo(() => {
    const map = new Map<string, number>();
    consignments.forEach((c) => {
      if (c.status === "OUT_WITH_DEALER") map.set(c.dealerId, (map.get(c.dealerId) ?? 0) + 1);
    });
    return map;
  }, [consignments]);

  const load = async () => {
    setLoading(true);
    try {
      const [dealerRes, consRes] = await Promise.all([
        apiJson<Dealer[]>("/api/dealers"),
        apiJson<Consignment[]>("/api/consignments?status=OUT_WITH_DEALER"),
      ]);
      setDealers(dealerRes);
      setConsignments(consRes);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load dealers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addDealer = async (e: FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    try {
      await apiJson("/api/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, locationNote: locationNote || null, idType: idType || null, idNumber: idNumber || null }),
      });
      toast({ kind: "success", text: "Dealer added." });
      setName("");
      setPhone("");
      setLocationNote("");
      setIdType("");
      setIdNumber("");
      setShowAdd(false);
      await load();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to add dealer" });
    }
  };

  const startEdit = (dealer: Dealer) => {
    setEditingId(dealer.id);
    setEditForm({
      name: dealer.name,
      phone: dealer.phone,
      locationNote: dealer.locationNote ?? "",
      idType: dealer.idType ?? "",
      idNumber: dealer.idNumber ?? "",
    });
  };

  const saveEdit = async (id: string) => {
    if (viewOnly) return;
    try {
      await apiJson(`/api/dealers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          locationNote: editForm.locationNote || null,
          idType: editForm.idType || null,
          idNumber: editForm.idNumber || null,
        }),
      });
      toast({ kind: "success", text: "Dealer updated." });
      setEditingId(null);
      await load();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to update dealer" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || viewOnly) return;
    setDeleting(true);
    try {
      await apiJson(`/api/dealers/${deleteTarget.id}`, { method: "DELETE" });
      toast({ kind: "success", text: "Dealer deleted." });
      setDeleteTarget(null);
      await load();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to delete dealer" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Dealers</h1>
        <div className="flex gap-2">
          <a href={`${API_BASE_URL}/api/export/dealers.csv`} className="btn-outline">Export CSV</a>
          <Button onClick={() => setShowAdd((v) => !v)} disabled={viewOnly}>{showAdd ? "Close" : "Add Dealer"}</Button>
        </div>
      </div>

      {viewOnly && <Banner kind="warning">View-only mode: dealer create/edit/delete actions are disabled.</Banner>}

      {showAdd && (
        <Card>
          <form onSubmit={addDealer} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Location note"><Input value={locationNote} onChange={(e) => setLocationNote(e.target.value)} /></Field>
            <Field label="ID type"><Input value={idType} onChange={(e) => setIdType(e.target.value)} /></Field>
            <Field label="ID number"><Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></Field>
            <div className="md:col-span-2 flex justify-end"><Button type="submit">Save Dealer</Button></div>
          </form>
        </Card>
      )}

      {dealers.length === 0 ? (
        <Card className="text-center">
          <p className="text-slate-700 dark:text-slate-300">Add your first dealer to start consignments.</p>
          <div className="mt-3"><Button onClick={() => setShowAdd(true)} disabled={viewOnly}>Add first dealer</Button></div>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {dealers.map((d) => (
              <Card key={d.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{d.phone}</p>
                  </div>
                  <span className="chip-muted">Active {activeCount.get(d.id) ?? 0}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-500">{d.locationNote || "No location note"}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/dealers/${d.id}`}><Button variant="secondary" className="h-9">View</Button></Link>
                  {editingId === d.id ? (
                    <>
                      <Button className="h-9" onClick={() => void saveEdit(d.id)} disabled={viewOnly}>Save</Button>
                      <Button variant="secondary" className="h-9" onClick={() => setEditingId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" className="h-9" onClick={() => startEdit(d)} disabled={viewOnly}>Edit</Button>
                      <Button variant="danger" className="h-9" onClick={() => setDeleteTarget(d)} disabled={viewOnly}>Delete</Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-3 py-2">Dealer</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Location/ID</th>
                  <th className="px-3 py-2">Active consignments</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d) => (
                  <tr key={d.id} className="table-row align-top">
                    <td className="px-3 py-3">
                      {editingId === d.id ? <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} /> : <p className="font-semibold">{d.name}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === d.id ? <Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /> : <p>{d.phone}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === d.id ? (
                        <div className="grid gap-2">
                          <Input value={editForm.locationNote} onChange={(e) => setEditForm((p) => ({ ...p, locationNote: e.target.value }))} placeholder="Location" />
                          <Input value={editForm.idType} onChange={(e) => setEditForm((p) => ({ ...p, idType: e.target.value }))} placeholder="ID type" />
                          <Input value={editForm.idNumber} onChange={(e) => setEditForm((p) => ({ ...p, idNumber: e.target.value }))} placeholder="ID number" />
                        </div>
                      ) : (
                        <div className="text-slate-700 dark:text-slate-300">
                          <p>{d.locationNote ?? "-"}</p>
                          <p className="text-xs">{d.idType ?? ""} {d.idNumber ?? ""}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">{activeCount.get(d.id) ?? 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/dealers/${d.id}`}><Button variant="secondary" className="h-9">View</Button></Link>
                        {editingId === d.id ? (
                          <>
                            <Button className="h-9" onClick={() => void saveEdit(d.id)} disabled={viewOnly}>Save</Button>
                            <Button variant="secondary" className="h-9" onClick={() => setEditingId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="secondary" className="h-9" onClick={() => startEdit(d)} disabled={viewOnly}>Edit</Button>
                            <Button variant="danger" className="h-9" onClick={() => setDeleteTarget(d)} disabled={viewOnly}>Delete</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <ModalConfirm
        open={Boolean(deleteTarget)}
        title="Delete dealer"
        description={`Delete dealer ${deleteTarget?.name ?? ""}? Active consignments will block deletion.`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      {loading && <div className="text-sm text-slate-600 dark:text-slate-400">Loading...</div>}
    </div>
  );
}

const DealersPage: NextPage = () => (
  <DashboardLayout>
    <DealersBody />
  </DashboardLayout>
);

export default DealersPage;
