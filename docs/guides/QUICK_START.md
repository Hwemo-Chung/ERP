# Quick Start Guide

⚡ **5분 안에 개발 환경 구성하기**

## 1️⃣ 전제 조건 확인

```bash
# 설치 확인
node --version     # v20 이상
npm --version      # 10 이상
docker --version   # 설치됨
git --version      # 설치됨

# 설치 안 되어 있으면
# macOS: brew install node docker
# Ubuntu: apt-get install node.js docker.io
```

## 2️⃣ 프로젝트 설정 (2분)

```bash
# 프로젝트 디렉토리로 이동
cd /Users/solution/Documents/ERP

# Node/Java 버전 설정
nvm use
jenv local

# 의존성 설치
pnpm install

# 또는 npm
npm install
```

## 3️⃣ 환경 변수 설정 (1분)

```bash
# .env 파일 생성
cp .env.example .env

# 텍스트 편집기에서 열기
# vi .env

# 최소 설정:
# API_URL=http://localhost:3000
# DATABASE_URL=postgresql://user:password@localhost:5432/erp_db
```

## 4️⃣ 데이터베이스 시작 (1분)

```bash
# Docker로 PostgreSQL + Redis 시작
docker-compose up -d postgres redis

# 또는 전체 스택
docker-compose up -d
```

## 5️⃣ 개발 서버 시작 (선택사항)

### 옵션 A: 프론트엔드만 (모바일/웹)

```bash
cd apps/mobile
ng serve --open

# 자동으로 http://localhost:4200 열림
```

### 옵션 B: 백엔드만 (API)

```bash
cd apps/api
npm run start:dev

# http://localhost:3000/health 확인
```

### 옵션 C: 전체 스택 (모바일 + API + DB)

```bash
# Makefile 사용 (권장)
make dev-all

# 또는 수동
make docker-up
make dev-api &     # 백그라운드
make dev-mobile    # 포그라운드
```

---

## 📍 접속 주소

| 서비스 | 주소 | 설명 |
|--------|------|------|
| **Web App** | http://localhost:4200 | Angular 개발 서버 |
| **API** | http://localhost:3000 | NestJS API |
| **Health** | http://localhost:3000/health | API 헬스 체크 |
| **Prisma Studio** | http://localhost:5555 | 데이터베이스 GUI (선택) |
| **Redis** | localhost:6379 | Redis 캐시 |
| **PostgreSQL** | localhost:5432 | 데이터베이스 |

---

## 🔧 자주 사용하는 명령어

### 개발

```bash
# 핫 리로드 with 프론트엔드
make dev-mobile

# 핫 리로드 with 백엔드
make dev-api

# 데이터베이스 관리
make db-studio        # Prisma Studio 열기
make db-migrate       # 마이그레이션
make db-seed          # 테스트 데이터 로드
```

### 빌드

```bash
# 프로덕션 빌드
make build-mobile     # 프론트엔드
make build-api        # 백엔드
make build-all        # 둘 다

# 번들 분석
make bundle-analyze

# 크기 확인
make size-check
```

### 테스트

```bash
# 테스트 실행
make test-mobile      # 프론트엔드
make test-api         # 백엔드

# 커버리지
make test-cov

# 린팅
make lint-all
```

### Docker

```bash
# 시작/중지
make docker-up        # 시작
make docker-down      # 중지
make docker-logs      # 로그

# 이미지 빌드
make docker-build-mobile
make docker-build-api
```

### 정리

```bash
# 캐시/빌드 제거
make clean            # 빌드 아티팩트
make clean-deps       # node_modules
make clean-all        # 전체

# 캐시 비우기
make cache-clear
```

---

## 🐛 디버깅

### Chrome DevTools (프론트엔드)

```bash
# 1. 개발 서버 실행
ng serve

# 2. Chrome 열기
# http://localhost:4200

# 3. F12 눌러 DevTools 열기
# - Sources: 중단점 설정
# - Console: 로그 확인
# - Network: API 요청 보기
# - Application → Service Workers: SW 상태 확인
```

### VS Code 디버거 (백엔드)

```bash
# 1. VS Code에서 열기
code .

# 2. F5 눌러 디버깅 시작
# (.vscode/launch.json 필요)

# 또는 CLI
npm run start:debug
# chrome://inspect에서 연결
```

### 오프라인 모드 테스트

```bash
# Chrome DevTools에서
# 1. F12 → Network 탭
# 2. 드롭다운에서 "Offline" 선택
# 3. 앱이 오프라인 배너 표시
# 4. 온라인 복구 시 자동 동기화
```

---

## ❌ 일반적인 문제 해결

### "포트 이미 사용 중" 오류

```bash
# 포트 사용 프로세스 찾기
lsof -i :4200    # 프론트엔드
lsof -i :3000    # 백엔드
lsof -i :5432    # PostgreSQL

# 프로세스 중지
kill -9 <PID>

# 또는 다른 포트 사용
ng serve --port 4201
npm run start:dev -- --port 3001
```

### "Cannot find module" 오류

```bash
# 의존성 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 또는 캐시 제거
pnpm store prune
pnpm install
```

### 데이터베이스 연결 실패

```bash
# 1. Docker 컨테이너 실행 확인
docker-compose ps

# 2. 환경 변수 확인
cat .env | grep DATABASE_URL

# 3. Docker 재시작
docker-compose restart postgres

# 4. 마이그레이션 실행
npx prisma migrate deploy
```

### Service Worker 캐시 문제

```bash
# Chrome DevTools에서
# 1. F12 → Application → Service Workers
# 2. Unregister 클릭

# 또는 코드에서
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
window.location.reload();
```

---

## 📱 모바일 테스트

### Android 에뮬레이터

```bash
# 1. Android Studio에서 에뮬레이터 시작
# 또는 CLI:
emulator -avd Pixel_4_API_31

# 2. 앱 빌드 및 실행
make android-install

# 3. 로그 확인
adb logcat | grep "erp"
```

### iOS 시뮬레이터

```bash
# 1. 시뮬레이터 시작
xcrun simctl list devices

# 2. 앱 빌드
make ios-build

# 3. 실제 기기
# Xcode → Devices → 기기 선택
```

---

## 🚀 배포 (프로덕션)

### Docker로 배포

```bash
# 1. 이미지 빌드
make docker-build-mobile
make docker-build-api

# 2. 이미지 태그
docker tag erp-mobile:latest myregistry/erp-mobile:v1.0.0
docker tag erp-api:latest myregistry/erp-api:v1.0.0

# 3. 푸시
docker push myregistry/erp-mobile:v1.0.0
docker push myregistry/erp-api:v1.0.0

# 4. 배포 (Kubernetes, Docker Swarm 등)
```

### Kubernetes 배포

```bash
# 1. 이미지 빌드 및 푸시
make docker-push

# 2. 배포 매니페스트 생성
kubectl apply -f k8s/deployment.yaml

# 3. 상태 확인
kubectl get pods
kubectl logs pod-name
```

---

## 📚 추가 리소스

- **전체 빌드 가이드**: [BUILD_DEBUG_GUIDE.md](BUILD_DEBUG_GUIDE.md)
- **Makefile 명령어**: `make help`
- **설계서**: [.doc/SDD.md](.doc/SDD.md)
- **API 스펙**: [.doc/API_SPEC.md](.doc/API_SPEC.md)
- **아키텍처**: [.doc/ARCHITECTURE.md](.doc/ARCHITECTURE.md)

---

## 💡 팁

1. **Makefile 사용**
   ```bash
   make help          # 모든 명령어 보기
   make dev-all       # 전체 스택 시작
   make build-all     # 전체 빌드
   ```

2. **빠른 참조**
   ```bash
   # 가장 많이 사용
   ng serve           # 프론트엔드 dev
   npm run start:dev  # 백엔드 dev
   docker-compose up  # 데이터베이스
   ```

3. **Chrome DevTools 단축키**
   - `F12`: DevTools 열기
   - `Ctrl+Shift+J`: 콘솔 열기
   - `Ctrl+Shift+C`: 요소 검사

4. **VS Code 확장 추천**
   - Angular Language Service
   - Prettier - Code formatter
   - ESLint
   - REST Client
   - Thunder Client (API 테스트)

---

## 🆘 더 필요한 도움?

- **전체 가이드**: [BUILD_DEBUG_GUIDE.md](BUILD_DEBUG_GUIDE.md) 참고
- **Slack**: #dev-support 채널
- **이슈 제출**: [GitHub Issues](https://github.com/your-org/erp-logistics/issues)

---

**Happy Coding! 🎉**

마지막 업데이트: 2025-12-11
