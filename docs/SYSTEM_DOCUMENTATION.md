# 물류 ERP 시스템 문서

> 최종 업데이트: 2026-01-09
> 버전: 1.0.0

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [프로젝트 구조](#4-프로젝트-구조)
5. [데이터베이스 스키마](#5-데이터베이스-스키마)
6. [API 엔드포인트](#6-api-엔드포인트)
7. [실행 방법](#7-실행-방법)
8. [서비스 구성](#8-서비스-구성)
9. [주요 기능](#9-주요-기능)
10. [배포 가이드](#10-배포-가이드)

---

## 1. 시스템 개요

### 1.1 프로젝트 목적

물류 ERP(Enterprise Resource Planning) 시스템은 **오프라인 우선(Offline-First)** 주문 관리 시스템으로, 물류 센터와 현장 기사를 위한 통합 솔루션입니다.

### 1.2 주요 사용자

| 역할 | 설명 | 접근 앱 |
|------|------|---------|
| **HQ_ADMIN** | 본사 관리자 | Web |
| **BRANCH_MANAGER** | 지점 관리자 | Web |
| **PARTNER_COORDINATOR** | 파트너 코디네이터 | Web |
| **INSTALLER** | 현장 설치 기사 | Mobile |

### 1.3 시스템 특징

- **오프라인 우선**: 네트워크 연결 없이도 작업 가능, 연결 시 자동 동기화
- **실시간 알림**: 푸시 알림을 통한 즉각적인 상태 업데이트
- **상태 머신 기반**: 엄격한 주문 상태 전환 규칙 적용
- **정산 잠금**: 월별 정산 기간 데이터 보호

---

## 2. 기술 스택

### 2.1 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| **NestJS** | 11.x | API 서버 프레임워크 |
| **Prisma** | 6.x | ORM 및 데이터베이스 마이그레이션 |
| **PostgreSQL** | 15 | 주 데이터베이스 |
| **Redis** | 7 | 캐싱 및 세션 관리 |
| **TypeScript** | 5.9 | 타입 안전성 |

### 2.2 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| **Angular** | 19.x | 프론트엔드 프레임워크 |
| **Ionic** | 8.x | 모바일 UI 컴포넌트 |
| **Capacitor** | 6.x | 네이티브 앱 빌드 |
| **RxJS** | 7.x | 반응형 프로그래밍 |
| **Angular Signals** | - | 상태 관리 |

### 2.3 인프라

| 기술 | 용도 |
|------|------|
| **Docker** | 컨테이너화 |
| **Docker Compose** | 로컬 개발 환경 |
| **pnpm** | 패키지 관리 (Monorepo) |
| **Node.js** | 20.19.6 |

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 계층                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   Web App       │    │   Mobile App    │                     │
│  │   (Angular)     │    │ (Angular/Ionic) │                     │
│  │   :4300         │    │   :4200         │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           │    ┌─────────────────┘                               │
│           │    │                                                 │
│           ▼    ▼                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        API 계층                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 NestJS API Server                        │    │
│  │                     :3000                                │    │
│  │  ┌──────────┬──────────┬──────────┬──────────┐          │    │
│  │  │  Auth    │  Orders  │ Reports  │  Sync    │          │    │
│  │  │  Module  │  Module  │  Module  │  Module  │          │    │
│  │  └──────────┴──────────┴──────────┴──────────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
├─────────────────────────────────────────────────────────────────┤
│                        데이터 계층                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   PostgreSQL    │    │     Redis       │                     │
│  │     :5432       │    │     :6379       │                     │
│  │  (Primary DB)   │    │   (Cache)       │                     │
│  └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 데이터 흐름

1. **온라인 모드**: 클라이언트 → API → PostgreSQL
2. **오프라인 모드**: 클라이언트 → IndexedDB (로컬) → 동기화 큐 → API

---

## 4. 프로젝트 구조

```
ERP/
├── apps/
│   ├── api/                    # NestJS 백엔드 서버
│   │   └── src/
│   │       ├── auth/           # 인증/인가 모듈
│   │       ├── orders/         # 주문 관리 모듈
│   │       ├── reports/        # 리포트 모듈
│   │       ├── settlement/     # 정산 모듈
│   │       ├── notifications/  # 알림 모듈
│   │       ├── metadata/       # 메타데이터 모듈
│   │       ├── completion/     # 완료 처리 모듈
│   │       ├── health/         # 헬스체크 모듈
│   │       └── users/          # 사용자 관리 모듈
│   │
│   ├── web/                    # Angular 웹 앱 (관리자용)
│   │   └── src/app/
│   │       ├── core/           # 핵심 서비스, 인터셉터
│   │       └── features/       # 기능별 모듈
│   │           ├── auth/       # 로그인
│   │           ├── completion/ # 완료 관리
│   │           ├── settings/   # 설정
│   │           └── tabs/       # 탭 네비게이션
│   │
│   └── mobile/                 # Ionic 모바일 앱 (기사용)
│       └── src/app/
│           ├── core/           # 핵심 서비스
│           └── features/       # 기능별 모듈
│
├── prisma/
│   └── schema.prisma           # 데이터베이스 스키마
│
├── packages/                   # 공유 패키지
├── docker-compose.yml          # Docker 설정
└── package.json                # 루트 패키지 설정
```

---

## 5. 데이터베이스 스키마

### 5.1 핵심 엔티티

#### 사용자 관련
| 테이블 | 설명 |
|--------|------|
| `users` | 시스템 사용자 |
| `user_roles` | 사용자 역할 (HQ_ADMIN, BRANCH_MANAGER, PARTNER_COORDINATOR, INSTALLER) |
| `branches` | 지점 정보 |
| `partners` | 파트너사 정보 |
| `installers` | 설치 기사 정보 |

#### 주문 관련
| 테이블 | 설명 |
|--------|------|
| `orders` | 주문 정보 |
| `order_lines` | 주문 상세 항목 |
| `order_status_history` | 상태 변경 이력 |
| `order_events` | 주문 이벤트/특이사항 |
| `appointments` | 방문 일정 변경 이력 |
| `split_orders` | 분할 주문 |
| `cancellation_records` | 취소 기록 및 환입 추적 |

#### 완료/회수 관련
| 테이블 | 설명 |
|--------|------|
| `waste_pickups` | 폐기물 회수 (P01-P21) |
| `serial_numbers` | 시리얼 번호 |
| `attachments` | 첨부파일 |

#### 알림/동기화 관련
| 테이블 | 설명 |
|--------|------|
| `notifications` | 알림 |
| `notification_subscriptions` | 푸시 구독 정보 |
| `offline_sync_queue` | 오프라인 동기화 큐 |

#### 정산/감사 관련
| 테이블 | 설명 |
|--------|------|
| `settlement_periods` | 정산 기간 |
| `audit_logs` | 감사 로그 |
| `exports` | 엑스포트 작업 |

### 5.2 주문 상태 (OrderStatus)

```
UNASSIGNED (미배정)
    ↓
ASSIGNED (배정)
    ↓
CONFIRMED (배정확정)
    ↓
RELEASED (출고확정)
    ↓
DISPATCHED (출문)
    ↓
┌───────────────┬───────────────┬───────────────┐
↓               ↓               ↓               ↓
COMPLETED    PARTIAL      POSTPONED      ABSENT
(인수)       (부분인수)     (연기)        (부재)
    ↓
COLLECTED (회수)

* CANCELLED (취소), REQUEST_CANCEL (의뢰취소): 어느 단계에서든 전환 가능
```

---

## 6. API 엔드포인트

### 6.1 인증 (Auth)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/auth/login` | 로그인 |
| POST | `/api/v1/auth/logout` | 로그아웃 |
| POST | `/api/v1/auth/refresh` | 토큰 갱신 |
| GET | `/api/v1/auth/me` | 현재 사용자 정보 |

### 6.2 주문 (Orders)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/orders` | 주문 목록 조회 |
| GET | `/api/v1/orders/{id}` | 주문 상세 조회 |
| PATCH | `/api/v1/orders/{id}` | 주문 수정 |
| POST | `/api/v1/orders/{id}/cancel` | 주문 취소 |
| POST | `/api/v1/orders/{id}/reassign` | 배정 변경 |
| POST | `/api/v1/orders/{id}/split` | 주문 분할 |
| POST | `/api/v1/orders/{id}/revert` | 상태 되돌리기 |
| GET | `/api/v1/orders/stats` | 통계 조회 |
| POST | `/api/v1/orders/batch-sync` | 배치 동기화 |
| POST | `/api/v1/orders/bulk-status` | 일괄 상태 변경 |

### 6.3 완료 처리 (Completion)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/orders/{orderId}/complete` | 주문 완료 처리 |
| GET | `/api/v1/orders/{orderId}/completion` | 완료 정보 조회 |
| POST | `/api/v1/orders/{orderId}/waste` | 폐기물 등록 |

### 6.4 리포트 (Reports)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/reports/summary` | 요약 리포트 |
| GET | `/api/v1/reports/progress` | 진행 현황 |
| GET | `/api/v1/reports/waste-summary` | 폐기물 요약 |
| GET | `/api/v1/reports/customer-history` | 고객 이력 |
| GET | `/api/v1/reports/release-summary` | 출고 요약 |
| GET | `/api/v1/reports/install-confirmation` | 설치 확인서 |
| GET | `/api/v1/reports/unreturned` | 미환입 목록 |
| POST | `/api/v1/reports/unreturned/{orderId}/return` | 환입 처리 |

### 6.5 정산 (Settlement)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/settlement/current` | 현재 정산 기간 |
| GET | `/api/v1/settlement/history` | 정산 이력 |
| POST | `/api/v1/settlement/{id}/lock` | 정산 잠금 |
| POST | `/api/v1/settlement/{id}/unlock` | 정산 잠금 해제 (HQ_ADMIN 전용) |

### 6.6 알림 (Notifications)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/notifications` | 알림 목록 |
| PATCH | `/api/v1/notifications/{id}/ack` | 알림 확인 |
| POST | `/api/v1/notifications/subscribe` | 푸시 구독 |
| DELETE | `/api/v1/notifications/subscribe/{subscriptionId}` | 구독 해제 |
| GET | `/api/v1/notifications/preferences` | 알림 설정 조회 |
| PUT | `/api/v1/notifications/preferences` | 알림 설정 수정 |

### 6.7 메타데이터 (Metadata)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/metadata` | 전체 메타데이터 |
| GET | `/api/v1/metadata/branches` | 지점 목록 |
| GET | `/api/v1/metadata/partners` | 파트너 목록 |
| GET | `/api/v1/metadata/installers` | 기사 목록 |
| GET | `/api/v1/metadata/waste-types` | 폐기물 코드 |
| GET | `/api/v1/metadata/order-statuses` | 주문 상태 목록 |
| POST | `/api/v1/metadata/refresh` | 캐시 갱신 |

### 6.8 헬스체크 (Health)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/health` | 전체 상태 |
| GET | `/api/v1/health/ready` | 준비 상태 |
| GET | `/api/v1/health/live` | 생존 상태 |

---

## 7. 실행 방법

### 7.1 사전 요구사항

- Node.js 20.x 이상
- pnpm 9.x 이상
- Docker & Docker Compose
- nvm (Node Version Manager)

### 7.2 환경 설정

```bash
# 1. Node.js 버전 설정
nvm use

# 2. 의존성 설치
pnpm install

# 3. Docker 컨테이너 시작
docker compose up -d

# 4. 데이터베이스 설정
pnpm db:generate
pnpm db:migrate
```

### 7.3 개발 서버 실행

```bash
# API 서버 (포트 3000)
pnpm api:dev

# Web 앱 (포트 4300)
pnpm web:dev

# Mobile 앱 (포트 4200)
pnpm mobile:dev
```

### 7.4 빌드

```bash
# API 빌드
pnpm api:build

# Web 빌드
pnpm web:build

# Mobile 빌드
pnpm mobile:build

# iOS/Android 빌드
pnpm mobile:ios
pnpm mobile:android
```

---

## 8. 서비스 구성

### 8.1 개발 환경 서비스

| 서비스 | URL | 설명 |
|--------|-----|------|
| **API Server** | http://localhost:3000 | NestJS 백엔드 |
| **Swagger Docs** | http://localhost:3000/docs | API 문서 |
| **Web App** | http://localhost:4300 | 관리자 웹 |
| **Mobile App** | http://localhost:4200 | 기사용 모바일 |
| **PostgreSQL** | localhost:5432 | 데이터베이스 |
| **Redis** | localhost:6379 | 캐시 |
| **Adminer** | http://localhost:8080 | DB 관리 UI |

### 8.2 환경 변수

```env
# 데이터베이스
DATABASE_URL=postgresql://erp_user:erp_password@localhost:5432/erp_logistics

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d

# API
API_PORT=3000
API_PREFIX=/api
API_VERSION=1
```

---

## 9. 주요 기능

### 9.1 주문 관리
- 주문 생성, 조회, 수정
- 상태 전환 (상태 머신 기반)
- 주문 분할 (Split Order)
- 일괄 배정 및 상태 변경

### 9.2 완료 처리
- 시리얼 번호 입력
- 폐기물 회수 (P01-P21 코드)
- 고객 서명 캡처
- 설치 확인서 생성

### 9.3 오프라인 지원
- IndexedDB 로컬 저장
- 자동 동기화 큐
- 충돌 감지 및 해결
- Optimistic Locking (버전 관리)

### 9.4 정산 관리
- 월별 정산 기간 관리
- 정산 잠금/해제
- 잠금 기간 데이터 보호

### 9.5 리포트
- 진행 현황 대시보드
- 폐기물 수거 통계
- 고객 이력 조회
- 엑셀 내보내기

### 9.6 알림
- 실시간 푸시 알림
- 알림 카테고리별 설정
- 방해 금지 시간 설정

---

## 10. 배포 가이드

### 10.1 프로덕션 빌드

```bash
# 전체 빌드
pnpm api:build
pnpm web:build
pnpm mobile:build
```

### 10.2 Docker 이미지 빌드

```bash
# API 이미지
docker build -t erp-api:latest -f apps/api/Dockerfile .

# Web 이미지
docker build -t erp-web:latest -f apps/web/Dockerfile .
```

### 10.3 배포 체크리스트

- [ ] 환경 변수 설정 확인
- [ ] 데이터베이스 마이그레이션 실행
- [ ] SSL 인증서 설정
- [ ] 로드 밸런서 구성
- [ ] 헬스체크 엔드포인트 등록
- [ ] 로그 수집 설정
- [ ] 모니터링 대시보드 구성

### 10.4 주의사항

1. **inject() 사용**: Angular에서 `inject()`는 클래스 필드 초기화자에서만 사용 가능 (메서드 내부 사용 금지)

2. **API 응답 구조**: 응답 데이터 접근 시 `response.data.data` 이중 중첩 구조 주의

3. **상태 전환 규칙**: 허용되지 않은 상태 전환 시 400 에러 발생

4. **정산 잠금 에러**: E2002 에러 발생 시 HQ_ADMIN 권한으로 unlock 필요

---

## 부록

### A. 에러 코드

| 코드 | 설명 |
|------|------|
| E1xxx | 인증 관련 에러 |
| E2xxx | 주문/정산 관련 에러 |
| E3xxx | 동기화 관련 에러 |
| E4xxx | 검증 관련 에러 |
| E5xxx | 시스템 에러 |

### B. 폐기물 코드 (P01-P21)

회수 가능한 폐기물 종류를 나타내는 코드 체계입니다.
상세 코드 목록은 `/api/v1/waste/codes` 엔드포인트에서 조회 가능합니다.

---

*본 문서는 물류 ERP 시스템의 기술 문서입니다.*
