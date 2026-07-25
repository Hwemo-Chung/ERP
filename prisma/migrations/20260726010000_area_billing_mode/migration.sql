-- CreateEnum
CREATE TYPE "AreaBillingMode" AS ENUM ('FULL_MONTH', 'DAILY_PRORATED');

-- AlterTable
ALTER TABLE "storage_contracts" ADD COLUMN     "area_billing_mode" "AreaBillingMode" NOT NULL DEFAULT 'FULL_MONTH';

