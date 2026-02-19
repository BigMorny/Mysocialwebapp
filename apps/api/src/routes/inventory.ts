import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

const CreateInventorySchema = z.object({
  category: z.enum(["PHONE", "LAPTOP", "GADGET"]).optional().default("PHONE"),
  brand: z.string().min(1).max(120).optional().nullable(),
  model: z.string().min(1).max(120).optional().nullable(),
  storage: z.string().min(1).max(64).optional().nullable(),
  imei: z.string().min(1).max(128).optional().nullable(),
  serialNumber: z.string().min(1).max(128).optional().nullable(),
  condition: z.enum(["NEW", "USED"]).or(z.string().min(1)),
  price: z.coerce.number().nonnegative(),
  ramGb: z.number().int().positive().optional().nullable(),
  cpu: z.string().max(120).optional().nullable(),
  screenInches: z.number().positive().max(30).optional().nullable(),
  gpu: z.string().max(120).optional().nullable(),
  storageType: z.enum(["SSD", "HDD"]).or(z.string().max(30)).optional().nullable(),
  storageGb: z.number().int().positive().optional().nullable(),
  gadgetType: z.string().max(120).optional().nullable(),
});

const UpdateInventorySchema = z.object({
  category: z.enum(["PHONE", "LAPTOP", "GADGET"]).optional(),
  brand: z.string().min(1).max(120).optional().nullable(),
  model: z.string().min(1).max(120).optional().nullable(),
  storage: z.string().min(1).max(64).optional().nullable(),
  imei: z.string().min(1).max(128).optional().nullable(),
  serial: z.string().min(1).max(128).optional().nullable(),
  condition: z.enum(["NEW", "USED"]).or(z.string().min(1)).optional(),
  price: z.coerce.number().nonnegative().optional(),
  ramGb: z.number().int().positive().optional().nullable(),
  cpu: z.string().max(120).optional().nullable(),
  screenInches: z.number().positive().max(30).optional().nullable(),
  gpu: z.string().max(120).optional().nullable(),
  storageType: z.enum(["SSD", "HDD"]).or(z.string().max(30)).optional().nullable(),
  storageGb: z.number().int().positive().optional().nullable(),
  gadgetType: z.string().max(120).optional().nullable(),
});

function normalizeCondition(input: string | undefined) {
  if (!input) return undefined;
  return input.trim().toUpperCase() === "NEW" ? "NEW" : "USED";
}

function normalizeIdentifier(raw: string | null | undefined) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{15}$/.test(value)) {
    return { imei: value, serial: null as string | null };
  }
  return { imei: null as string | null, serial: value };
}

function toApiPrice(item: any) {
  return Number(item.price ?? 0);
}

function mapInventoryItemToApi(item: any) {
  return {
    id: item.id,
    category: item.inventoryCategory,
    brand: item.brand || item.category,
    model: item.model || item.name,
    imei: item.imei || item.imei1,
    serialNumber: item.serial,
    storage: item.storage,
    ramGb: item.ramGb,
    cpu: item.cpu,
    screenInches: item.screenInches,
    gpu: item.gpu,
    storageType: item.storageType,
    storageGb: item.storageGb,
    gadgetType: item.gadgetType,
    condition: normalizeCondition(item.condition) ?? "USED",
    price: toApiPrice(item),
    status: item.status,
    soldAt: item.soldAt,
    createdAt: item.createdAt,
  };
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid body.", parsed.error.flatten());
  }
  const shopId = req.user!.shopId;
  const userId = req.user!.id;
  const category = parsed.data.category;
  const brand = parsed.data.brand?.trim() ?? "";
  const model = parsed.data.model?.trim() ?? "";
  const gadgetType = parsed.data.gadgetType?.trim() ?? null;
  const parsedIdentifier = normalizeIdentifier(parsed.data.imei) ?? normalizeIdentifier(parsed.data.serialNumber);

  if ((category === "PHONE" || category === "LAPTOP") && (!brand || !model)) {
    return fail(res, 400, "VALIDATION_ERROR", "Brand and model are required.");
  }
  if (category === "PHONE" && !parsedIdentifier) {
    return fail(res, 400, "VALIDATION_ERROR", "IMEI or Serial Number is required for phones.");
  }
  if (category === "LAPTOP" && !parsedIdentifier) {
    return fail(res, 400, "VALIDATION_ERROR", "Serial Number is required for laptops.");
  }

  if (parsedIdentifier?.imei) {
    const exists = await prisma.inventoryItem.findFirst({ where: { shopId, imei: parsedIdentifier.imei } });
    if (exists) {
      return res.status(409).json({ ok: false, error: "IMEI already exists in this shop" });
    }
  }

  const isLaptop = category === "LAPTOP";
  const isGadget = category === "GADGET";
  const normalizedPrice = parsed.data.price;

  const created = await prisma.inventoryItem.create({
    data: {
      category: brand || gadgetType || "Generic",
      name: model || gadgetType || "Item",
      inventoryCategory: category,
      brand,
      model,
      storage: parsed.data.storage ?? null,
      imei1: parsedIdentifier?.imei ?? null,
      imei: parsedIdentifier?.imei ?? null,
      serial: parsedIdentifier?.serial ?? null,
      ramGb: isLaptop ? (parsed.data.ramGb ?? null) : null,
      cpu: isLaptop ? (parsed.data.cpu ?? null) : null,
      screenInches: isLaptop ? (parsed.data.screenInches ?? null) : null,
      gpu: isLaptop ? (parsed.data.gpu ?? null) : null,
      storageType: isLaptop ? (parsed.data.storageType ?? null) : null,
      storageGb: isLaptop ? (parsed.data.storageGb ?? null) : null,
      gadgetType: isGadget ? gadgetType : null,
      condition: normalizeCondition(parsed.data.condition) ?? "USED",
      price: normalizedPrice,
      status: "IN_SHOP",
      createdByUserId: userId,
      shopId,
    },
  });

  return ok(res, mapInventoryItemToApi(created), 201);
});

router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: { shopId: req.user!.shopId },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, items.map(mapInventoryItemToApi));
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const item = await prisma.inventoryItem.findFirst({
    where: { id, shopId: req.user!.shopId },
  });
  if (!item) return fail(res, 404, "NOT_FOUND", "Inventory item not found.");
  return ok(res, mapInventoryItemToApi(item));
});

router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid body.", parsed.error.flatten());
  }

  const existing = await prisma.inventoryItem.findFirst({
    where: { id, shopId: req.user!.shopId },
    select: { id: true, inventoryCategory: true },
  });
  if (!existing) return fail(res, 404, "NOT_FOUND", "Inventory item not found.");

  const nextCategory = parsed.data.category ?? existing.inventoryCategory;
  const data: any = {};

  if (parsed.data.category !== undefined) data.inventoryCategory = parsed.data.category;
  if (parsed.data.brand !== undefined) {
    data.category = parsed.data.brand ?? "";
    data.brand = parsed.data.brand ?? "";
  }
  if (parsed.data.model !== undefined) {
    data.name = parsed.data.model ?? "";
    data.model = parsed.data.model ?? "";
  }
  if (parsed.data.storage !== undefined) data.storage = parsed.data.storage;
  if (parsed.data.condition !== undefined) data.condition = normalizeCondition(parsed.data.condition);
  if (parsed.data.price !== undefined) {
    data.price = parsed.data.price;
  }
  if (parsed.data.gadgetType !== undefined) data.gadgetType = nextCategory === "GADGET" ? parsed.data.gadgetType : null;

  if (parsed.data.imei !== undefined || parsed.data.serial !== undefined) {
    if (parsed.data.imei === null && parsed.data.serial === null) {
      data.imei1 = null;
      data.imei = null;
      data.serial = null;
    } else {
      const identifier = normalizeIdentifier(parsed.data.imei) ?? normalizeIdentifier(parsed.data.serial);
      if (identifier) {
        data.imei1 = identifier.imei;
        data.imei = identifier.imei;
        data.serial = identifier.serial;
      }
    }
  }

  if (data.imei) {
    const duplicate = await prisma.inventoryItem.findFirst({
      where: { shopId: req.user!.shopId, imei: data.imei, NOT: { id: existing.id } },
      select: { id: true },
    });
    if (duplicate) return res.status(409).json({ ok: false, error: "IMEI already exists in this shop" });
  }

  if (nextCategory === "LAPTOP") {
    if (parsed.data.ramGb !== undefined) data.ramGb = parsed.data.ramGb;
    if (parsed.data.cpu !== undefined) data.cpu = parsed.data.cpu;
    if (parsed.data.screenInches !== undefined) data.screenInches = parsed.data.screenInches;
    if (parsed.data.gpu !== undefined) data.gpu = parsed.data.gpu;
    if (parsed.data.storageType !== undefined) data.storageType = parsed.data.storageType;
    if (parsed.data.storageGb !== undefined) data.storageGb = parsed.data.storageGb;
  } else {
    data.ramGb = null;
    data.cpu = null;
    data.screenInches = null;
    data.gpu = null;
    data.storageType = null;
    data.storageGb = null;
  }

  if (nextCategory !== "GADGET") {
    data.gadgetType = null;
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: existing.id },
    data,
  });

  return ok(res, mapInventoryItemToApi(updated));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await prisma.inventoryItem.deleteMany({
    where: { id, shopId: req.user!.shopId },
  });
  if (result.count === 0) return fail(res, 404, "NOT_FOUND", "Inventory item not found.");
  return res.json({ ok: true });
});

export default router;
