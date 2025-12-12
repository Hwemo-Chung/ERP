-- AlterTable
ALTER TABLE "cancellation_records" ADD COLUMN     "is_returned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returned_at" TIMESTAMP(3),
ADD COLUMN     "returned_by" TEXT;

-- CreateIndex
CREATE INDEX "cancellation_records_is_returned_cancelled_at_idx" ON "cancellation_records"("is_returned", "cancelled_at" DESC);

-- AddForeignKey
ALTER TABLE "cancellation_records" ADD CONSTRAINT "cancellation_records_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
