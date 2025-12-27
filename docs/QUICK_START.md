# Quick Start Guide (빠른 시작 가이드)

## 5분 안에 시작하기

### 1. 환경 준비 (1분)
```bash
cd /Users/solution/Documents/ERP
nvm use
pnpm install
```

### 2. Docker 시작 (30초)
```bash
docker compose up -d
```

### 3. 데이터베이스 설정 (1분)
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 4. 서비스 시작 (2분)

**터미널 1 - API:**
```bash
pnpm api:dev
# ✓ http://localhost:3000
```

**터미널 2 - 모바일 앱:**
```bash
pnpm mobile:dev
# ✓ http://localhost:4200
```

### 5. 로그인
- URL: http://localhost:4200
- ID: `admin`
- PW: `admin123`

---

## 자주 사용하는 명령어

| 목적 | 명령어 |
|------|--------|
| Docker 시작 | `docker compose up -d` |
| Docker 중지 | `docker compose down` |
| API 서버 | `pnpm api:dev` |
| 모바일 앱 | `pnpm mobile:dev` |
| 웹 앱 | `pnpm web:dev` |
| DB 브라우저 | `pnpm db:studio` |
| 빌드 | `pnpm build` |

---

## 데이터베이스 확인

### Prisma Studio (GUI)
```bash
pnpm db:studio
# http://localhost:5555 에서 열림
```

### psql (CLI)
```bash
docker exec -it erp-postgres psql -U postgres -d logistics_erp

# 테이블 목록
\dt

# 사용자 조회
SELECT id, username, role FROM "User";

# 주문 조회
SELECT id, "erpOrderNumber", status FROM "Order" LIMIT 10;

# 종료
\q
```

---

## 포트 번호

| 서비스 | 포트 | 확인 URL |
|--------|------|----------|
| API | 3000 | http://localhost:3000/api/health |
| Mobile | 4200 | http://localhost:4200 |
| Web | 4300 | http://localhost:4300 |
| DB Studio | 5555 | http://localhost:5555 |
| Swagger | 3000 | http://localhost:3000/api/docs |

---

## 문제 해결

### "포트가 이미 사용 중"
```bash
lsof -i :3000  # 또는 4200, 4300
kill -9 <PID>
```

### "DB 연결 실패"
```bash
docker compose restart
```

### "모듈을 찾을 수 없음"
```bash
pnpm install
pnpm db:generate
```
