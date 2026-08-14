CREATE TYPE "SettlementInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');
CREATE TABLE "settlement_invoices" (
  "id" TEXT NOT NULL, "invoice_no" VARCHAR(30) NOT NULL, "partner_id" TEXT NOT NULL,
  "period_year_month" VARCHAR(7) NOT NULL, "status" "SettlementInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal_amount" DECIMAL(14,2) NOT NULL, "vat_amount" DECIMAL(14,2) NOT NULL,
  "total_amount" DECIMAL(14,2) NOT NULL, "issued_at" TIMESTAMP(3), "issued_by" TEXT,
  "paid_at" TIMESTAMP(3), "cancelled_at" TIMESTAMP(3), "cancel_reason" VARCHAR(300),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "settlement_invoices_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "settlement_records" ADD COLUMN "invoice_id" TEXT;
CREATE UNIQUE INDEX "settlement_invoices_invoice_no_key" ON "settlement_invoices"("invoice_no");
CREATE UNIQUE INDEX "settlement_invoices_partner_id_period_year_month_key" ON "settlement_invoices"("partner_id", "period_year_month");
CREATE INDEX "settlement_invoices_status_period_year_month_idx" ON "settlement_invoices"("status", "period_year_month");
ALTER TABLE "settlement_invoices" ADD CONSTRAINT "settlement_invoices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_invoices" ADD CONSTRAINT "settlement_invoices_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "settlement_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
