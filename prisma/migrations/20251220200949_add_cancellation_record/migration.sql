-- DropIndex
DROP INDEX "order_events_order_id_created_at_idx";

-- CreateTable
CREATE TABLE "cancellation_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "cancelled_by" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_status" VARCHAR(30) NOT NULL,
    "refund_amount" DECIMAL(15,2),
    "refund_processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cancellation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_records_order_id_key" ON "cancellation_records"("order_id");

-- CreateIndex
CREATE INDEX "cancellation_records_order_id_idx" ON "cancellation_records"("order_id");

-- CreateIndex
CREATE INDEX "cancellation_records_cancelled_at_idx" ON "cancellation_records"("cancelled_at" DESC);

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "cancellation_records" ADD CONSTRAINT "cancellation_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_records" ADD CONSTRAINT "cancellation_records_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
