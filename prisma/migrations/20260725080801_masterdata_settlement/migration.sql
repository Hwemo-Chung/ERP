-- CreateEnum
CREATE TYPE "StorageContractType" AS ENUM ('PALLET_DAILY', 'AREA_MONTHLY', 'AREA_YEARLY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('PWA', 'EXCEL');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('TRANSPORT', 'STORAGE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE_STAFF';

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "address" VARCHAR(300),
ADD COLUMN     "business_category" VARCHAR(80),
ADD COLUMN     "business_registration_no" VARCHAR(10),
ADD COLUMN     "business_type" VARCHAR(80),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "default_transport_rate" DECIMAL(14,2),
ADD COLUMN     "representative_name" VARCHAR(80);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "parent_id" TEXT,
    "depth" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category_id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "cost_price" DECIMAL(14,2) NOT NULL,
    "transport_rate" DECIMAL(14,2),
    "pallet_threshold" DECIMAL(5,2),
    "max_units_per_pallet" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_rate_cards" (
    "id" TEXT NOT NULL,
    "vehicle_type" VARCHAR(60) NOT NULL,
    "tonnage" DECIMAL(5,1),
    "container_size" VARCHAR(40),
    "special_equipment" VARCHAR(60),
    "rate" DECIMAL(14,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "transport_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_contracts" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "contract_type" "StorageContractType" NOT NULL,
    "pallet_daily_rate" DECIMAL(14,2),
    "area_pyeong" DECIMAL(10,2),
    "area_rate" DECIMAL(14,2),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "storage_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "partner_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "vehicle_rate_id" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'PWA',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_records" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "partner_id" TEXT NOT NULL,
    "period_year_month" VARCHAR(7) NOT NULL,
    "fee_type" "FeeType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "calculation_detail" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(60) NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_partner_id_idx" ON "products"("partner_id");

-- CreateIndex
CREATE INDEX "storage_contracts_partner_id_is_active_idx" ON "storage_contracts"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "warehouse_transactions_partner_id_transaction_date_idx" ON "warehouse_transactions"("partner_id", "transaction_date");

-- CreateIndex
CREATE INDEX "warehouse_transactions_product_id_transaction_date_idx" ON "warehouse_transactions"("product_id", "transaction_date");

-- CreateIndex
CREATE INDEX "settlement_records_partner_id_period_year_month_idx" ON "settlement_records"("partner_id", "period_year_month");

-- CreateIndex
CREATE UNIQUE INDEX "partners_business_registration_no_key" ON "partners"("business_registration_no");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_periods_branch_id_period_start_key" ON "settlement_periods"("branch_id", "period_start");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_contracts" ADD CONSTRAINT "storage_contracts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_vehicle_rate_id_fkey" FOREIGN KEY ("vehicle_rate_id") REFERENCES "transport_rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "warehouse_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

