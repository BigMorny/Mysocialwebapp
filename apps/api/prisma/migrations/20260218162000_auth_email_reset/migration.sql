ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Owner';

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "email" TEXT;

UPDATE "Shop" s
SET "email" = COALESCE(
  (SELECT u."email" FROM "User" u WHERE u."shopId" = s."id" AND u."email" IS NOT NULL ORDER BY u."createdAt" ASC LIMIT 1),
  s."id" || '@mysocial.local'
)
WHERE s."email" IS NULL OR s."email" = '';

ALTER TABLE "Shop" ALTER COLUMN "email" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_used_expiresAt_idx" ON "PasswordResetToken"("userId", "used", "expiresAt");
