-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('미배정', '배정', '배정확정', '출고확정', '출문', '연기', '부재', '인수', '부분인수', '회수', '취소', '의뢰취소');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HQ_ADMIN', 'BRANCH_MANAGER', 'PARTNER_COORDINATOR', 'INSTALLER');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "ReasonType" AS ENUM ('CANCEL', 'POSTPONE', 'ABSENCE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('VAPID', 'FCM', 'APNS');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WEB', 'ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ko',
    "branch_id" TEXT,
    "partner_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "region" VARCHAR(50) NOT NULL,
    "timezone" VARCHAR(40) NOT NULL DEFAULT 'Asia/Seoul',

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "contact_name" VARCHAR(80),
    "phone" VARCHAR(30),
    "email" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installers" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "skill_tags" TEXT[],
    "capacity_per_day" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "installers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_no" VARCHAR(30) NOT NULL,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(30) NOT NULL,
    "address" JSONB NOT NULL,
    "vendor" VARCHAR(80) NOT NULL,
    "branch_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "installer_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT '미배정',
    "appointment_date" DATE NOT NULL,
    "appointment_time_window" TEXT,
    "promised_date" DATE NOT NULL,
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_code" VARCHAR(30) NOT NULL,
    "item_name" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weight" DECIMAL(8,2),

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "previous_status" "OrderStatus" NOT NULL,
    "new_status" "OrderStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason_code" VARCHAR(30),
    "notes" TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "old_date" DATE NOT NULL,
    "new_date" DATE NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_orders" (
    "id" TEXT NOT NULL,
    "parent_order_id" TEXT NOT NULL,
    "child_order_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_pickups" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "collected_by" TEXT,
    "collected_at" TIMESTAMP(3),

    CONSTRAINT "waste_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_numbers" (
    "id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "serial" VARCHAR(40) NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "category" VARCHAR(30) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" VARCHAR(64) NOT NULL,
    "platform" "Platform" NOT NULL,
    "push_provider" "PushProvider" NOT NULL,
    "token" JSONB NOT NULL,
    "categories_enabled" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "filters" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "file_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "table_name" VARCHAR(50) NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "diff" JSONB NOT NULL,
    "actor" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_periods" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'OPEN',
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "unlocked_by" TEXT,
    "unlocked_at" TIMESTAMP(3),

    CONSTRAINT "settlement_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reason_codes" (
    "id" TEXT NOT NULL,
    "type" "ReasonType" NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description_ko" VARCHAR(100) NOT NULL,
    "description_en" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reason_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "operation_type" "OperationType" NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expected_version" INTEGER,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "offline_sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "description_ko" VARCHAR(100) NOT NULL,
    "description_en" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "waste_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

-- CreateIndex
CREATE INDEX "installers_branch_id_is_active_idx" ON "installers"("branch_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_branch_id_status_appointment_date_idx" ON "orders"("branch_id", "status", "appointment_date");

-- CreateIndex
CREATE INDEX "orders_customer_phone_idx" ON "orders"("customer_phone");

-- CreateIndex
CREATE INDEX "orders_vendor_appointment_date_idx" ON "orders"("vendor", "appointment_date");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_changed_at_idx" ON "order_status_history"("order_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "waste_pickups_collected_at_code_idx" ON "waste_pickups"("collected_at", "code");

-- CreateIndex
CREATE UNIQUE INDEX "waste_pickups_order_id_code_key" ON "waste_pickups"("order_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "serial_numbers_serial_key" ON "serial_numbers"("serial");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_created_at_idx" ON "notifications"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_subscriptions_user_id_is_active_idx" ON "notification_subscriptions"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscriptions_user_id_device_id_key" ON "notification_subscriptions"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "settlement_periods_branch_id_period_start_period_end_idx" ON "settlement_periods"("branch_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "reason_codes_code_key" ON "reason_codes"("code");

-- CreateIndex
CREATE INDEX "offline_sync_queue_status_created_at_idx" ON "offline_sync_queue"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "waste_codes_code_key" ON "waste_codes"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installers" ADD CONSTRAINT "installers_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installers" ADD CONSTRAINT "installers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_installer_id_fkey" FOREIGN KEY ("installer_id") REFERENCES "installers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_orders" ADD CONSTRAINT "split_orders_parent_order_id_fkey" FOREIGN KEY ("parent_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_orders" ADD CONSTRAINT "split_orders_child_order_id_fkey" FOREIGN KEY ("child_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_orders" ADD CONSTRAINT "split_orders_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_orders" ADD CONSTRAINT "split_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_pickups" ADD CONSTRAINT "waste_pickups_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_pickups" ADD CONSTRAINT "waste_pickups_collected_by_fkey" FOREIGN KEY ("collected_by") REFERENCES "installers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_fkey" FOREIGN KEY ("actor") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_periods" ADD CONSTRAINT "settlement_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_periods" ADD CONSTRAINT "settlement_periods_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_periods" ADD CONSTRAINT "settlement_periods_unlocked_by_fkey" FOREIGN KEY ("unlocked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
