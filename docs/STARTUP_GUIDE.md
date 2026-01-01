# Logistics ERP Startup Guide
# 물류 ERP 기동 스크립트 설명서

> Version: 1.0.0
> Last Updated: 2026-01-03

---

## Table of Contents

1. [Quick Start (빠른 시작)](#1-quick-start-빠른-시작)
2. [Prerequisites (사전 요구사항)](#2-prerequisites-사전-요구사항)
3. [Script Reference (스크립트 참조)](#3-script-reference-스크립트-참조)
4. [Manual Commands (수동 명령어)](#4-manual-commands-수동-명령어)
5. [Troubleshooting (문제 해결)](#5-troubleshooting-문제-해결)
6. [Production Deployment (운영 배포)](#6-production-deployment-운영-배포)

---

## 1. Quick Start (빠른 시작)

### 1.1 First Time Setup (최초 설정)

```bash
# Clone repository
git clone <repository-url>
cd ERP

# Run setup script (one-time)
./scripts/dev-setup.sh
```

### 1.2 Daily Development (일상 개발)

```bash
# Start all services
./scripts/start-all.sh

# When done, stop all services
./scripts/stop-all.sh
```

### 1.3 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| Mobile App | http://localhost:4200 | Main mobile application |
| Web Admin | http://localhost:4300 | Web administration panel |
| API Server | http://localhost:3000 | Backend API |
| Swagger Docs | http://localhost:3000/api/docs | API documentation |
| DB Studio | http://localhost:5555 | Prisma database GUI |

### 1.4 Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123! | HQ_ADMIN |
| manager | manager123! | BRANCH_MANAGER |
| installer | install123! | INSTALLER |

---

## 2. Prerequisites (사전 요구사항)

### 2.1 Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20.18.0+ | `nvm install 20` |
| pnpm | 9.x+ | `npm install -g pnpm` |
| Docker | Latest | Docker Desktop |
| Git | Latest | Xcode CLI or Homebrew |

### 2.2 Verify Installation

```bash
# Check all prerequisites
node --version    # Should be v20.x.x
pnpm --version    # Should be 9.x.x
docker --version  # Should show version
git --version     # Should show version

# Check Docker is running
docker info
```

### 2.3 macOS Specific

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm

# Install Docker Desktop
brew install --cask docker
# Then start Docker Desktop from Applications
```

---

## 3. Script Reference (스크립트 참조)

All scripts are located in the `scripts/` directory.

### 3.1 dev-setup.sh (개발 환경 설정)

**Purpose**: One-time development environment setup

**Usage**:
```bash
./scripts/dev-setup.sh
```

**What it does**:
1. Checks and installs prerequisites (Node.js, pnpm, Docker)
2. Creates `.env` file from template
3. Installs npm dependencies
4. Sets up Git hooks (Husky)
5. Starts Docker services
6. Runs database migrations
7. Seeds database with sample data

**When to use**:
- First time setting up the project
- After cloning the repository
- When resetting development environment

---

### 3.2 start-all.sh (전체 서비스 시작)

**Purpose**: Start all application services

**Usage**:
```bash
# Start all services
./scripts/start-all.sh

# Start only API
./scripts/start-all.sh --api

# Start only Web
./scripts/start-all.sh --web

# Start only Mobile
./scripts/start-all.sh --mobile
```

**What it does**:
1. Checks prerequisites
2. Sets Node.js version via nvm
3. Starts Docker (PostgreSQL + Redis)
4. Installs dependencies if needed
5. Runs database migrations
6. Starts API server (port 3000)
7. Starts Web app (port 4300)
8. Starts Mobile app (port 4200)

**Output Files**:
- `logs/api.log` - API server logs
- `logs/web.log` - Web app logs
- `logs/mobile.log` - Mobile app logs
- `.pids/*.pid` - Process ID files

---

### 3.3 stop-all.sh (전체 서비스 중지)

**Purpose**: Stop all running services

**Usage**:
```bash
# Stop all services including Docker
./scripts/stop-all.sh

# Stop apps but keep database running
./scripts/stop-all.sh --keep-db
```

**What it does**:
1. Stops API server
2. Stops Web app
3. Stops Mobile app
4. Stops Docker containers (unless --keep-db)

---

### 3.4 db-reset.sh (데이터베이스 초기화)

**Purpose**: Reset database to clean state

**Usage**:
```bash
# Reset with confirmation prompt
./scripts/db-reset.sh

# Reset without confirmation
./scripts/db-reset.sh --force
```

**⚠️ WARNING**: This will DELETE ALL DATA in the database!

**What it does**:
1. Drops existing database
2. Creates new empty database
3. Runs all migrations
4. Seeds with sample data

---

### 3.5 run-tests.sh (테스트 실행)

**Purpose**: Run test suites

**Usage**:
```bash
# Run all tests
./scripts/run-tests.sh

# Run specific test suite
./scripts/run-tests.sh api      # API tests only
./scripts/run-tests.sh web      # Web tests only
./scripts/run-tests.sh mobile   # Mobile tests only

# Run with coverage
./scripts/run-tests.sh coverage
```

**Expected Results**:
- API: 222 tests
- Web: 250 tests
- Mobile: 136 tests
- Total: 608 tests

---

### 3.6 build-all.sh (빌드)

**Purpose**: Build applications for production

**Usage**:
```bash
# Build all applications
./scripts/build-all.sh

# Build specific application
./scripts/build-all.sh api      # Build API only
./scripts/build-all.sh web      # Build Web only
./scripts/build-all.sh mobile   # Build Mobile only

# Build mobile for specific platform
./scripts/build-all.sh android  # Build Android APK
./scripts/build-all.sh ios      # Build iOS app
```

**Output Locations**:
- API: `apps/api/dist/`
- Web: `apps/web/dist/`
- Mobile: `apps/mobile/www/`
- Android: `apps/mobile/android/app/build/outputs/apk/release/`

---

## 4. Manual Commands (수동 명령어)

### 4.1 Package Manager Commands

```bash
# Install dependencies
pnpm install

# Add a package to specific app
pnpm --filter mobile add <package>
pnpm --filter web add <package>
pnpm --filter erp-logistics-api add <package>
```

### 4.2 Development Servers

```bash
# Start API server (port 3000)
pnpm api:dev

# Start Mobile app (port 4200)
pnpm mobile:dev

# Start Web app (port 4300)
pnpm web:dev
```

### 4.3 Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Open Prisma Studio (GUI)
pnpm db:studio
```

### 4.4 Docker Commands

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Stop all containers
docker compose down

# View logs
docker compose logs -f

# Connect to PostgreSQL
docker compose exec postgres psql -U erp_user -d erp_logistics

# View running containers
docker compose ps
```

### 4.5 Test Commands

```bash
# Run all tests
pnpm test

# Run specific app tests
cd apps/api && pnpm test
cd apps/web && pnpm test -- --browsers=ChromeHeadless --watch=false
cd apps/mobile && pnpm test -- --browsers=ChromeHeadless --watch=false
```

### 4.6 Build Commands

```bash
# Build all
pnpm build

# Build specific app
pnpm api:build
pnpm web:build
pnpm mobile:build
```

### 4.7 Mobile Native Commands

```bash
cd apps/mobile

# Sync Capacitor plugins
npx cap sync

# Open in Android Studio
npx cap open android

# Open in Xcode
npx cap open ios

# Build Android APK
cd android && ./gradlew assembleRelease
```

---

## 5. Troubleshooting (문제 해결)

### 5.1 Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use the script which handles this
./scripts/start-all.sh
```

### 5.2 Docker Connection Failed

**Error**: `Cannot connect to Docker daemon`

**Solution**:
```bash
# On macOS, start Docker Desktop
open -a Docker

# Wait for Docker to start, then verify
docker info
```

### 5.3 Database Connection Failed

**Error**: `Connection refused to localhost:5432`

**Solution**:
```bash
# Restart Docker containers
docker compose down
docker compose up -d

# Wait for PostgreSQL to be ready
sleep 5

# Verify PostgreSQL is running
docker compose ps
```

### 5.4 Prisma Client Error

**Error**: `Prisma Client is not generated`

**Solution**:
```bash
pnpm db:generate
```

### 5.5 Node Module Errors

**Error**: `Cannot find module ...`

**Solution**:
```bash
# Remove and reinstall node_modules
rm -rf node_modules
rm -rf apps/*/node_modules
pnpm install
pnpm db:generate
```

### 5.6 nvm Not Found

**Error**: `nvm: command not found`

**Solution**:
```bash
# Add to ~/.zshrc or ~/.bashrc
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Reload shell
source ~/.zshrc  # or source ~/.bashrc
```

### 5.7 ChromeHeadless Test Failure

**Error**: `Chrome not found for tests`

**Solution**:
```bash
# Install Chrome
brew install --cask google-chrome

# Verify Chrome is in PATH
which google-chrome || which chromium
```

---

## 6. Production Deployment (운영 배포)

### 6.1 Build for Production

```bash
# Build all applications
./scripts/build-all.sh

# Outputs:
# - apps/api/dist/ (Node.js server)
# - apps/web/dist/ (Static files)
# - apps/mobile/www/ (PWA/Capacitor)
```

### 6.2 API Server Deployment

```bash
# Copy files to server
scp -r apps/api/dist/* user@server:/app/api/

# On server
cd /app/api
npm install --production
npm start
```

### 6.3 Web Static Deployment

```bash
# Copy to web server (nginx, S3, etc.)
scp -r apps/web/dist/* user@server:/var/www/html/

# Or deploy to S3
aws s3 sync apps/web/dist/ s3://your-bucket-name/
```

### 6.4 Mobile App Deployment

**Android**:
```bash
./scripts/build-all.sh android
# Upload APK to Play Store Console
# File: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

**iOS**:
```bash
./scripts/build-all.sh ios
# Open Xcode and archive for App Store
npx cap open ios
```

### 6.5 Environment Variables

Production `.env` should include:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/erp_logistics

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-production-secret
JWT_EXPIRES_IN=1h

# Push Notifications
FCM_SERVER_KEY=your-fcm-key
APNS_KEY_ID=your-apns-key

# S3 Storage
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=your-bucket
```

---

## Appendix A: Script Permissions

If scripts are not executable:

```bash
chmod +x scripts/*.sh
```

## Appendix B: Log Locations

| Service | Log File |
|---------|----------|
| API | `logs/api.log` |
| Web | `logs/web.log` |
| Mobile | `logs/mobile.log` |
| Docker | `docker compose logs -f` |

## Appendix C: Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 3000 | API Server | HTTP |
| 4200 | Mobile App | HTTP |
| 4300 | Web App | HTTP |
| 5432 | PostgreSQL | TCP |
| 5555 | Prisma Studio | HTTP |
| 6379 | Redis | TCP |

---

*Document End*
