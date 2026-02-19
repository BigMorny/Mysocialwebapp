import type { NextPage } from "next";
import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Select } from "../../components/ui/Field";
import { apiJson } from "../../lib/api";

type InventoryItem = { id: string; brand: string; model: string };
type Dealer = { id: string; name: string };
type AssignmentRow = {
  id: string;
  assignedAt: string;
  inventory: { id: string; brand: string; model: string };
  dealer: { id: string; name: string };
};

const AssignmentsPage: NextPage = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [inventoryId, setInventoryId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadInventory = async () => {
    const data = await apiJson<any[]>("/api/inventory");
    setInventory(data.map((i: any) => ({ id: i.id, brand: i.brand, model: i.model })));
  };

  const loadDealers = async () => {
    const data = await apiJson<Dealer[]>("/api/dealers");
    setDealers(data);
  };

  const loadAssignments = async () => {
    try {
      const data = await apiJson<AssignmentRow[]>("/api/assignments");
      setAssignments(data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load assignments");
    }
  };

  useEffect(() => {
    void loadInventory();
    void loadDealers();
    void loadAssignments();
  }, []);

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await apiJson("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, dealerId }),
      });
      await loadAssignments();
      setMessage("Device assigned.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to assign device");
      return;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        {message && <Banner kind="info">{message}</Banner>}

        <Card>
          <h2 className="text-lg font-semibold">Assign device to dealer</h2>
          <form onSubmit={handleAssign} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Inventory">
              <Select value={inventoryId} onChange={(e) => setInventoryId(e.target.value)}>
                <option value="">Select inventory</option>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.brand} {i.model}</option>)}
              </Select>
            </Field>
            <Field label="Dealer">
              <Select value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
                <option value="">Select dealer</option>
                {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Assign</Button>
            </div>
          </form>
        </Card>

        <Card className="overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold">Assignment history</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">Dealer</th>
                <th className="px-3 py-2">Assigned at</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="table-row">
                  <td className="px-3 py-3">{a.inventory.brand} {a.inventory.model}</td>
                  <td className="px-3 py-3">{a.dealer.name}</td>
                  <td className="px-3 py-3">{new Date(a.assignedAt).toLocaleString()}</td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-600 dark:text-slate-400">No assignments yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssignmentsPage;
