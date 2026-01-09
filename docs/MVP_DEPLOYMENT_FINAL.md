# 물류 ERP MVP 최종 배포 가이드

> **작성일**: 2026-01-09
> **버전**: 1.0.0
> **상태**: 프로덕션 준비 완료
> **예상 비용**: $0/월

---

## 핵심 요약

### 배포 구성 (완전 무료)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         🌐 인터넷                                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌─────────────────────┐               ┌─────────────────────┐
│   Cloudflare Pages  │               │   Cloudflare Pages  │
│      Web App        │               │     Mobile PWA      │
│   (무제한 대역폭)    │               │   (무제한 대역폭)    │
└──────────┬──────────┘               └──────────┬──────────┘
           │                                      │
           └──────────────────┬───────────────────┘
                              ▼
                   ┌─────────────────────┐
                   │     Render.com      │
                   │    NestJS API       │
                   │   (750시간/월 무료)  │
                   └──────────┬──────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
  ┌─────────────────────┐           ┌─────────────────────┐
  │        Neon         │           │      Upstash        │
  │    PostgreSQL       │           │       Redis         │
  │    (3GB 무료)       │           │  (50만 cmd/월 무료) │
  └─────────────────────┘           └─────────────────────┘
```

### 서비스 URL

| 구성요소 | 서비스 | 무료 도메인 |
|----------|--------|-------------|
| Web App | Cloudflare Pages | `erp-web.pages.dev` |
| Mobile PWA | Cloudflare Pages | `erp-mobile.pages.dev` |
| API | Render | `erp-api.onrender.com` |
| PostgreSQL | Neon | (내부 연결) |
| Redis | Upstash | (내부 연결) |

---

## 📋 배포 체크리스트

### Phase 1: 계정 생성 (15분)

- [ ] **Neon** 가입: https://console.neon.tech/signup
- [ ] **Upstash** 가입: https://console.upstash.com/login
- [ ] **Render** 가입: https://dashboard.render.com/register
- [ ] **Cloudflare** 가입: https://dash.cloudflare.com/sign-up
- [ ] **UptimeRobot** 가입: https://uptimerobot.com/signUp

### Phase 2: 데이터베이스 설정 (10분)

- [ ] Neon 프로젝트 생성 (`erp-logistics`, Singapore 리전)
- [ ] `DATABASE_URL` 복사 및 저장
- [ ] 마이그레이션 실행:
  ```bash
  DATABASE_URL="복사한_URL" pnpm --filter erp-logistics-api run prisma:migrate:prod
  ```

### Phase 3: Redis 설정 (5분)

- [ ] Upstash 데이터베이스 생성 (`erp-redis`, Tokyo 리전)
- [ ] `REDIS_URL` 복사 및 저장

### Phase 4: 시크릿 생성 (5분)

- [ ] JWT 시크릿 생성:
  ```bash
  node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
  node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] VAPID 키 생성:
  ```bash
  npx web-push generate-vapid-keys
  ```

### Phase 5: 백엔드 배포 (15분)

- [ ] Render → New Web Service
- [ ] GitHub 연결 및 설정:
  - Root Directory: `apps/api`
  - Build: `cd ../.. && pnpm install && pnpm db:generate && cd apps/api && pnpm build`
  - Start: `node dist/main`
- [ ] 환경 변수 설정 (아래 표 참조)
- [ ] 배포 완료 확인

### Phase 6: 프론트엔드 설정 (10분)

- [ ] `apps/web/src/environments/environment.prod.ts` 수정:
  ```typescript
  export const environment = {
    production: true,
    apiUrl: 'https://erp-api.onrender.com/api/v1',
    vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY',
    appVersion: '1.0.0',
    sentryDsn: '',
  };
  ```
- [ ] `apps/mobile/src/environments/environment.prod.ts` 동일하게 수정
- [ ] 변경사항 커밋 & 푸시

### Phase 7: 프론트엔드 배포 (15분)

- [ ] Cloudflare Pages → Create project (Web)
  - Build: `cd apps/web && npm install -g pnpm && pnpm install && pnpm build`
  - Output: `apps/web/dist/web/browser`
- [ ] Cloudflare Pages → Create project (Mobile)
  - Build: `cd apps/mobile && npm install -g pnpm && pnpm install && pnpm build`
  - Output: `apps/mobile/www`
- [ ] 환경 변수: `NODE_VERSION=20`

### Phase 8: 슬립 방지 설정 (5분)

- [ ] UptimeRobot 모니터 추가:
  - URL: `https://erp-api.onrender.com/api/v1/health`
  - 간격: 5분

### Phase 9: 최종 검증 (10분)

- [ ] API 헬스체크: `curl https://erp-api.onrender.com/api/v1/health`
- [ ] Web 로그인 테스트
- [ ] Mobile 로그인 테스트
- [ ] 주문 목록 조회 테스트
- [ ] 상태 변경 테스트

**총 예상 시간: 약 90분**

---

## 🔧 환경 변수 설정

### Render 백엔드 환경 변수

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NODE_ENV` | `production` | 프로덕션 환경 |
| `DATABASE_URL` | `postgresql://...` | Neon 연결 URL |
| `REDIS_URL` | `rediss://...` | Upstash 연결 URL |
| `JWT_ACCESS_SECRET` | `(64자 랜덤)` | 액세스 토큰 서명 |
| `JWT_REFRESH_SECRET` | `(64자 랜덤)` | 리프레시 토큰 서명 |
| `VAPID_PUBLIC_KEY` | `(생성된 키)` | 푸시 알림 공개키 |
| `VAPID_PRIVATE_KEY` | `(생성된 키)` | 푸시 알림 비밀키 |

### 시크릿 생성 명령어

```bash
# JWT 시크릿 (각각 실행)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# VAPID 키
npx web-push generate-vapid-keys
```

---

## 📊 무료 티어 제한 및 모니터링

### 리소스 현황

| 서비스 | 무료 한도 | 사용량 확인 |
|--------|-----------|-------------|
| Cloudflare Pages | 빌드 500회/월 | Dashboard → Pages |
| Render | 750시간/월 | Dashboard → Usage |
| Neon | 3GB 스토리지 | Dashboard → Usage |
| Upstash | 50만 명령/월 | Dashboard → Usage |

### 알림 설정 권장

- Render: 사용량 80% 알림 설정
- Neon: 스토리지 2.5GB 알림
- Upstash: 40만 명령 알림

---

## 🚨 트러블슈팅

### 문제 1: API 첫 요청 느림 (30초)

**원인**: Render 무료 티어 슬립
**해결**: UptimeRobot 5분 핑 설정

### 문제 2: CORS 에러

**원인**: API CORS 설정 누락
**해결**: `apps/api/src/main.ts`에서 origin 추가
```typescript
app.enableCors({
  origin: [
    'https://erp-web.pages.dev',
    'https://erp-mobile.pages.dev',
  ],
  credentials: true,
});
```

### 문제 3: 데이터베이스 연결 실패

**원인**: SSL 미설정
**해결**: DATABASE_URL에 `?sslmode=require` 확인

### 문제 4: 빌드 실패 (Cloudflare)

**원인**: Node 버전 불일치
**해결**: 환경 변수 `NODE_VERSION=20` 추가

---

## 📈 스케일 업 시점

| 상황 | 지표 | 조치 |
|------|------|------|
| 사용자 100+ | API 응답 > 2초 | Render 유료 ($7/월) |
| 데이터 2GB+ | Neon 80% | Neon 유료 ($19/월) |
| 고트래픽 | Redis 40만+ | Upstash 유료 (사용량) |

---

## 📁 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 시스템 문서 | `docs/SYSTEM_DOCUMENTATION.md` | 전체 시스템 개요 |
| 호스팅 조사 | `docs/FREE_HOSTING_REPORT.md` | 무료 호스팅 비교 |
| 기존 배포 가이드 | `docs/DEPLOYMENT_GUIDE.md` | Docker/K8s 배포 |
| 사용자 가이드 | `docs/USER_GUIDE.md` | 앱 사용법 |

---

## ✅ 최종 확인

배포 완료 후 확인 사항:

```bash
# 1. API 헬스체크
curl -s https://erp-api.onrender.com/api/v1/health | jq

# 예상 응답:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" },
    "storage": { "status": "up" }
  }
}

# 2. 프론트엔드 접속
open https://erp-web.pages.dev
open https://erp-mobile.pages.dev
```

---

**배포 준비 상태**: ✅ READY
**예상 월 비용**: $0
**신용카드 필요**: ❌ 불필요
