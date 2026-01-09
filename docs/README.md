# ERP Logistics Documentation

This directory contains essential documentation for the ERP Logistics project.

> **최종 업데이트**: 2026-01-09
> **프로젝트 상태**: ✅ MVP 준비 완료

---

## 🚀 MVP 배포 (무료 호스팅)

| Document | Purpose |
|----------|---------|
| **[MVP_DEPLOYMENT_FINAL.md](./MVP_DEPLOYMENT_FINAL.md)** | ⭐ MVP 무료 배포 체크리스트 |
| **[FREE_HOSTING_REPORT.md](./FREE_HOSTING_REPORT.md)** | 무료 호스팅 조사 보고서 |
| **[SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md)** | 전체 시스템 문서 (아키텍처, API, DB) |

### 무료 배포 구성

```
Cloudflare Pages (프론트엔드) → Render (백엔드) → Neon (DB) + Upstash (Redis)
```

**예상 비용**: $0/월 | **신용카드**: 불필요

---

## 📚 전체 문서 목록

### 배포 & 운영

| Document | Purpose |
|----------|---------|
| **DEPLOYMENT_GUIDE.md** | Docker/K8s 프로덕션 배포 |
| **DEV_CREDENTIALS.md** | 개발 환경 설정 & 인증 정보 |
| **STARTUP_GUIDE.md** | 프로젝트 시작 가이드 |

### 기능 & 테스트

| Document | Purpose |
|----------|---------|
| **USER_GUIDE.md** | 사용자 가이드 |
| **QUICK_START.md** | 빠른 시작 가이드 |
| **E2E_TESTING.md** | Cypress E2E 테스트 |
| **FEATURE_MANUAL.md** | 기능 상세 매뉴얼 |

### 기술 문서

| Document | Purpose |
|----------|---------|
| **PERFORMANCE_OPTIMIZATION_REPORT.md** | 성능 최적화 보고서 |
| **PRD_Notifications.md** | 알림 시스템 PRD |
| **RESPONSIVE_LAYOUT_GUIDE.md** | 반응형 디자인 가이드 |
| **PROGRESS.md** | 기능 구현 진행 상황 |

---

## 📁 Subdirectories

- `ai-prompts/` - AI assistant prompts & configurations
- `guides/` - Additional development guides
- `technical/` - Technical specifications (API, DB Schema, Architecture)
- `_archive/` - Archived/outdated documentation

---

## 🔗 Quick Links

| 작업 | 문서 |
|------|------|
| **MVP 배포** | [MVP_DEPLOYMENT_FINAL.md](./MVP_DEPLOYMENT_FINAL.md) |
| **개발 시작** | [DEV_CREDENTIALS.md](./DEV_CREDENTIALS.md) |
| **테스트 실행** | [E2E_TESTING.md](./E2E_TESTING.md) |
| **시스템 이해** | [SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md) |

---

## 🛠️ 기술 스택

```
Backend:   NestJS 11 + Prisma 6 + PostgreSQL 15 + Redis 7
Frontend:  Angular 19 + Ionic 8 + Capacitor 6
Build:     pnpm 9 + Node.js 20.19.6
```

---

## 📞 Support

- **Issues**: GitHub Issues
- **기술 문서**: `/docs/technical/`
- **API 문서**: `http://localhost:3000/docs` (Swagger)
