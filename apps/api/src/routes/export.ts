import express from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

function toCsvRow(values: Array<string | number | null | undefined>) {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`;
      return s;
    })
    .join(",");
}

function sendCsv(res: express.Response, filename: string, rows: string[]) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(rows.join("\n"));
}

router.get("/inventory.csv", requireAuth, async (req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: { shopId: req.user!.shopId }, orderBy: { createdAt: "desc" } });
  const rows = [
    toCsvRow(["id", "category", "brand", "model", "imei", "serial", "condition", "status", "price", "createdAt"]),
    ...items.map((i) =>
      toCsvRow([
        i.id,
        i.inventoryCategory,
        i.brand || i.category,
        i.model || i.name,
        i.imei || i.imei1,
        i.serial,
        i.condition,
        i.status,
        i.price != null ? i.price.toString() : "",
        i.createdAt.toISOString(),
      ]),
    ),
  ];
  return sendCsv(res, "inventory.csv", rows);
});

router.get("/dealers.csv", requireAuth, async (req, res) => {
  const dealers = await prisma.dealer.findMany({ where: { shopId: req.user!.shopId }, orderBy: { createdAt: "desc" } });
  const rows = [
    toCsvRow(["id", "name", "phone", "locationNote", "idType", "idNumber", "createdAt"]),
    ...dealers.map((d) => toCsvRow([d.id, d.name, d.phone, d.locationNote, d.idType, d.idNumber, d.createdAt.toISOString()])),
  ];
  return sendCsv(res, "dealers.csv", rows);
});

router.get("/consignments.csv", requireAuth, async (req, res) => {
  const items = await prisma.consignment.findMany({
    where: { shopId: req.user!.shopId },
    orderBy: { createdAt: "desc" },
    include: { dealer: true, inventoryItem: true },
  });
  const rows = [
    toCsvRow(["id", "status", "itemId", "dealer", "handedOutAt", "expectedReturnAt", "closedAt", "agreedPrice", "soldPrice"]),
    ...items.map((c) =>
      toCsvRow([
        c.id,
        c.status,
        c.inventoryItemId,
        c.dealer.name,
        c.handedOutAt.toISOString(),
        c.expectedReturnAt?.toISOString(),
        c.closedAt?.toISOString(),
        c.agreedPrice,
        c.soldPrice,
      ]),
    ),
  ];
  return sendCsv(res, "consignments.csv", rows);
});

export default router;
