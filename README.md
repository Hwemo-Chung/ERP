# Logistics ERP

> 🚚 물류 센터와 현장 기사를 위한 **Offline-First** 주문 관리 시스템

[![Node.js](https://img.shields.io/badge/Node.js-20.18.0-green?logo=node.js)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/Angular-19.x-red?logo=angular)](https://angular.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-e0234e?logo=nestjs)](https://nestjs.com/)
[![License](https://img.shields.io/badge/License-Private-blue)](#)

---

## 📋 목차

- [개요](#-개요)
- [기술 스택](#-기술-스택)
- [빠른 시작](#-빠른-시작)
- [프로젝트 구조](#-프로젝트-구조)
- [주요 기능](#-주요-기능)
- [문서](#-문서)
- [개발 가이드](#-개발-가이드)

---

## 🎯 개요

ERP Logistics는 물류 센터의 주문 관리부터 현장 기사의 설치 완료까지 전 과정을 지원하는 통합 시스템입니다.

### 핵심 설계 원칙

- **Offline-First**: VPN 환경에서도 끊김 없이 작업 → 온라인 복귀 시 자동 동기화
- **State Machine**: 엄격한 주문 상태 관리로 데이터 무결성 보장
- **Multi-Platform**: 단일 코드베이스로 Web, Android, iOS 지원

---

## 🛠 기술 스택

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend** | NestJS + Prisma | 11.x / 6.x |
| **Frontend** | Angular + Ionic | 19.x / 8.x |
| **Mobile** | Capacitor | 6.x |
| **State** | NgRx SignalStore | 19.x |
| **Offline DB** | Dexie.js (IndexedDB) | 4.x |
| **Cache** | Redis | 7.x |
| **Database** | PostgreSQL | 15.x |

---

## 🚀 빠른 시작

### 1. 전제 조건

```bash
node --version   # v20.18.0 이상
pnpm --version   # 9.x 이상
docker --version # 설치 필수
```

### 2. 환경 설정

```bash
# 프로젝트 클론
git clone <repository-url>
cd ERP

# Node/Java 버전 설정
nvm use

# 환경 변수 복사
cp .env.example .env
# ⚠️ .env 파일의 값들을 실제 환경에 맞게 수정하세요

# 의존성 설치
pnpm install
```

### 3. 데이터베이스 시작

```bash
# Docker로 PostgreSQL + Redis 실행
docker compose up -d

# Prisma 스키마 동기화
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 4. 개발 서버 실행

```bash
# API 서버 (localhost:3000)
pnpm api:dev

# Mobile/Web (localhost:4200)
pnpm mobile:dev
```

> 📖 더 자세한 설정은 [docs/guides/QUICK_START.md](./docs/guides/QUICK_START.md) 참조

---

## 📁 프로젝트 구조

```
ERP/
├── apps/
│   ├── api/              # NestJS 백엔드
│   │   └── src/
│   │       ├── auth/         # JWT 인증
│   │       ├── orders/       # 주문 관리 + State Machine
│   │       ├── completion/   # 완료 처리
│   │       ├── settlement/   # 정산 관리
│   │       └── notifications/# Push + WebSocket
│   │
│   ├── mobile/           # Angular + Ionic (PWA/Mobile)
│   │   └── src/app/
│   │       ├── core/         # Services, Guards, Interceptors
│   │       ├── store/        # NgRx SignalStore
│   │       └── features/     # Lazy-loaded Pages
│   │
│   └── web/              # Web Admin Dashboard
│
├── prisma/               # Database Schema & Migrations
├── .doc/                 # Technical Documentation
├── .prompt-guides/       # AI Development Guides
└── scripts/              # Build & Utility Scripts
```

---

## ✨ 주요 기능

### 주문 관리
- 🔍 다중 필터 기반 주문 조회
- 📝 일괄 배정 및 예약 변경
- 🔄 상태 전환 (State Machine)
- 📱 시리얼 번호 스캔 완료

### Offline 지원
- 💾 IndexedDB 기반 로컬 저장
- 🔄 Background Sync 자동 동기화
- ⚠️ 충돌 감지 및 수동 병합

### 알림 시스템
- 📣 실시간 WebSocket 알림
- 🔔 Push Notification (FCM/APNs)

### 리포트 & 정산
- 📊 지점별 KPI 대시보드
- 📈 ECOAS 리포트 내보내기
- 🔐 주간 정산 잠금/해제

---

## 📚 문서

| 문서 | 설명 |
|------|------|
| [docs/README.md](./docs/README.md) | 📖 **문서 인덱스** |
| [docs/guides/QUICK_START.md](./docs/guides/QUICK_START.md) | 빠른 설정 가이드 |
| [CLAUDE.md](./CLAUDE.md) | AI 코딩 어시스턴트 가이드 |
| [docs/technical/PRD.md](./docs/technical/PRD.md) | 제품 요구사항 정의서 |
| [docs/technical/ARCHITECTURE.md](./docs/technical/ARCHITECTURE.md) | 시스템 아키텍처 |
| [docs/technical/API_SPEC.md](./docs/technical/API_SPEC.md) | API 명세서 |
| [docs/technical/DATABASE_SCHEMA.md](./docs/technical/DATABASE_SCHEMA.md) | 데이터베이스 스키마 |

---

## 💻 개발 가이드

### 커밋 컨벤션

```
type(scope): subject

# Types
feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert

# Scopes
api|mobile|web|prisma|auth|orders|users|reports|notifications|offline|deps|config
```

### 테스트 실행

```bash
# API 테스트
pnpm api:test

# Mobile 테스트
pnpm mobile:test

# 특정 파일만
cd apps/api && npm test -- --testPathPattern="orders"
```

### 빌드

```bash
# 전체 빌드
pnpm build

# 개별 빌드
pnpm api:build
pnpm mobile:build
```

---

## 📄 License

This project is private and confidential. All rights reserved.

---

<p align="center">
  <strong>Logistics ERP</strong> - Built with ❤️
</p>

