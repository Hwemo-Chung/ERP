# Build & Debug Guide

Logistics ERP 애플리케이션 개발, 빌드 및 디버깅을 위한 완전한 가이드입니다.

## 📋 Table of Contents

1. [개발 환경 설정](#개발-환경-설정)
2. [프론트엔드 (Mobile App) 빌드](#프론트엔드-mobile-app-빌드)
3. [백엔드 (API) 빌드](#백엔드-api-빌드)
4. [디버깅](#디버깅)
5. [Docker & 배포](#docker--배포)
6. [네이티브 빌드 (Android/iOS)](#네이티브-빌드-androidios)
7. [문제 해결](#문제-해결)

---

## 개발 환경 설정

### 사전 요구사항

```bash
# Node.js 버전 확인 (20 LTS 필요)
node --version  # v20.x.x
npm --version   # 10.x.x

# Java 버전 확인 (Android 빌드용)
java -version   # JDK 17 이상

# 설치되지 않은 경우
nvm install 20
jenv add /path/to/jdk-17
jenv global 17
```

### 프로젝트 설정

```bash
# 프로젝트 루트에서
cd /Users/solution/Documents/ERP

# Node 버전 자동 설정 (.nvmrc 사용)
nvm use

# Java 버전 자동 설정 (.java-version 사용)
jenv local

# 의존성 설치
pnpm install

# 또는
npm install
```

### 환경 변수 설정

```bash
# .env 파일 생성 (루트 디렉토리)
cp .env.example .env

# .env 내용 수정
# API_URL=https://your-api-domain/api
# CAPACITOR_APP_ID=com.company.erp.logistics
# FCM_SENDER_ID=your-fcm-sender-id
```

---

## 프론트엔드 (Mobile App) 빌드

### 1. 개발 모드 실행 (Hot Reload)

```bash
# 모니토 앱 폴더로 이동
cd apps/mobile

# 개발 서버 시작 (Web - 브라우저)
ng serve

# 또는 (포트 지정)
ng serve --port 4200

# 접속: http://localhost:4200
```

**핫 리로드 활성화:**
- 파일 저장 → 자동 컴파일 → 브라우저 자동 새로고침
- TypeScript/SCSS 변경사항 즉시 반영

---

### 2. 프로덕션 빌드 (최적화)

```bash
# 프로덕션 빌드 (번들 최적화)
ng build --configuration production

# 출력: dist/erp-mobile/
```

**빌드 옵션:**

```bash
# 특정 환경으로 빌드
ng build --configuration production

# 소스맵 생성 (디버깅용)
ng build --source-map

# 번들 분석
ng build --stats-json
webpack-bundle-analyzer dist/erp-mobile/stats.json

# 번들 크기 확인
ng build --configuration production
# 출력 보기: dist/erp-mobile/
```

---

### 3. PWA 빌드 (Service Worker 포함)

```bash
# PWA 설정과 함께 프로덕션 빌드
ng build --configuration production

# ngsw-config.json이 자동으로 처리됨
# 생성 파일:
#   - dist/erp-mobile/ngsw.json (Service Worker 매니페스트)
#   - dist/erp-mobile/ngsw-worker.js (Service Worker 코드)
#   - dist/erp-mobile/manifest.webmanifest (PWA 메니페스트)
```

**Service Worker 검증:**

```bash
# Chrome DevTools에서 확인
# 1. F12 열기
# 2. Application → Service Workers
# 3. Status: "activated and running" 확인

# 또는 명령어로 확인
curl -I http://localhost:4200/ngsw.json
```

---

### 4. 로컬 서버에서 PWA 테스트

```bash
# 프로덕션 빌드
ng build --configuration production

# HTTPS 로컬 서버 시작 (PWA 테스트용)
cd dist/erp-mobile

# Python 3 (권장)
python -m http.server 8080

# 또는 Node.js (http-server)
npx http-server -p 8080 -c-1

# HTTPS 테스트 (자체 서명 인증서)
npx http-server -p 8080 -c-1 --ssl --cert ./cert.pem --key ./key.pem

# 접속: https://localhost:8080
```

---

### 5. Capacitor로 Android/iOS 빌드 준비

```bash
# Capacitor 동기화 (네이티브 프로젝트 생성)
npx cap sync

# 또는 수동 동기화
npx cap sync android  # Android만
npx cap sync ios      # iOS만
```

---

## 백엔드 (API) 빌드

### 1. 개발 모드 실행

```bash
# API 폴더로 이동
cd apps/api

# 개발 서버 시작 (핫 리로드)
npm run start:dev

# 또는 NestJS CLI 직접 사용
nest start --watch

# 접속: http://localhost:3000
# 헬스 체크: http://localhost:3000/health
```

**개발 모드 특징:**
- TypeScript 컴파일 자동화
- 파일 변경 감지 후 자동 재시작
- Source maps 포함 (디버깅)

---

### 2. 프로덕션 빌드

```bash
# 컴파일
npm run build

# 출력: dist/

# 프로덕션 서버 시작
npm run start:prod

# 또는
node dist/main.js
```

**빌드 옵션:**

```bash
# 특정 대상으로 빌드
npm run build -- --target es2020

# 소스맵 생성
npm run build -- --sourceMap

# 최적화
npm run build -- --optimization
```

---

### 3. API 검증

```bash
# 헬스 체크
curl http://localhost:3000/health

# 로깅 레벨 설정 (.env)
LOG_LEVEL=debug  # verbose, debug, log, warn, error, fatal

# API 문서 (Swagger)
# http://localhost:3000/api (설정되어 있는 경우)
```

---

### 4. 데이터베이스 마이그레이션

```bash
# Prisma 마이그레이션 상태 확인
npx prisma migrate status

# 새 마이그레이션 생성
npx prisma migrate dev --name add_feature_name

# 프로덕션 배포
npx prisma migrate deploy

# 스키마 확인
npx prisma studio  # http://localhost:5555
```

---

## 디버깅

### 1. Chrome DevTools 디버깅

#### 프론트엔드 디버깅

```bash
# 개발 서버 실행
cd apps/mobile
ng serve

# Chrome에서 열기
# F12 → Sources → localhost:4200

# 중단점 설정
# - 파일 클릭 → 줄 번호 클릭
# - 조건부 중단점: 줄 번호 우클릭

# 콘솔 로깅
console.log('Debug message', variable);
debugger;  // 자동 중단점
```

**주요 탭:**
- **Elements**: HTML/CSS 검사
- **Console**: 에러 및 로그 메시지
- **Sources**: TypeScript/JavaScript 디버깅
- **Network**: HTTP 요청/응답
- **Application**: Service Worker, Storage, Cookies
- **Performance**: 성능 분석

#### 백엔드 디버깅

```bash
# VS Code 디버거 설정 (.vscode/launch.json)
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "NestJS Debug",
      "args": ["--inspect-brk", "dist/main.js"],
      "runtimeArgs": ["--exec", "node"],
      "restart": true,
      "stopOnEntry": false,
      "console": "integratedTerminal"
    }
  ]
}

# VS Code에서 F5 눌러 디버깅 시작
```

---

### 2. 로그 레벨 설정

#### 프론트엔드

```typescript
// environments/environment.ts
export const environment = {
  production: false,
  logLevel: 'debug',  // 'error' | 'warn' | 'log' | 'debug'
};

// 사용
import { environment } from '@env/environment';

if (environment.logLevel === 'debug') {
  console.log('Debug info');
}
```

#### 백엔드

```bash
# .env 파일
LOG_LEVEL=debug

# 또는 실행 시 설정
LOG_LEVEL=verbose npm run start:dev
```

---

### 3. Network 탭에서 API 요청 검사

```bash
# Chrome DevTools → Network 탭 열기

# API 요청 확인
# 1. 요청 클릭
# 2. Headers: 요청 헤더 (Authorization, Content-Type 등)
# 3. Payload/Request body: 요청 본문
# 4. Response: 응답 데이터
# 5. Timing: 요청 시간 분석
```

---

### 4. Redux DevTools (SignalStore 상태 검사)

```bash
# Chrome 확장 프로그램 설치
# "Redux DevTools" - Chrome Web Store

# 앱에서 자동 감지됨
# Redux DevTools → (앱 이름) 선택

# 상태 확인
# - State 탭: 현재 상태
# - Actions 탭: 상태 변경 히스토리
```

---

### 5. 오프라인 모드 테스트

```bash
# Chrome DevTools
# 1. F12 → Network 탭
# 2. "Offline" 드롭다운 찾기
# 3. "Offline" 선택

# 또는
# 1. Devtools → Network conditions (⋮ → More tools)
# 2. "Offline" 체크박스 선택

# 결과:
# - 네트워크 요청 실패 (의도적)
# - App은 오프라인 배너 표시
# - IndexedDB에서 캐시 사용
```

---

### 6. Service Worker 디버깅

```bash
# Chrome DevTools
# 1. F12 → Application → Service Workers
# 2. "Update on reload" 체크 (개발 중)
# 3. "Offline" 체크하여 오프라인 모드 테스트

# Service Worker 에러 로그
# Chrome DevTools → Console → Service Worker 메시지 확인

# ngsw-worker.js 직접 확인
# DevTools → Sources → Service Worker

# 캐시 확인
# Application → Storage → Cache Storage
# - 각 캐시 데이터 확인
# - 캐시 항목 삭제 가능
```

---

## Docker & 배포

### 1. Docker 빌드 (로컬 테스트)

```bash
# 프로덕션 빌드
cd apps/mobile
ng build --configuration production

# Docker 이미지 빌드 (프론트엔드)
docker build -f Dockerfile.web -t erp-mobile:latest .

# 이미지 실행
docker run -p 8080:80 erp-mobile:latest

# 접속: http://localhost:8080
```

**Dockerfile.web 예시:**

```dockerfile
# 빌드 단계
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 실행 단계
FROM nginx:alpine
COPY --from=builder /app/dist/erp-mobile /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### 2. API Docker 빌드

```bash
# 프로덕션 빌드
cd apps/api
npm run build

# Docker 이미지 빌드
docker build -f Dockerfile.api -t erp-api:latest .

# 이미지 실행
docker run \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  erp-api:latest

# 접속: http://localhost:3000/health
```

---

### 3. Docker Compose (전체 스택)

```bash
# 루트 디렉토리에서
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: erp_db
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      DATABASE_URL: postgresql://erp_user:${DB_PASSWORD}@postgres:5432/erp_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  mobile:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "8080:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 네이티브 빌드 (Android/iOS)

### 1. Android 빌드

#### 환경 설정

```bash
# Android SDK 확인
echo $ANDROID_HOME

# 또는 설정
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 라이선스 동의
sdkmanager --licenses

# 필요한 빌드 도구 설치
sdkmanager "build-tools;34.0.0" "platforms;android-34"
```

#### APK 빌드 (개발)

```bash
# Capacitor 동기화
npx cap sync android

# Android Studio에서 빌드
# (권장) Android Studio 열기
# apps/mobile/android/

# 또는 Gradle 직접 사용
cd apps/mobile/android
./gradlew assembleDebug

# APK 위치: app/build/outputs/apk/debug/app-debug.apk
```

#### APK 배포 (릴리스)

```bash
# 릴리스 APK 빌드
./gradlew bundleRelease  # AAB (Google Play용)
# 또는
./gradlew assembleRelease  # APK (직접 배포용)

# 출력:
# - AAB: app/build/outputs/bundle/release/app-release.aab
# - APK: app/build/outputs/apk/release/app-release.apk

# 서명 (자체 서명)
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore release.keystore app-release.apk release-key

# APK 배포
adb install app-release.apk
```

#### 디버깅 (Android)

```bash
# 디버그 APK 설치
adb install app/build/outputs/apk/debug/app-debug.apk

# 앱 시작
adb shell am start -n com.company.erp.logistics/.MainActivity

# 로그 확인
adb logcat | grep erp

# 또는
adb logcat -s "CordovaLog"

# 디버거 연결 (Chrome)
# chrome://inspect/#devices
```

---

### 2. iOS 빌드

#### 환경 설정

```bash
# Xcode 확인
xcode-select --print-path

# CocoaPods 설치
sudo gem install cocoapods

# Xcode 선택
sudo xcode-select --reset
```

#### IPA 빌드 (개발)

```bash
# Capacitor 동기화
npx cap sync ios

# Xcode에서 빌드
# (권장) Xcode 열기
# apps/mobile/ios/

# 또는 xcodebuild 사용
cd apps/mobile/ios/App
xcodebuild -scheme App -configuration Debug build

# 또는 iPhone 시뮬레이터에서 실행
xcodebuild -scheme App -configuration Debug -destination generic/platform=iOS build
```

#### IPA 배포 (릴리스)

```bash
# 릴리스 빌드
xcodebuild -scheme App -configuration Release \
  -archivePath build/App.xcarchive \
  archive

# IPA 생성
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportOptionsPlist exportOptions.plist \
  -exportPath build/

# IPA 위치: build/App.ipa
```

#### 디버깅 (iOS)

```bash
# Safari를 통한 원격 디버깅
# Safari → Develop → iPhone → App

# 또는
# Xcode Console에서 로그 확인
# Xcode → Debug → View Debug Hierarchy

# 앱 로그
# Console.app에서 필터링
# Process: "Logistics ERP"
```

---

### 3. 모바일 디바이스 테스트

#### Android 기기

```bash
# USB 디버깅 활성화
# 설정 → 개발자 옵션 → USB 디버깅 활성화

# 연결된 디바이스 확인
adb devices

# 앱 설치 및 실행
adb install app-debug.apk
adb shell am start -n com.company.erp.logistics/.MainActivity

# 원격 디버깅
# Chrome → chrome://inspect/#devices
```

#### iOS 기기

```bash
# Xcode를 통한 배포
# Xcode → Product → Destination → 기기 선택
# Product → Run

# 또는 TestFlight (Apple)
# App Store Connect → TestFlight → 테스터 추가
```

---

## 문제 해결

### 빌드 오류

#### 1. `Cannot find module` 오류

```bash
# 원인: node_modules 손상
# 해결:
rm -rf node_modules
rm pnpm-lock.yaml  # 또는 package-lock.json
pnpm install

# 또는 캐시 제거
pnpm store prune
pnpm install
```

#### 2. `ng: command not found`

```bash
# 원인: Angular CLI 미설치 또는 경로 문제
# 해결:
npm install -g @angular/cli

# 또는 로컬 CLI 사용
npx ng serve
```

#### 3. TypeScript 컴파일 오류

```bash
# 원인: 타입 불일치
# 해결:
# 1. 컴파일러 설정 확인 (tsconfig.json)
# 2. 의존성 업데이트
npm update

# 3. 타입 정의 설치
npm install --save-dev @types/node
```

---

### 런타임 오류

#### 1. CORS 오류

```
Access to XMLHttpRequest has been blocked by CORS policy
```

**해결:**

```bash
# 백엔드에서 CORS 활성화 (main.ts)
app.enableCors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});

# 또는 프록시 설정 (proxy.conf.json)
{
  "/api": {
    "target": "http://localhost:3000",
    "pathRewrite": { "^/api": "" }
  }
}

# 사용
ng serve --proxy-config proxy.conf.json
```

#### 2. 인증 토큰 만료

```
Token expired (401 Unauthorized)
```

**해결:**

```typescript
// 토큰 갱신 로직 확인 (auth.interceptor.ts)
if (error.status === 401) {
  return this.authService.refreshTokens();
}

// 또는 로그인 페이지로 리다이렉트
this.router.navigate(['/auth/login']);
```

#### 3. 데이터베이스 연결 오류

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**해결:**

```bash
# PostgreSQL 실행 중 확인
psql -U postgres -d erp_db

# 또는 Docker로 실행
docker run -d \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

# 환경 변수 확인
echo $DATABASE_URL
```

---

### 성능 문제

#### 1. 느린 빌드

```bash
# 원인: 번들 크기 또는 의존성 문제
# 해결:

# 1. 번들 분석
ng build --stats-json
webpack-bundle-analyzer dist/erp-mobile/stats.json

# 2. 불필요한 의존성 제거
npm list --depth=0
npm uninstall package-name

# 3. 빌드 캐시 활성화
ng build --configuration production --cache
```

#### 2. 느린 앱 성능

```bash
# Performance 탭에서 분석
# Chrome DevTools → Performance 탭 → Record

# 또는 Lighthouse 사용
# Chrome DevTools → Lighthouse

# 최적화:
# 1. Change Detection 최적화 (OnPush)
# 2. Virtual Scrolling 사용
# 3. 불필요한 바인딩 제거
# 4. 지연 로딩 활성화
```

---

### 배포 문제

#### 1. Service Worker 캐시 문제

```bash
# 원인: 이전 버전 캐시됨
# 해결:

# 방법 1: 브라우저 캐시 명확히
# DevTools → Application → Cache Storage → 캐시 삭제

# 방법 2: Service Worker 재설정
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});

# 방법 3: 강제 업데이트
// app-init.service.ts에서
this.swUpdate.activateUpdate();
```

#### 2. 토큰 만료 문제 (모바일)

```bash
# 원인: Secure Storage에서 토큰 읽기 실패
# 해결:

# Capacitor Secure Storage 확인
// src/app/core/services/auth.service.ts
const token = await SecureStoragePlugin.getItem({ key: 'token' });

# 또는 Preferences로 폴백
if (!token) {
  const fallback = await Preferences.get({ key: 'token' });
}
```

---

## 유용한 명령어 정리

### 프론트엔드

```bash
# 개발
cd apps/mobile
ng serve                          # 개발 서버 (핫 리로드)
ng serve --open                   # 자동 브라우저 열기

# 빌드
ng build --configuration production  # 프로덕션 빌드
ng build --source-map               # 소스맵 포함
ng build --stats-json && webpack-bundle-analyzer dist/erp-mobile/stats.json  # 번들 분석

# 테스트
ng test                            # 유닛 테스트
ng e2e                            # E2E 테스트
ng lint                           # 코드 린팅

# 네이티브
npx cap sync                      # Capacitor 동기화
npx cap sync android              # Android만
npx cap sync ios                  # iOS만
```

### 백엔드

```bash
# 개발
cd apps/api
npm run start:dev                 # 개발 서버 (핫 리로드)
npm run start:debug               # 디버그 모드

# 빌드
npm run build                     # 프로덕션 빌드
npm run start:prod                # 프로덕션 실행

# 테스트
npm test                          # 유닛 테스트
npm run test:e2e                  # E2E 테스트
npm run test:cov                  # 커버리지

# 데이터베이스
npx prisma migrate dev            # 마이그레이션
npx prisma studio                 # Prisma Studio (GUI)
npx prisma seed                   # 시드 데이터
```

### Docker

```bash
docker-compose up -d              # 전체 스택 실행
docker-compose down               # 정지 및 제거
docker-compose logs -f            # 실시간 로그
docker build -t erp-mobile:latest . # 이미지 빌드
docker run -p 8080:80 erp-mobile:latest  # 컨테이너 실행
```

---

## 참고 자료

- [Angular 공식 문서](https://angular.dev)
- [Ionic 공식 문서](https://ionicframework.com/docs)
- [NestJS 공식 문서](https://docs.nestjs.com)
- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Prisma 공식 문서](https://www.prisma.io/docs)
- [Chrome DevTools 가이드](https://developer.chrome.com/docs/devtools)

---

**마지막 업데이트:** 2025-12-11
**작성자:** ERP Team
