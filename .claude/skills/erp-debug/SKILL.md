---
name: erp-debug
description: This skill should be used when debugging 401, 409, 400 errors, orders not displaying, inject() errors, or offline sync issues in this ERP project.
---

## Quick Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| 400 status change | State machine violation | Check erp-state skill |
| 401 every request | Token expired | Check auth.interceptor.ts |
| 409 Conflict | Version mismatch | Refetch then retry |
| E2002 | Settlement locked | HQ_ADMIN unlock |
| Orders empty | response.data access | Use response.data.data |
| inject() error | Called in method | Move to field initializer |
| Offline queue stuck | iOS Safari | Manual retry button |

## Known Bug Patterns

| Component | Bug | Solution |
|-----------|-----|----------|
| inject() | In method | Field initializer only |
| Auth Token | Restore expired | Check isTokenExpired() first |
| loadOrders | Wrong injection | Use AuthService for user data |
| Auth Guard | Re-init per route | Use initialized flag |

## Test Commands

```bash
pnpm --filter erp-logistics-api test
pnpm --filter mobile test
pnpm test:e2e:run
```

## Test Users

- admin@example.com / Admin123! (HQ_ADMIN)
- manager@example.com / Manager123! (BRANCH_MANAGER)
