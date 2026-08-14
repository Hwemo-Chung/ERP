DELETE FROM "warehouse_transactions" WHERE "source"::text = 'PURCHASE_RECEIPT';
ALTER TABLE "warehouse_transactions" ALTER COLUMN "source" DROP DEFAULT;
ALTER TYPE "TransactionSource" RENAME TO "TransactionSource_old";
CREATE TYPE "TransactionSource" AS ENUM ('PWA', 'EXCEL');
ALTER TABLE "warehouse_transactions"
  ALTER COLUMN "source" TYPE "TransactionSource"
  USING ("source"::text::"TransactionSource");
ALTER TABLE "warehouse_transactions" ALTER COLUMN "source" SET DEFAULT 'PWA';
DROP TYPE "TransactionSource_old";
