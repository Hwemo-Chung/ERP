# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

Logistics ERP - Offline-first order management system (logistics center + field drivers)

## Quick Commands

```bash
nvm use && docker compose up -d          # Environment
pnpm db:generate && pnpm db:migrate      # DB setup
pnpm api:dev                             # Backend :3000
pnpm mobile:dev                          # Mobile :4200
```

## Critical Rules

1. **inject()** - Use only in class field initializers; do not call it inside methods.
2. **API Response** - Always access the double-nested `response.data.data` payload.
3. **State Machine** - Invalid state-transition rules return 400 errors.
4. **Settlement Lock** - Unlock with HQ_ADMIN authority when an E2002 error occurs.

## Project Skills

| Skill | Trigger |
|-------|---------|
| erp-angular | When working with inject, signals, or components |
| erp-api | API calls, error codes, and headers |
| erp-state | Order state transitions and E2002 errors |
| erp-db | Prisma, 409 conflicts, and soft delete |
| erp-debug | Debugging and resolving 401/409/400 errors |

## Tech Stack

NestJS 11 + Prisma 6 | Angular 19 + Ionic 8 | Capacitor 6 | PostgreSQL 15 | Redis 7
