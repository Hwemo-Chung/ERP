---
name: erp-db
description: This skill should be used when working with Prisma, database queries, soft delete, optimistic locking, or 409 conflicts in this ERP project.
---

## Soft Delete

```sql
-- Prisma middleware auto-applies
-- Raw query needs explicit filter:
SELECT * FROM orders WHERE deleted_at IS NULL;
```

## Optimistic Locking

```sql
UPDATE orders SET status = $1, version = version + 1
WHERE id = $2 AND version = $3;
-- rowcount = 0 → 409 Conflict → refetch and retry
```

## Key Indices

- `orders(branch_id, status, appointment_date)`
- `orders(customer_phone)`
- `order_status_history(order_id, changed_at DESC)`

## Structure

```
apps/api/src/
├── auth/         # JWT + Argon2
├── orders/       # CRUD + state-machine/
├── settlement/   # Lock/Unlock
└── prisma/       # Soft-delete middleware

apps/mobile/src/app/
├── core/db/      # Dexie.js offline_queue
└── store/        # NgRx SignalStore
```
