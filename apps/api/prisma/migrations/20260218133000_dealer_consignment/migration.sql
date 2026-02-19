-- CreateEnum
CREATE TYPE "ConsignmentStatus" AS ENUM ('OUT_WITH_DEALER', 'SOLD', 'RETURNED', 'LOST');

-- Update ItemStatus enum values
CREATE TYPE "ItemStatus_new" AS ENUM ('IN_SHOP', 'OUT_WITH_DEALER', 'SOLD');

ALTER TABLE "InventoryItem"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InventoryItem"
ALTER COLUMN "status" TYPE "ItemStatus_new"
USING (
  CASE "status"::text
    WHEN 'in_stock' THEN 'IN_SHOP'
    WHEN 'with_dealer' THEN 'OUT_WITH_DEALER'
    WHEN 'sold' THEN 'SOLD'
    WHEN 'returned' THEN 'IN_SHOP'
    ELSE 'IN_SHOP'
  END
)::"ItemStatus_new";

ALTER TABLE "InventoryItem" ALTER COLUMN "status" SET DEFAULT 'IN_SHOP';

DROP TYPE "ItemStatus";
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";

-- Dealer ownership fields
ALTER TABLE "Dealer" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "locationNote" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "idType" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "idNumber" TEXT;

ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Consignment table
CREATE TABLE "Consignment" (
  "id" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "status" "ConsignmentStatus" NOT NULL DEFAULT 'OUT_WITH_DEALER',
  "handedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "agreedPrice" INTEGER,
  "soldPrice" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Consignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Consignment_createdByUserId_status_idx" ON "Consignment"("createdByUserId", "status");
CREATE INDEX "Consignment_dealerId_status_idx" ON "Consignment"("dealerId", "status");
CREATE INDEX "Consignment_inventoryItemId_status_idx" ON "Consignment"("inventoryItemId", "status");

ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_dealerId_fkey"
FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
