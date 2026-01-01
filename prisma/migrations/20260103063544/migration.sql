-- AlterTable
ALTER TABLE "notification_subscriptions" ADD COLUMN     "quiet_hours" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "absence_retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_absence_retries" INTEGER NOT NULL DEFAULT 3;
