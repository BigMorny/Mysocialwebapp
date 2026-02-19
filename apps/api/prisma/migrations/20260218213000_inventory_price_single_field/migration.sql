ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "price" DECIMAL;

ALTER TABLE "InventoryItem"
  ALTER COLUMN "costPrice" SET DEFAULT 0,
  ALTER COLUMN "sellingPrice" SET DEFAULT 0;

UPDATE "InventoryItem"
SET "price" = COALESCE("price", "sellingPrice", "costPrice", 0)
WHERE "price" IS NULL;
