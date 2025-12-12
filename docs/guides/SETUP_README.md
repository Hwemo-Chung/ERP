# 원샷 설정 스크립트 (One-Shot Setup) - 듀얼 버전

⚡ **한 번의 실행으로 웹 + 모바일 ERP 시스템을 완전히 설정합니다.**

---

## 🚀 빠른 시작

### macOS / Linux

```bash
# 프로젝트 디렉토리로 이동
cd /Users/solution/Documents/ERP

# 스크립트 실행
./setup.sh
```

### Windows

```bash
# 프로젝트 디렉토리로 이동
cd \Users\solution\Documents\ERP

# 스크립트 실행
setup.bat
```

또는 파일 탐색기에서 `setup.bat` 파일을 더블클릭하세요.

---

## 📱 이중 플랫폼 아키텍처

ERP 시스템은 **두 가지 사용자 그룹**을 지원합니다:

| 사용자 | 플랫폼 | 용도 | 설명 |
|--------|--------|------|------|
| **본부 (Branch Manager)** | 웹 앱 (PWA) | 데스크톱/태블릿 | http://localhost:4200 |
| **사원 (Field Staff)** | 모바일 앱 | 실제 모바일 앱 | Android/iOS + http://localhost:4201 |

### 설치 옵션

스크립트 실행 시 **3가지 선택**이 가능합니다:

```
1️⃣  웹 버전만
    • PWA (Progressive Web App) - 브라우저 기반
    • 데스크톱 및 모바일 브라우저에서 작동
    • http://localhost:4200

2️⃣  모바일 앱만
    • Ionic + Capacitor 기반
    • 실제 네이티브 모바일 앱 (Android/iOS)
    • http://localhost:4200 (개발 서버)

3️⃣  둘 다 설치 (권장)
    • 완전한 ERP 시스템
    • 웹: http://localhost:4200
    • 모바일: http://localhost:4201 (개발 서버)
```

---

## ✨ 자동 설정되는 항목

### ✅ Step 1: 전제 조건 확인

```
✓ Node.js (v20 LTS)
✓ npm / pnpm
✓ Git
✓ Docker (자동 설치)
✓ Docker Compose (자동 설치)
```

**필요한 도구가 없으면 자동으로 설치합니다!**

- **macOS**: Homebrew를 통해 Docker Desktop 설치
- **Linux**: apt를 통해 docker.io 설치
- **Windows**: 수동 설치 가이드 제공

### ✅ Step 2: 설치할 앱 타입 선택

```bash
선택 (1-3):
1. 웹 버전만
2. 모바일 앱만
3. 둘 다 (권장)
```

선택에 따라 나머지 단계가 자동으로 조정됩니다.

### ✅ Step 3: 의존성 설치

```
• 루트 레벨 node_modules 확인
• 선택된 앱별 node_modules 자동 설치
  - apps/web (Step 2에서 웹 선택 시)
  - apps/mobile (Step 2에서 모바일 선택 시)
• pnpm이 있으면 pnpm, 없으면 npm 사용
```

### ✅ Step 4: 환경 변수 설정

```
• .env.example → .env로 자동 복사
• 필요시 수정 안내
• API_URL, DATABASE_URL, JWT_SECRET 등
```

### ✅ Step 5: Docker 서비스 시작

```
• Docker 데몬 실행 확인
• docker-compose up -d postgres redis
• PostgreSQL 준비 대기
• Redis 캐시 서버 시작
```

### ✅ Step 6: 데이터베이스 마이그레이션

```
• 선택사항 (y/n)
• npx prisma migrate deploy 실행
• 선택 안 하면 건너뜸
```

### ✅ Step 7: 개발 서버 시작

선택된 앱 타입에 따라 다양한 옵션:

#### 웹만 선택 시
```
1. 웹만 (port 4200)
2. 백엔드만 (port 3000)
3. 웹 + 백엔드
4. 수동 실행
```

#### 모바일만 선택 시
```
1. 모바일만 (port 4200)
2. 백엔드만 (port 3000)
3. 모바일 + 백엔드
4. 수동 실행
```

#### 웹 + 모바일 선택 시 (권장)
```
1. 웹만 (port 4200)
2. 모바일만 (port 4201)
3. 웹 + 모바일 (새 터미널 2개)
4. 백엔드만 (port 3000)
5. 전체 (웹 + 모바일 + 백엔드 - 새 터미널 3개)
6. 수동 실행
```

---

## 📍 접속 주소

### 웹 + 모바일 설치 시

| 서비스 | 주소 | 설명 |
|--------|------|------|
| **웹 App** | http://localhost:4200 | Angular 개발 서버 (브랜치 관리자) |
| **모바일 App** | http://localhost:4201 | Angular 개발 서버 (필드 직원) |
| **API** | http://localhost:3000 | NestJS API 백엔드 |
| **API Health** | http://localhost:3000/health | 헬스 체크 엔드포인트 |
| **DB Studio** | http://localhost:5555 | Prisma 데이터베이스 GUI |
| **Redis** | localhost:6379 | 캐시 서버 |
| **PostgreSQL** | localhost:5432 | 데이터베이스 |

### 웹만 선택 시
- 웹: http://localhost:4200
- 모바일 서버 (4201) 제외

### 모바일만 선택 시
- 모바일: http://localhost:4200
- 웹 서버 제외

---

## 🎯 시나리오별 사용법

### 신입 개발자

```bash
# 1. 스크립트 실행
./setup.sh

# 2. 프롬프트 따라가기
# Step 1-5: 자동으로 진행
# Step 2: "3" 선택 → 웹 + 모바일 모두 설치
# Step 6: 마이그레이션 선택
# Step 7: "5" 선택 → 전체 스택 시작

# 3. 자동으로 3개의 터미널에서 시작됨
# 웹: http://localhost:4200
# 모바일: http://localhost:4201
# API: http://localhost:3000

# 4. 개발 시작!
```

### 경험 있는 개발자

```bash
# 빠른 실행
./setup.sh

# 대부분 자동으로 진행됨
# 필요한 선택만 하면 됨

# 또는 일부 단계만 건너뛰기
# 예: .env가 이미 있으면 자동 건너뜀
```

### Docker가 이미 실행 중인 경우

```bash
# 스크립트에서 자동 감지
# docker-compose up 건너뛸 수 있음
# 기존 컨테이너 사용
```

---

## ❌ 문제 해결

### "Node.js가 설치되지 않았습니다" 오류

```bash
# macOS
brew install node@20

# Windows
# https://nodejs.org/ 에서 설치

# 또는 nvm 사용
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
```

### "Docker가 설치되지 않았습니다" 오류

```bash
# Docker Desktop 설치
https://www.docker.com/products/docker-desktop

# 설치 후 실행 확인
docker --version
```

### "Docker 데몬이 실행 중이 아닙니다" 오류

```bash
# Docker Desktop 실행
# (자동 실행이 아니면 수동으로 시작해야 함)

# 또는 명령어로 실행
sudo service docker start  # Linux
open -a Docker             # macOS
```

### "권한 거부" 오류 (macOS/Linux)

```bash
# 실행 권한 부여
chmod +x setup.sh

# 다시 실행
./setup.sh
```

### "npm install 시간 초과" 오류

```bash
# npm 캐시 제거
npm cache clean --force

# 재시도
./setup.sh
```

### "PostgreSQL 준비 시간 초과" 오류

```bash
# 보통 무해함 (계속 시도 중)
# 수동으로 대기

# 상태 확인
docker-compose ps

# 재시작
docker-compose restart postgres

# 또는 강제 시작
docker-compose up -d postgres
```

### 웹과 모바일 모두 시작 시 포트 충돌

```bash
# 자동으로 처리됨:
# - 웹: port 4200
# - 모바일: port 4201

# 수동으로 변경하려면:
cd apps/web && ng serve --port 4250
cd apps/mobile && ng serve --port 4251
```

---

## 🔧 고급 옵션

### Step별 수동 실행

특정 Step만 실행하려면:

```bash
# 의존성만 설치
npm install
pnpm install

# 앱별 의존성만 설치
cd apps/web && npm install
cd apps/mobile && npm install

# 마이그레이션만 실행
npx prisma migrate deploy

# Docker만 시작
docker-compose up -d

# 웹만 시작
cd apps/web && ng serve

# 모바일만 시작
cd apps/mobile && ng serve --port 4201

# 백엔드만 시작
cd apps/api && npm run start:dev
```

### 스크립트 커스터마이징

`setup.sh` 또는 `setup.bat`를 텍스트 편집기로 열어서:

```bash
# 특정 단계 주석 처리
# 예: 마이그레이션 자동 실행하지 않으려면
# npx prisma migrate deploy
# 주석으로 변경:
# # npx prisma migrate deploy
```

### 환경 변수 사전 설정

스크립트 실행 전에 `.env` 파일을 미리 만들어 두면:

```bash
# .env 파일이 이미 있으면 자동 건너뜀
cp .env.example .env
# 값 수정
vi .env

# 스크립트 실행
./setup.sh
```

---

## 📊 스크립트 흐름도

```
┌─────────────────────┐
│ setup.sh / setup.bat │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Step 1: 확인  │ ← Node, npm, Git, Docker
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────┐
    │ Step 2: 앱 선택       │ ← 1) 웹, 2) 모바일, 3) 둘 다
    │ (APP_TYPES 설정)     │
    └──────┬───────────────┘
           │
           ▼
    ┌──────────────┐
    │ Step 3: npm   │ ← 선택된 앱별 install
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Step 4: .env  │ ← .env.example 복사
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Step 5: Docker│ ← docker-compose up
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │ Step 6: Migration │ ← prisma migrate (선택)
    └──────┬───────────┘
           │
           ▼
    ┌──────────────────────┐
    │ Step 7: Dev Server    │ ← 선택된 앱 기반 옵션
    └──────┬───────────────┘
           │
           ▼
    ┌──────────────┐
    │  ✓ 완료!     │
    └──────────────┘
```

---

## 📝 체크리스트

스크립트 실행 후 확인사항:

- [ ] Node.js 버전: `node --version` (v20.x)
- [ ] npm 버전: `npm --version`
- [ ] Docker 실행: `docker ps`
- [ ] apps/web node_modules 생성됨 (웹 선택 시)
- [ ] apps/mobile node_modules 생성됨 (모바일 선택 시)
- [ ] .env 파일 생성됨
- [ ] PostgreSQL 실행: `docker-compose ps`
- [ ] Redis 실행: `docker-compose ps`
- [ ] 웹 App: http://localhost:4200 접속 가능 (웹 선택 시)
- [ ] 모바일 App: http://localhost:4201 접속 가능 (모바일 선택 시)
- [ ] API: http://localhost:3000/health 응답 확인

---

## 🎯 다음 단계

### 개발 시작

```bash
# 이미 개발 서버 실행 중이면
# 브라우저에서 접속:
# 웹: http://localhost:4200
# 모바일: http://localhost:4201

# 또는 수동으로 시작
cd apps/web && ng serve
cd apps/mobile && ng serve --port 4201
cd apps/api && npm run start:dev  # 다른 터미널
```

### 추가 명령어

```bash
# Makefile 명령어 확인
make help

# 데이터베이스 GUI
make db-studio

# 테스트 실행
make test-web
make test-mobile
make test-api

# 빌드
make build-web
make build-mobile
make build-api
```

### 문서 읽기

- **QUICK_START.md**: 빠른 참고
- **BUILD_DEBUG_GUIDE.md**: 깊이 있는 가이드
- **CLAUDE.md**: 프로젝트 규칙

---

## 💡 팁

### 스크립트 재실행

```bash
# 안전함 - 이미 설치된 것은 건너뜀
./setup.sh

# 여러 번 실행 가능
# 멱등성(idempotent) 보장
```

### 환경 변수 수정

```bash
# .env 파일 수정
vi .env

# 재시작 필요 (개발 서버)
# Ctrl+C로 중지 후 다시 시작
```

### Docker 컨테이너 재시작

```bash
# 개별 서비스 재시작
docker-compose restart postgres
docker-compose restart redis

# 전체 재시작
docker-compose down
docker-compose up -d
```

### 포트 변경

```bash
# 기본값:
# 웹: 4200, 모바일: 4201, API: 3000

# 변경하려면 ng serve 명령어에 --port 옵션 추가:
cd apps/web && ng serve --port 5000
cd apps/mobile && ng serve --port 5001
cd apps/api && npm run start:dev -- --port 5002
```

---

## 🆘 도움이 필요한 경우

1. **BUILD_DEBUG_GUIDE.md** 참고
2. **Makefile** 명령어 확인: `make help`
3. **QUICK_START.md** 참고
4. GitHub Issues 제출

---

## 🏗️ 프로젝트 구조

```
ERP/
├── setup.sh              # Unix/Linux/macOS 설정 스크립트
├── setup.bat             # Windows 설정 스크립트
├── SETUP_README.md       # 이 파일
├── apps/
│   ├── web/              # 웹 애플리케이션 (PWA)
│   │   ├── src/
│   │   ├── angular.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mobile/           # 모바일 애플리케이션 (Ionic)
│   │   ├── src/
│   │   ├── capacitor.config.ts
│   │   ├── angular.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/              # NestJS 백엔드
│       ├── src/
│       ├── nest-cli.json
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml    # Docker 서비스 구성
├── .env.example          # 환경 변수 템플릿
└── Makefile              # 자동화 명령어
```

---

## 🔗 관련 링크

- [Angular 공식 문서](https://angular.io)
- [Ionic 공식 문서](https://ionicframework.com)
- [Capacitor 공식 문서](https://capacitorjs.com)
- [NestJS 공식 문서](https://nestjs.com)
- [Docker 공식 문서](https://docs.docker.com)
- [Prisma 공식 문서](https://www.prisma.io/docs)

---

**Happy Coding! 🚀**

마지막 업데이트: 2025-12-11
