---
name: erp-state
description: This skill should be used when working with order status transitions, state machine, settlement lock, or E2002 errors in this ERP project.
---

## Order State Flow

```
UNASSIGNED → ASSIGNED → CONFIRMED → RELEASED → DISPATCHED ─┬→ COMPLETED → COLLECTED
               │                         │                  ├→ POSTPONED
               └─ revert only ◄──────────┘                  └→ ABSENT (max 3)

Any state → REQUEST_CANCEL → CANCELLED (HQ approval)
```

## Transition Guards

Location: `apps/api/src/orders/state-machine/`

| Transition | Guard |
|------------|-------|
| ASSIGNED → CONFIRMED | branch staff only |
| RELEASED → DISPATCHED | appointment_date === today |
| DISPATCHED → COMPLETED | serial_number required |
| revert to UNASSIGNED | within 5 days of completion |

## Settlement Lock

- Auto-lock every Monday
- Previous week data becomes read-only
- Error: E2002
- Fix: HQ_ADMIN calls `/api/settlement/{id}/unlock`
