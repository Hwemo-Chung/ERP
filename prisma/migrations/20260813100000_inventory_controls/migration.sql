ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT_IN';
ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT_OUT';
CREATE TYPE "AdjustmentReason" AS ENUM ('STOCKTAKE_DIFF', 'DAMAGE', 'DISPOSAL', 'OTHER');
ALTER TABLE "products"
  ADD COLUMN "min_quantity" INTEGER,
  ADD COLUMN "reorder_quantity" INTEGER,
  ADD COLUMN "max_quantity" INTEGER;
ALTER TABLE "warehouse_transactions"
  ADD COLUMN "adjustment_reason" "AdjustmentReason",
  ADD COLUMN "adjustment_note" VARCHAR(300);
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" VARCHAR(160);
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
ALTER TABLE "products" ADD CONSTRAINT "products_inventory_threshold_order_check"
  CHECK ((min_quantity IS NULL OR reorder_quantity IS NULL OR min_quantity <= reorder_quantity)
    AND (reorder_quantity IS NULL OR max_quantity IS NULL OR reorder_quantity <= max_quantity));
