-- CreateTable order_events
CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "event_type" VARCHAR(30) NOT NULL,
  "note" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_events_created_at_idx" ON "order_events"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
