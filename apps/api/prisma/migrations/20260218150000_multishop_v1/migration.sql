-- Create enums
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus_new" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('MOMO', 'BANK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryCategory" AS ENUM ('PHONE', 'LAPTOP', 'GADGET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('CONSIGNMENT_OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Shop table
CREATE TABLE IF NOT EXISTS "Shop" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "locationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- User additions
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Create shop per existing user if missing
INSERT INTO "Shop" ("id", "name", "phone", "createdAt")
SELECT
  'shop_' || u."id",
  'My Shop',
  COALESCE(NULLIF(u."phone", ''), '0000000000'),
  NOW()
FROM "User" u
LEFT JOIN "Shop" s ON s."id" = 'shop_' || u."id"
WHERE s."id" IS NULL;

UPDATE "User" u
SET "shopId" = 'shop_' || u."id"
WHERE u."shopId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "shopId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "User_shopId_idx" ON "User"("shopId");

-- Inventory additions
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "brand" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "model" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "inventoryCategory" "InventoryCategory" NOT NULL DEFAULT 'PHONE';
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "imei" TEXT;

UPDATE "InventoryItem" i
SET "shopId" = u."shopId"
FROM "User" u
WHERE i."createdByUserId" = u."id" AND i."shopId" IS NULL;

UPDATE "InventoryItem"
SET "brand" = COALESCE(NULLIF("brand", ''), COALESCE("category", '')),
    "model" = COALESCE(NULLIF("model", ''), COALESCE("name", '')),
    "imei" = COALESCE("imei", "imei1");

ALTER TABLE "InventoryItem" ALTER COLUMN "shopId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "InventoryItem_shopId_idx" ON "InventoryItem"("shopId");
CREATE INDEX IF NOT EXISTS "InventoryItem_shopId_status_idx" ON "InventoryItem"("shopId", "status");
CREATE INDEX IF NOT EXISTS "InventoryItem_shopId_imei_idx" ON "InventoryItem"("shopId", "imei");
DO $$ BEGIN
  CREATE UNIQUE INDEX "InventoryItem_shopId_imei_key" ON "InventoryItem"("shopId", "imei");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Dealer additions
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
UPDATE "Dealer" d
SET "shopId" = u."shopId"
FROM "User" u
WHERE d."createdByUserId" = u."id" AND d."shopId" IS NULL;
ALTER TABLE "Dealer" ALTER COLUMN "shopId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Dealer_shopId_idx" ON "Dealer"("shopId");

-- Consignment additions
ALTER TABLE "Consignment" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
UPDATE "Consignment" c
SET "shopId" = u."shopId"
FROM "User" u
WHERE c."createdByUserId" = u."id" AND c."shopId" IS NULL;
ALTER TABLE "Consignment" ALTER COLUMN "shopId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Consignment_shopId_idx" ON "Consignment"("shopId");

-- New subscription shape
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle";
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "amountGhs" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

UPDATE "Subscription" s
SET "shopId" = u."shopId"
FROM "User" u
WHERE s."userId" = u."id" AND s."shopId" IS NULL;

UPDATE "Subscription"
SET "trialEndsAt" = COALESCE("trialEndsAt", "renewsAt"),
    "billingCycle" = COALESCE("billingCycle", 'MONTHLY'::"BillingCycle"),
    "amountGhs" = COALESCE("amountGhs", 59),
    "startedAt" = COALESCE("startedAt", "createdAt");

ALTER TABLE "Subscription" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "billingCycle" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "amountGhs" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "startedAt" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Subscription_shopId_status_idx" ON "Subscription"("shopId", "status");

-- Convert subscription status enum values
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Subscription"
ALTER COLUMN "status" TYPE "SubscriptionStatus_new"
USING (
  CASE "status"::text
    WHEN 'trial' THEN 'TRIALING'
    WHEN 'active' THEN 'ACTIVE'
    WHEN 'past_due' THEN 'EXPIRED'
    WHEN 'cancelled' THEN 'EXPIRED'
    ELSE 'TRIALING'
  END
)::"SubscriptionStatus_new";
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'TRIALING';
DROP TYPE IF EXISTS "SubscriptionStatus";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";

-- Remove legacy subscription columns if present
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "planId";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "renewsAt";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "graceEndsAt";

-- Payment requests
CREATE TABLE IF NOT EXISTS "SubscriptionPaymentRequest" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  "amountGhs" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  CONSTRAINT "SubscriptionPaymentRequest_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "SubscriptionPaymentRequest" ADD CONSTRAINT "SubscriptionPaymentRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "SubscriptionPaymentRequest_shopId_status_idx" ON "SubscriptionPaymentRequest"("shopId", "status");

-- Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "consignmentId" TEXT,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_type_consignmentId_key" ON "Notification"("type", "consignmentId");
CREATE INDEX IF NOT EXISTS "Notification_shopId_readAt_idx" ON "Notification"("shopId", "readAt");
