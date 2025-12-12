# 📦 배포 및 운영 가이드

**상태**: ✅ 100% 완료 (2025.12.21)  
**버전**: v1.0.0  
**마지막 업데이트**: 2025.12.21

---

## 📋 목차

1. [사전 준비](#-사전-준비)
2. [로컬 개발 환경](#-로컬-개발-환경)
3. [프로덕션 빌드](#-프로덕션-빌드)
4. [배포 전략](#-배포-전략)
5. [모니터링 및 운영](#-모니터링-및-운영)
6. [문제 해결](#-문제-해결)

---

## 🔧 사전 준비

### 시스템 요구사항

```bash
# Node.js 20+ 확인
node --version  # v20.18.0+

# pnpm 8+ 확인
pnpm --version  # 8.15.0+

# Docker & Docker Compose 확인
docker --version
docker-compose --version
```

### 환경 변수 설정

```bash
# .env.local 파일 생성
cat > .env.local << EOF
# API
NODE_ENV=production
API_URL=https://api.erp.example.com
API_PORT=3000

# Database
DATABASE_URL=postgresql://user:password@db-host:5432/erp_prod
DATABASE_SSL=true

# JWT
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=3600

# AWS/Storage
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_BUCKET=erp-uploads-prod

# Redis (캐싱)
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# 로깅
LOG_LEVEL=info
SENTRY_DSN=https://xxx@sentry.io/xxx

# 메일
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx@gmail.com
SMTP_PASSWORD=xxx
EOF

chmod 600 .env.local
```

---

## 🏗️ 로컬 개발 환경

### 1단계: 저장소 클론 및 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/erp.git
cd erp

# 의존성 설치
pnpm install

# Git hook 설정
pnpm prepare

# 환경 변수 설정
cp .env.example .env.local
```

### 2단계: 데이터베이스 초기화

```bash
# Docker로 PostgreSQL 시작
docker-compose up -d db redis

# 마이그레이션 실행
pnpm run db:migrate

# 테스트 데이터 로드 (선택)
pnpm run db:seed
```

### 3단계: 개발 서버 시작

```bash
# 터미널 1: API 서버
pnpm run api:dev

# 터미널 2: 웹앱
pnpm run web:dev

# 터미널 3: 모바일앱 (선택)
pnpm run mobile:dev
```

### 4단계: 테스트

```bash
# E2E 테스트 (Interactive)
pnpm run test:e2e:open

# E2E 테스트 실행
pnpm run test:e2e:run

# 단위 테스트
pnpm run test

# 린팅
pnpm run lint

# 코드 포맷팅
pnpm run format
```

---

## 🚀 프로덕션 빌드

### 1단계: 빌드

```bash
# API 빌드
pnpm run api:build

# 웹앱 빌드 (프로덕션 최적화)
pnpm run web:build

# 모바일앱 빌드 (선택)
pnpm run mobile:build

# 빌드 산출물 확인
ls -lh dist/apps/
```

### 2단계: 빌드 검증

```bash
# 번들 크기 확인
npm run bundle:analyze

# Lighthouse 점수 확인
npm run lighthouse

# 테스트 실행
pnpm run test:e2e:run
```

### 3단계: Docker 이미지 빌드

```bash
# API 이미지 빌드
docker build -f Dockerfile.api \
  -t erp-api:v1.0.0 \
  -t erp-api:latest \
  .

# 웹앱 이미지 빌드 (선택)
docker build -f Dockerfile.web \
  -t erp-web:v1.0.0 \
  -t erp-web:latest \
  .

# 이미지 확인
docker images | grep erp
```

---

## 📦 배포 전략

### 옵션 1: Docker Compose (소규모/스테이징)

```bash
# 이미지 빌드
docker-compose build

# 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f api web

# 헬스 체크
curl http://localhost:3000/health
curl http://localhost:4200

# 중지
docker-compose down
```

### 옵션 2: Kubernetes (대규모)

```bash
# 네임스페이스 생성
kubectl create namespace erp-prod

# 시크릿 생성
kubectl create secret generic erp-secrets \
  --from-literal=db-url=$DATABASE_URL \
  --from-literal=jwt-secret=$JWT_SECRET \
  -n erp-prod

# ConfigMap 생성
kubectl create configmap erp-config \
  --from-literal=api-url=$API_URL \
  --from-literal=log-level=info \
  -n erp-prod

# 배포
kubectl apply -f k8s/ -n erp-prod

# 상태 확인
kubectl get pods -n erp-prod
kubectl get svc -n erp-prod

# 로그 확인
kubectl logs -f deployment/api -n erp-prod
```

### 옵션 3: 클라우드 플랫폼

#### Azure App Service
```bash
# 리소스 생성
az appservice plan create -g myResourceGroup \
  -n myAppPlan --sku B2 --is-linux

az webapp create -g myResourceGroup \
  -p myAppPlan -n erp-api

# 배포
az webapp up -g myResourceGroup -n erp-api \
  --runtime "NODE|20"
```

#### AWS ECS
```bash
# 클러스터 생성
aws ecs create-cluster --cluster-name erp-prod

# 작업 정의 등록
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# 서비스 생성
aws ecs create-service --cluster erp-prod \
  --service-name api --task-definition erp-api
```

---

## 📊 모니터링 및 운영

### 로깅

```bash
# 구조화된 로깅
# src/common/logger/logger.service.ts

logger.info('Order created', {
  orderId: order.id,
  userId: user.id,
  timestamp: new Date().toISOString()
});

# Sentry (에러 추적)
Sentry.captureException(error, {
  tags: {
    feature: 'orders',
    severity: 'critical'
  }
});
```

### 메트릭스

```bash
# Prometheus 메트릭 수집
curl http://localhost:3000/metrics

# 주요 메트릭:
- http_request_duration_seconds
- db_query_duration_seconds
- cache_hit_ratio
- memory_usage_bytes
```

### Health Check

```bash
# 헬스 체크 엔드포인트
GET /health

# 응답:
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected",
  "checks": {
    "memory": { "used": "256MB", "max": "512MB" },
    "disk": { "free": "20GB" }
  }
}
```

### 백업 및 복구

```bash
# 데이터베이스 백업
pg_dump -h localhost -U user erp_prod > backup.sql

# 압축 백업
pg_dump -h localhost -U user erp_prod | gzip > backup.sql.gz

# 복구
psql -h localhost -U user erp_prod < backup.sql

# 자동 백업 설정 (cron)
0 2 * * * pg_dump -h localhost -U user erp_prod | gzip > /backups/$(date +\%Y\%m\%d).sql.gz
```

---

## 🔐 보안 체크리스트

### 배포 전 확인

- [ ] JWT_SECRET 는 강력한 값으로 설정
- [ ] 환경 변수는 `.env.local`에만 저장
- [ ] 데이터베이스 SSL 연결 활성화
- [ ] API 속도 제한 설정
- [ ] CORS 정책 검증
- [ ] HTTPS 인증서 설치
- [ ] 방화벽 규칙 설정
- [ ] 로깅에서 민감한 정보 제거

### 운영 중 점검

```bash
# 의존성 취약점 확인
pnpm audit

# 컨테이너 이미지 스캔
docker scan erp-api:latest

# SSL 인증서 확인
openssl s_client -connect api.example.com:443
```

---

## 🚨 문제 해결

### API 서버 시작 안 됨

```bash
# 포트 확인
lsof -i :3000

# 로그 확인
pnpm run api:dev -- --debug

# 데이터베이스 연결 확인
psql -h localhost -U user -d erp_prod -c "SELECT 1;"
```

### 데이터베이스 마이그레이션 실패

```bash
# 마이그레이션 상태 확인
pnpm run db:migrate:status

# 마이그레이션 롤백
pnpm run db:migrate:revert

# 기본값으로 재설정
pnpm run db:migrate:reset
pnpm run db:seed
```

### 메모리 누수

```bash
# 힙 덤프 생성
kill -USR2 $PID

# 메모리 모니터링
node --inspect=0.0.0.0:9229 dist/apps/api/main.js

# Chrome DevTools: chrome://inspect
```

### Redis 연결 문제

```bash
# Redis 상태 확인
redis-cli ping

# 메모리 사용량 확인
redis-cli info memory

# 캐시 초기화
redis-cli FLUSHALL
```

---

## 📈 성능 튜닝

### 데이터베이스 최적화

```sql
-- 인덱스 생성
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- 실행 계획 분석
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 1;

-- 테이블 분석 (통계 갱신)
ANALYZE orders;
```

### API 성능 최적화

```typescript
// 캐싱 전략
@CacheKey('orders:{{user_id}}')
@CacheTTL(3600)
async getOrders(userId: number) {
  return this.ordersService.find({ userId });
}

// 페이지네이션
async listOrders(page: number = 1, limit: number = 20) {
  return this.ordersService.find({}, {
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}

// 쿼리 최적화
const orders = await this.prisma.order.findMany({
  select: {
    id: true,
    status: true,
    createdAt: true,
    user: { select: { name: true } }
  }
});
```

### 웹앱 성능 최적화

```typescript
// 번들 분석
npm run bundle:analyze

// 이미지 최적화
const optimized = await this.imageOptimizationService.optimizeImage(file);

// Virtual Scrolling
<cdk-virtual-scroll-viewport itemSize="60">
  <div *cdkVirtualFor="let item of orders">
    {{ item.id }}
  </div>
</cdk-virtual-scroll-viewport>
```

---

## 📚 참고 자료

### 문서
- [API 명세](./technical/API_SPEC.md)
- [데이터베이스 스키마](./technical/DATABASE_SCHEMA.md)
- [시스템 아키텍처](./technical/ARCHITECTURE.md)
- [성능 최적화](./PERFORMANCE_OPTIMIZATION_REPORT.md)

### 외부 리소스
- [NestJS 문서](https://docs.nestjs.com/)
- [Angular 문서](https://angular.io/)
- [Prisma 문서](https://www.prisma.io/docs/)
- [PostgreSQL 최적화](https://www.postgresql.org/docs/current/performance.html)

---

## 📞 지원

### 로컬 개발 문제
```bash
# 노드 모듈 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 배포 이슈
- GitHub Issues: https://github.com/your-org/erp/issues
- 기술 문서: `/docs` 폴더

### 긴급 상황
- Sentry: https://sentry.io/projects/erp/
- 데이터베이스: `pg_stat_activity` 확인
- API: Health check 엔드포인트 모니터링

---

**프로젝트 상태**: ✅ 100% 완료  
**배포 준비**: READY 🚀  
**버전**: v1.0.0 (2025.12.21)
