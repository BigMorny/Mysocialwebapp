import type { NextPage } from "next";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DashboardLayout, useDashboardShell } from "../../components/DashboardLayout";
import { Badge } from "../../components/ui/Badge";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Field";
import { ModalConfirm } from "../../components/ui/ModalConfirm";
import { useToast } from "../../components/providers/ToastProvider";
import { defaultStorageOptions, deviceCatalog, type DeviceCategory } from "../../data/deviceCatalog";
import { apiJson, API_BASE_URL } from "../../lib/api";

type InventoryItem = {
  id: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  storage?: string | null;
  ramGb?: number | null;
  cpu?: string | null;
  screenInches?: number | null;
  gpu?: string | null;
  storageType?: string | null;
  storageGb?: number | null;
  gadgetType?: string | null;
  imei?: string | null;
  serialNumber?: string | null;
  condition: "NEW" | "USED" | string;
  price: number;
  status: "IN_SHOP" | "OUT_WITH_DEALER" | "SOLD";
  soldAt?: string | null;
  createdAt: string;
};

type Consignment = {
  id: string;
  status: "OUT_WITH_DEALER" | "SOLD" | "RETURNED" | "LOST";
  expectedReturnAt?: string | null;
  dealer: { id: string; name: string };
  inventoryItemId: string;
};

type FilterTab = "ALL" | DeviceCategory;

type VariantGroup = {
  key: string;
  label: string;
  condition: "NEW" | "USED";
  items: InventoryItem[];
};

type ModelGroup = {
  key: string;
  title: string;
  meta: string;
  items: InventoryItem[];
  variants: VariantGroup[];
};

const statusKind: Record<InventoryItem["status"], "success" | "warning" | "info"> = {
  IN_SHOP: "success",
  OUT_WITH_DEALER: "warning",
  SOLD: "info",
};

function normalizeIdentifier(value: string) {
  const cleaned = value.trim();
  const digitsOnly = /^\d+$/.test(cleaned);
  if (digitsOnly && cleaned.length === 15) return { imei: cleaned, serialNumber: undefined };
  return { imei: undefined, serialNumber: cleaned || undefined };
}

function itemModelKey(item: InventoryItem) {
  return `${item.category}|${item.brand || ""}|${item.model || ""}`;
}

function itemVariantKey(item: InventoryItem) {
  const condition = item.condition === "NEW" ? "NEW" : "USED";
  if (item.category === "PHONE") return `PHONE|${item.storage || "-"}|${condition}`;
  if (item.category === "LAPTOP") {
    return `LAPTOP|${item.ramGb || "-"}|${item.storageType || "-"}|${item.storageGb || "-"}|${condition}`;
  }
  return `GADGET|${item.gadgetType || "Gadget"}|${item.storage || "-"}|${condition}|${item.brand || ""}|${item.model || ""}`;
}

function conditionValue(item: InventoryItem): "NEW" | "USED" {
  return item.condition === "NEW" ? "NEW" : "USED";
}

function variantLabelFromItem(item: InventoryItem) {
  const condition = conditionValue(item) === "NEW" ? "New" : "Used";
  if (item.category === "PHONE") return `${item.storage || "Unknown"} - ${condition}`;
  if (item.category === "LAPTOP") {
    const ram = item.ramGb ? `${item.ramGb}GB RAM` : "RAM -";
    const storage = `${item.storageType || "Storage"} ${item.storageGb ? `${item.storageGb}GB` : "-"}`;
    return `${ram} - ${storage} - ${condition}`;
  }
  const gadget = item.gadgetType || item.model || "Gadget";
  const storage = item.storage ? ` - ${item.storage}` : "";
  return `${gadget}${storage} - ${condition}`;
}

function priceText(items: InventoryItem[]) {
  if (!items.length) return "GHS 0";
  const prices = items.map((x) => Number(x.price || 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `GHS ${min}` : `GHS ${min}-${max}`;
}

function statusCounts(items: InventoryItem[]) {
  return {
    inShop: items.filter((x) => x.status === "IN_SHOP").length,
    withDealer: items.filter((x) => x.status === "OUT_WITH_DEALER").length,
    sold: items.filter((x) => x.status === "SOLD").length,
  };
}

function categoryLabel(category: DeviceCategory) {
  if (category === "PHONE") return "Phone";
  if (category === "LAPTOP") return "Laptop";
  return "Gadget";
}

function identifierMeta(item: InventoryItem) {
  const value = item.imei ?? item.serialNumber ?? "-";
  if (/^\d{15}$/.test(value)) return { label: "IMEI", value };
  return { label: "Serial", value };
}

function InventoryBody() {
  const router = useRouter();
  const { push: toast } = useToast();
  const { viewOnly, refreshSummary } = useDashboardShell();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [didDeepLinkExpand, setDidDeepLinkExpand] = useState(false);

  const [category, setCategory] = useState<DeviceCategory>("PHONE");
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [storage, setStorage] = useState("");
  const [customStorage, setCustomStorage] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [condition, setCondition] = useState<"NEW" | "USED">("USED");
  const [price, setPrice] = useState("");
  const [ramGb, setRamGb] = useState("");
  const [cpu, setCpu] = useState("");
  const [screenInches, setScreenInches] = useState("");
  const [gpu, setGpu] = useState("");
  const [storageType, setStorageType] = useState("");
  const [storageGb, setStorageGb] = useState("");
  const [gadgetType, setGadgetType] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const variantRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const consignmentByItem = useMemo(() => {
    const map = new Map<string, Consignment>();
    consignments.forEach((c) => {
      if (c.status === "OUT_WITH_DEALER") map.set(c.inventoryItemId, c);
    });
    return map;
  }, [consignments]);

  const resetForm = () => {
    setCategory("PHONE");
    setBrand("");
    setCustomBrand("");
    setModel("");
    setCustomModel("");
    setStorage("");
    setCustomStorage("");
    setIdentifier("");
    setCondition("USED");
    setPrice("");
    setRamGb("");
    setCpu("");
    setScreenInches("");
    setGpu("");
    setStorageType("");
    setStorageGb("");
    setGadgetType("");
  };

  const availableBrands = useMemo(() => Object.keys(deviceCatalog[category] ?? {}), [category]);
  const availableModels = useMemo(
    () => (brand && brand !== "__custom__" ? (deviceCatalog[category][brand] ?? []).map((m) => m.name) : []),
    [brand, category],
  );
  const selectedModelData = useMemo(
    () =>
      brand && model && brand !== "__custom__" && model !== "__custom__"
        ? (deviceCatalog[category][brand] ?? []).find((m) => m.name === model)
        : undefined,
    [brand, model, category],
  );
  const availableStorage = selectedModelData?.storageOptions ?? [...defaultStorageOptions];

  const load = async () => {
    setLoading(true);
    try {
      const [inv, cons] = await Promise.all([apiJson<InventoryItem[]>("/api/inventory"), apiJson<Consignment[]>("/api/consignments")]);
      setItems(inv);
      setConsignments(cons);
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to load inventory" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setShowForm(true);
    setCategory(item.category);
    setBrand(item.brand);
    setCustomBrand("");
    setModel(item.model);
    setCustomModel("");
    setStorage(item.storage ?? "");
    setCustomStorage("");
    setIdentifier(item.imei ?? item.serialNumber ?? "");
    setCondition(item.condition === "NEW" ? "NEW" : "USED");
    setPrice(String(item.price ?? ""));
    setRamGb(item.ramGb != null ? String(item.ramGb) : "");
    setCpu(item.cpu ?? "");
    setScreenInches(item.screenInches != null ? String(item.screenInches) : "");
    setGpu(item.gpu ?? "");
    setStorageType(item.storageType ?? "");
    setStorageGb(item.storageGb != null ? String(item.storageGb) : "");
    setGadgetType(item.gadgetType ?? "");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    const finalIdentifier = normalizeIdentifier(identifier);
    const finalBrand = brand === "__custom__" ? customBrand.trim() : brand.trim();
    const finalModel = model === "__custom__" ? customModel.trim() : model.trim();
    const finalStorage = storage === "__custom__" ? customStorage.trim() : storage.trim();

    if (!price) return toast({ kind: "error", text: "Price is required." });
    if ((category === "PHONE" || category === "LAPTOP") && (!finalBrand || !finalModel)) return toast({ kind: "error", text: "Brand and model are required." });
    if ((category === "PHONE" || category === "LAPTOP") && !finalIdentifier.imei && !finalIdentifier.serialNumber) return toast({ kind: "error", text: "Identifier is required." });

    const body: any = {
      category,
      brand: finalBrand || undefined,
      model: finalModel || undefined,
      storage: finalStorage || undefined,
      imei: finalIdentifier.imei,
      condition,
      price: Number(price),
      ramGb: ramGb ? Number(ramGb) : null,
      cpu: cpu || null,
      screenInches: screenInches ? Number(screenInches) : null,
      gpu: gpu || null,
      storageType: storageType || null,
      storageGb: storageGb ? Number(storageGb) : null,
      gadgetType: gadgetType || null,
    };
    if (editingId) body.serial = finalIdentifier.serialNumber ?? null;
    else body.serialNumber = finalIdentifier.serialNumber;

    setSaving(true);
    try {
      await apiJson(editingId ? `/api/inventory/${editingId}` : "/api/inventory", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast({ kind: "success", text: editingId ? "Inventory updated." : "Inventory item added." });
      setEditingId(null);
      setShowForm(false);
      resetForm();
      await load();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to save inventory" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || viewOnly) return;
    setDeleting(true);
    try {
      await apiJson(`/api/inventory/${deleteTarget.id}`, { method: "DELETE" });
      toast({ kind: "success", text: "Inventory deleted." });
      setDeleteTarget(null);
      await load();
      await refreshSummary();
    } catch (e) {
      toast({ kind: "error", text: e instanceof Error ? e.message : "Failed to delete inventory" });
    } finally {
      setDeleting(false);
    }
  };

  const tabItems = useMemo(() => (activeTab === "ALL" ? items : items.filter((item) => item.category === activeTab)), [items, activeTab]);
  const q = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return [];
    return tabItems.filter((item) => {
      const c = consignmentByItem.get(item.id);
      const text = [
        item.brand,
        item.model,
        item.storage,
        item.condition,
        item.imei,
        item.serialNumber,
        item.gadgetType,
        String(item.price ?? ""),
        c?.dealer?.name,
        c?.expectedReturnAt ? new Date(c.expectedReturnAt).toLocaleString() : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [q, tabItems, consignmentByItem]);

  const modelGroups = useMemo<ModelGroup[]>(() => {
    const modelMap = new Map<string, InventoryItem[]>();
    tabItems.forEach((item) => {
      const key = itemModelKey(item);
      if (!modelMap.has(key)) modelMap.set(key, []);
      modelMap.get(key)!.push(item);
    });

    return [...modelMap.entries()]
      .map(([modelKey, modelItems]) => {
        const first = modelItems[0];
        const variantMap = new Map<string, InventoryItem[]>();
        modelItems.forEach((item) => {
          const variantKey = itemVariantKey(item);
          if (!variantMap.has(variantKey)) variantMap.set(variantKey, []);
          variantMap.get(variantKey)!.push(item);
        });

        const variants: VariantGroup[] = [...variantMap.entries()]
          .map(([variantKey, variantItems]) => ({
            key: variantKey,
            label: variantLabelFromItem(variantItems[0]),
            condition: conditionValue(variantItems[0]),
            items: variantItems,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        return {
          key: modelKey,
          title: first.model || first.gadgetType || "Unnamed model",
          meta: `${categoryLabel(first.category)} - ${first.brand || "No brand"}`,
          items: modelItems,
          variants,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tabItems]);

  useEffect(() => {
    if (!router.isReady || didDeepLinkExpand || modelGroups.length === 0) return;

    const itemId = typeof router.query.itemId === "string" ? router.query.itemId : undefined;
    const model = typeof router.query.model === "string" ? router.query.model : undefined;
    const storageParam = typeof router.query.storage === "string" ? router.query.storage : undefined;
    const conditionParam = typeof router.query.condition === "string" ? router.query.condition : undefined;

    const match = tabItems.find((item) => {
      if (itemId && item.id !== itemId) return false;
      if (model && item.model !== model) return false;
      if (storageParam && (item.storage || "") !== storageParam) return false;
      if (conditionParam && conditionValue(item) !== conditionParam) return false;
      return itemId || model ? true : false;
    });

    if (!match) {
      setDidDeepLinkExpand(true);
      return;
    }

    const modelKey = itemModelKey(match);
    const variantGlobalKey = `${modelKey}::${itemVariantKey(match)}`;

    setExpandedModels((prev) => ({ ...prev, [modelKey]: true }));
    setExpandedVariants((prev) => ({ ...prev, [variantGlobalKey]: true }));
    setDidDeepLinkExpand(true);

    setTimeout(() => {
      const node = variantRefs.current[variantGlobalKey];
      if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [didDeepLinkExpand, modelGroups, router.isReady, router.query, tabItems]);

  const renderSearchResult = (item: InventoryItem) => {
    const c = consignmentByItem.get(item.id);
    const id = identifierMeta(item);
    return (
      <Card key={item.id} className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{variantLabelFromItem(item)}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{id.label}: {id.value}</p>
            {item.status === "OUT_WITH_DEALER" ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                {c ? `With ${c.dealer.name}${c.expectedReturnAt ? ` - Due ${new Date(c.expectedReturnAt).toLocaleString()}` : ""}` : "With dealer"}
              </p>
            ) : null}
          </div>
          <Badge kind={statusKind[item.status]}>{item.status}</Badge>
        </div>
        <p className="mt-2 text-sm font-semibold">GHS {Number(item.price || 0)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" className="h-9" onClick={() => startEdit(item)} disabled={viewOnly}>Edit</Button>
          <Button variant="danger" className="h-9" onClick={() => setDeleteTarget(item)} disabled={viewOnly}>Delete</Button>
        </div>
      </Card>
    );
  };

  const renderDevice = (item: InventoryItem) => {
    const c = consignmentByItem.get(item.id);
    const id = identifierMeta(item);
    return (
      <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold">{id.label}: {id.value}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Price: GHS {Number(item.price || 0)}</p>
            {item.status === "OUT_WITH_DEALER" ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                {c ? `With ${c.dealer.name}${c.expectedReturnAt ? ` - Due ${new Date(c.expectedReturnAt).toLocaleString()}` : ""}` : "With dealer"}
              </p>
            ) : null}
          </div>
          <Badge kind={statusKind[item.status]}>{item.status}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" className="h-9" onClick={() => startEdit(item)} disabled={viewOnly}>Edit</Button>
          <Button variant="danger" className="h-9" onClick={() => setDeleteTarget(item)} disabled={viewOnly}>Delete</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          <a href={`${API_BASE_URL}/api/export/inventory.csv`} className="btn-outline">Export CSV</a>
          <Button onClick={() => { setShowForm((v) => !v); if (showForm) { setEditingId(null); resetForm(); } }} disabled={viewOnly}>{showForm ? "Close" : "Add Inventory"}</Button>
        </div>
      </div>

      {viewOnly && <Banner kind="warning">View-only mode: editing actions are disabled. Visit Billing to reactivate.</Banner>}

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "PHONE", "LAPTOP", "GADGET"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-brand-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            {tab === "ALL" ? "All" : tab === "PHONE" ? "Phones" : tab === "LAPTOP" ? "Laptops" : "Gadgets"}
          </button>
        ))}
        <Input className="min-w-[220px] flex-1" placeholder="Search brand, model, storage, condition, IMEI/serial, gadget, price..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <Card>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as DeviceCategory)}>
                <option value="PHONE">Phone</option>
                <option value="LAPTOP">Laptop</option>
                <option value="GADGET">Gadget</option>
              </Select>
            </Field>

            {category === "GADGET" && <Field label="Gadget type"><Input value={gadgetType} onChange={(e) => setGadgetType(e.target.value)} placeholder="PS5, AirPods, iPad..." /></Field>}

            <Field label={category === "GADGET" ? "Brand (optional)" : "Brand"}>
              <Input list="brand-options" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Search brand" />
              <datalist id="brand-options">
                {availableBrands.map((b) => <option key={b} value={b} />)}
                <option value="__custom__" />
              </datalist>
            </Field>

            {brand === "__custom__" && <Field label="Custom brand"><Input value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} /></Field>}

            <Field label={category === "GADGET" ? "Model (optional)" : "Model"}>
              <Input list="model-options" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Search model" />
              <datalist id="model-options">
                {availableModels.map((m) => <option key={m} value={m} />)}
                <option value="__custom__" />
              </datalist>
            </Field>

            {model === "__custom__" && <Field label="Custom model"><Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} /></Field>}

            {category === "PHONE" && (
              <>
                <Field label="Storage">
                  <Select value={storage} onChange={(e) => setStorage(e.target.value)}>
                    <option value="">Select storage</option>
                    {availableStorage.map((option) => <option key={option} value={option}>{option}</option>)}
                    <option value="__custom__">Custom storage</option>
                  </Select>
                </Field>
                {storage === "__custom__" && <Field label="Custom storage"><Input value={customStorage} onChange={(e) => setCustomStorage(e.target.value)} /></Field>}
              </>
            )}

            {category === "LAPTOP" && (
              <>
                <Field label="RAM (GB)"><Input type="number" value={ramGb} onChange={(e) => setRamGb(e.target.value)} /></Field>
                <Field label="CPU"><Input value={cpu} onChange={(e) => setCpu(e.target.value)} /></Field>
                <Field label="Screen size (inches)"><Input type="number" step="0.1" value={screenInches} onChange={(e) => setScreenInches(e.target.value)} /></Field>
                <Field label="GPU (optional)"><Input value={gpu} onChange={(e) => setGpu(e.target.value)} /></Field>
                <Field label="Storage type">
                  <Select value={storageType} onChange={(e) => setStorageType(e.target.value)}>
                    <option value="">Select type</option>
                    <option value="SSD">SSD</option>
                    <option value="HDD">HDD</option>
                  </Select>
                </Field>
                <Field label="Storage size (GB)"><Input type="number" value={storageGb} onChange={(e) => setStorageGb(e.target.value)} /></Field>
              </>
            )}

            <Field label="IMEI / Serial Number">
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Enter IMEI or serial number" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">IMEI is 15 digits. If not 15 digits, we&apos;ll save as Serial Number.</p>
            </Field>
            <Field label="Condition">
              <Select value={condition} onChange={(e) => setCondition(e.target.value as "NEW" | "USED")}>
                <option value="NEW">New</option>
                <option value="USED">Used</option>
              </Select>
            </Field>
            <Field label="Price (GHS)"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>

            <div className="md:col-span-2 flex justify-end gap-2">
              {editingId ? <Button variant="secondary" type="button" onClick={() => { setEditingId(null); resetForm(); }}>Cancel Edit</Button> : null}
              <Button type="submit" loading={saving}>{editingId ? "Update Item" : "Save Item"}</Button>
            </div>
          </form>
        </Card>
      )}

      {searchResults.length === 0 && q ? (
        <Card className="text-center text-slate-700 dark:text-slate-300">No results for "{search}".</Card>
      ) : null}

      {q ? (
        <div className="space-y-3">
          {searchResults.map((item) => renderSearchResult(item))}
        </div>
      ) : (
        <div className="space-y-3">
          {!loading && modelGroups.length === 0 ? (
            <Card className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">No inventory items yet.</p>
              {!viewOnly ? (
                <div className="mt-3">
                  <Button onClick={() => setShowForm(true)}>Add first inventory item</Button>
                </div>
              ) : null}
            </Card>
          ) : null}

          {modelGroups.map((group) => {
            const modelCount = group.items.length;
            const modelCounts = statusCounts(group.items);
            const modelOpen = Boolean(expandedModels[group.key]);
            return (
              <Card key={group.key}>
                <button type="button" onClick={() => setExpandedModels((prev) => ({ ...prev, [group.key]: !prev[group.key] }))} className="flex w-full items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{group.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{group.meta}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">IN_SHOP {modelCounts.inShop}</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">OUT_WITH_DEALER {modelCounts.withDealer}</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-500/10 dark:text-slate-300">SOLD {modelCounts.sold}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-5xl font-black leading-none">{modelCount}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Qty</p>
                    </div>
                    {modelOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </div>
                </button>

                {modelOpen ? (
                  <div className="mt-3 space-y-2">
                    {group.variants.map((variant) => {
                      const variantCounts = statusCounts(variant.items);
                      const variantGlobalKey = `${group.key}::${variant.key}`;
                      const variantOpen = Boolean(expandedVariants[variantGlobalKey]);
                      return (
                        <div
                          key={variantGlobalKey}
                          ref={(el) => {
                            variantRefs.current[variantGlobalKey] = el;
                          }}
                          className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold">{variant.label}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-2xl font-extrabold leading-none">{variant.items.length}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${variant.condition === "NEW" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                                  {variant.condition === "NEW" ? "New" : "Used"}
                                </span>
                                <span className="text-sm font-semibold">{priceText(variant.items)}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">IN_SHOP {variantCounts.inShop}</span>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">OUT_WITH_DEALER {variantCounts.withDealer}</span>
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-500/10 dark:text-slate-300">SOLD {variantCounts.sold}</span>
                              </div>
                            </div>
                            <Button variant="secondary" className="h-9" onClick={() => setExpandedVariants((prev) => ({ ...prev, [variantGlobalKey]: !prev[variantGlobalKey] }))}>
                              {variantOpen ? "Hide devices" : "Show devices"}
                            </Button>
                          </div>

                          {variantOpen ? (
                            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                              {variant.items.map((item) => renderDevice(item))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <ModalConfirm
        open={Boolean(deleteTarget)}
        title="Delete inventory item"
        description={`This will permanently remove ${deleteTarget?.brand ?? deleteTarget?.gadgetType ?? "this item"}.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />

      {loading && <div className="text-sm text-slate-600 dark:text-slate-400">Loading...</div>}
    </div>
  );
}

const InventoryPage: NextPage = () => (
  <DashboardLayout>
    <InventoryBody />
  </DashboardLayout>
);

export default InventoryPage;
