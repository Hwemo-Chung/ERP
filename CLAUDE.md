# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

Logistics ERP - Offline-First 주문 관리 시스템 (물류 센터 + 현장 기사)

## Quick Commands

```bash
nvm use && docker compose up -d          # Environment
pnpm db:generate && pnpm db:migrate      # DB setup
pnpm api:dev                             # Backend :3000
pnpm mobile:dev                          # Mobile :4200
```

## Critical Rules

1. **inject()** - 클래스 필드 초기화자에서만 사용 (메서드 내부 금지)
2. **API Response** - `response.data.data` 이중 중첩 접근 필수
3. **State Machine** - 상태 전환 규칙 위반 시 400 에러 발생
4. **Settlement Lock** - E2002 에러 시 HQ_ADMIN 권한으로 unlock

## Project Skills

| Skill | Trigger |
|-------|---------|
| erp-angular | inject, signal, component 작업 시 |
| erp-api | API 호출, 에러코드, 헤더 관련 |
| erp-state | 주문 상태 전환, E2002 에러 |
| erp-db | Prisma, 409 충돌, soft delete |
| erp-debug | 디버깅, 401/409/400 에러 해결 |

## Tech Stack

NestJS 11 + Prisma 6 | Angular 19 + Ionic 8 | Capacitor 6 | PostgreSQL 15 | Redis 7
