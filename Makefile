.PHONY: help install setup dev-mobile dev-api build test docker docker-down clean lint

# 프로젝트 경로
MOBILE_PATH := apps/mobile
API_PATH := apps/api

# 색상 정의
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## 사용 가능한 명령어 표시
	@echo "$(BLUE)=== Logistics ERP - Build & Debug Guide ===$(NC)"
	@echo ""
	@echo "$(GREEN)Setup & Installation$(NC)"
	@grep -E '^[a-zA-Z_-]+.*:.*?## .*Setup' $(MAKEFILE_LIST) | sort | sed 's/:.*## /: /'
	@echo ""
	@echo "$(GREEN)Development$(NC)"
	@grep -E '^[a-zA-Z_-]+.*:.*?## .*dev' $(MAKEFILE_LIST) | sort | sed 's/:.*## /: /'
	@echo ""
	@echo "$(GREEN)Build & Optimization$(NC)"
	@grep -E '^[a-zA-Z_-]+.*:.*?## .*build' $(MAKEFILE_LIST) | sort | sed 's/:.*## /: /'
	@echo ""
	@echo "$(GREEN)Testing & Quality$(NC)"
	@grep -E '^[a-zA-Z_-]+.*:.*?## .*test|lint' $(MAKEFILE_LIST) | sort | sed 's/:.*## /: /'
	@echo ""
	@echo "$(GREEN)Docker & Deployment$(NC)"
	@grep -E '^[a-zA-Z_-]+.*:.*?## .*docker' $(MAKEFILE_LIST) | sort | sed 's/:.*## /: /'
	@echo ""
	@echo "$(GREEN)Utilities$(NC)"
	@grep -E '^[a-zA-Z_-]+.*:.*?## .*clean|reset' $(MAKEFILE_LIST) | sort | sed 's/:.*## /: /'

# ============================================================================
# Setup & Installation
# ============================================================================

install: ## Setup: 의존성 설치 (npm/pnpm)
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	pnpm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

setup: install ## Setup: 완전한 프로젝트 설정 (환경변수, DB 등)
	@echo "$(YELLOW)Setting up environment...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ .env file created (수정 필요)$(NC)"; \
	fi
	@nvm use
	@jenv local
	@echo "$(GREEN)✓ Environment setup complete$(NC)"
	@echo "$(BLUE)다음 단계:$(NC)"
	@echo "1. .env 파일 수정: API_URL, DB 정보 등"
	@echo "2. 데이터베이스 마이그레이션: make db-migrate"

update: ## Setup: 의존성 업데이트
	@echo "$(YELLOW)Updating dependencies...$(NC)"
	npm update
	npx prisma migrate dev
	@echo "$(GREEN)✓ Dependencies updated$(NC)"

# ============================================================================
# Development
# ============================================================================

dev-mobile: ## Dev: 프론트엔드 개발 서버 (핫 리로드) - http://localhost:4200
	@echo "$(YELLOW)Starting mobile dev server...$(NC)"
	cd $(MOBILE_PATH) && ng serve --open

dev-api: ## Dev: 백엔드 개발 서버 (핫 리로드) - http://localhost:3000
	@echo "$(YELLOW)Starting API dev server...$(NC)"
	cd $(API_PATH) && npm run start:dev

dev-api-debug: ## Dev: 백엔드 디버그 모드 (포트 9229)
	@echo "$(YELLOW)Starting API in debug mode...$(NC)"
	cd $(API_PATH) && npm run start:debug

dev-all: ## Dev: 전체 스택 시작 (모바일 + API + DB)
	@echo "$(YELLOW)Starting full stack...$(NC)"
	@echo "1. Starting Docker services..."
	docker-compose up -d postgres redis
	@echo "2. Starting API..."
	@make dev-api &
	@echo "3. Starting Mobile..."
	@make dev-mobile &
	@echo "$(GREEN)All services started!$(NC)"

# ============================================================================
# Build & Optimization
# ============================================================================

build-mobile: ## Build: 프론트엔드 프로덕션 빌드 (최적화)
	@echo "$(YELLOW)Building mobile app...$(NC)"
	cd $(MOBILE_PATH) && ng build --configuration production
	@echo "$(GREEN)✓ Build complete: dist/erp-mobile/$(NC)"

build-mobile-dev: ## Build: 프론트엔드 개발 빌드 (소스맵 포함)
	@echo "$(YELLOW)Building mobile app (dev)...$(NC)"
	cd $(MOBILE_PATH) && ng build --source-map
	@echo "$(GREEN)✓ Build complete: dist/erp-mobile/$(NC)"

build-api: ## Build: 백엔드 프로덕션 빌드
	@echo "$(YELLOW)Building API...$(NC)"
	cd $(API_PATH) && npm run build
	@echo "$(GREEN)✓ Build complete: dist/$(NC)"

build-all: build-mobile build-api ## Build: 전체 애플리케이션 빌드
	@echo "$(GREEN)✓ All builds complete$(NC)"

bundle-analyze: ## Build: 번들 크기 분석 및 시각화
	@echo "$(YELLOW)Analyzing bundle...$(NC)"
	cd $(MOBILE_PATH) && ng build --stats-json
	npx webpack-bundle-analyzer dist/erp-mobile/stats.json
	@echo "$(GREEN)✓ Bundle analysis complete$(NC)"

size-check: ## Build: 번들 크기 확인
	@echo "$(BLUE)Bundle Size Report:$(NC)"
	@du -sh dist/erp-mobile
	@du -sh $(API_PATH)/dist 2>/dev/null || echo "API build not found"

serve-prod: build-mobile ## Build: 프로덕션 빌드 후 로컬 서버에서 실행
	@echo "$(YELLOW)Serving production build...$(NC)"
	cd dist/erp-mobile && npx http-server -p 8080 -c-1
	@echo "$(GREEN)✓ Serving at http://localhost:8080$(NC)"

# ============================================================================
# Testing & Quality
# ============================================================================

test-mobile: ## Test: 프론트엔드 유닛 테스트
	@echo "$(YELLOW)Running mobile tests...$(NC)"
	cd $(MOBILE_PATH) && ng test --watch=false

test-api: ## Test: 백엔드 유닛 테스트
	@echo "$(YELLOW)Running API tests...$(NC)"
	cd $(API_PATH) && npm test

test-api-watch: ## Test: 백엔드 테스트 (감시 모드)
	@echo "$(YELLOW)Running API tests (watch)...$(NC)"
	cd $(API_PATH) && npm test -- --watch

test-cov: ## Test: 테스트 커버리지 리포트
	@echo "$(YELLOW)Running tests with coverage...$(NC)"
	cd $(API_PATH) && npm run test:cov
	@echo "$(GREEN)✓ Coverage report generated$(NC)"

lint-mobile: ## Quality: 프론트엔드 린팅
	@echo "$(YELLOW)Linting mobile app...$(NC)"
	cd $(MOBILE_PATH) && ng lint

lint-api: ## Quality: 백엔드 린팅
	@echo "$(YELLOW)Linting API...$(NC)"
	cd $(API_PATH) && npm run lint

lint-all: lint-mobile lint-api ## Quality: 전체 코드 린팅
	@echo "$(GREEN)✓ Linting complete$(NC)"

format: ## Quality: 코드 포맷팅 (Prettier)
	@echo "$(YELLOW)Formatting code...$(NC)"
	npx prettier --write "apps/**/*.{ts,tsx,scss,html,json}"
	@echo "$(GREEN)✓ Code formatted$(NC)"

# ============================================================================
# Docker & Deployment
# ============================================================================

docker-up: ## Docker: 전체 Docker 스택 시작 (compose)
	@echo "$(YELLOW)Starting Docker services...$(NC)"
	docker-compose up -d
	@sleep 2
	@echo "$(GREEN)✓ Services running:$(NC)"
	@echo "  - API: http://localhost:3000"
	@echo "  - Mobile: http://localhost:8080"
	@echo "  - PostgreSQL: localhost:5432"
	@echo "  - Redis: localhost:6379"

docker-down: ## Docker: Docker 서비스 중지
	@echo "$(YELLOW)Stopping Docker services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

docker-logs: ## Docker: Docker 서비스 로그 (실시간)
	@echo "$(YELLOW)Showing Docker logs...$(NC)"
	docker-compose logs -f

docker-build-mobile: ## Docker: 프론트엔드 Docker 이미지 빌드
	@echo "$(YELLOW)Building mobile Docker image...$(NC)"
	docker build -f Dockerfile.web -t erp-mobile:latest .
	@echo "$(GREEN)✓ Image built: erp-mobile:latest$(NC)"

docker-build-api: ## Docker: 백엔드 Docker 이미지 빌드
	@echo "$(YELLOW)Building API Docker image...$(NC)"
	docker build -f Dockerfile.api -t erp-api:latest .
	@echo "$(GREEN)✓ Image built: erp-api:latest$(NC)"

docker-push: docker-build-mobile docker-build-api ## Docker: Docker 이미지 푸시 (레지스트리)
	@echo "$(YELLOW)Pushing images to registry...$(NC)"
	docker push erp-mobile:latest
	docker push erp-api:latest
	@echo "$(GREEN)✓ Images pushed$(NC)"

# ============================================================================
# Database & Migration
# ============================================================================

db-migrate: ## Database: Prisma 마이그레이션 (dev)
	@echo "$(YELLOW)Running migrations...$(NC)"
	npx prisma migrate dev
	@echo "$(GREEN)✓ Migrations complete$(NC)"

db-migrate-deploy: ## Database: Prisma 마이그레이션 (프로덕션)
	@echo "$(YELLOW)Deploying migrations...$(NC)"
	npx prisma migrate deploy
	@echo "$(GREEN)✓ Production migrations deployed$(NC)"

db-studio: ## Database: Prisma Studio GUI (http://localhost:5555)
	@echo "$(YELLOW)Starting Prisma Studio...$(NC)"
	npx prisma studio

db-seed: ## Database: 시드 데이터 로드
	@echo "$(YELLOW)Seeding database...$(NC)"
	npx prisma db seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

db-reset: ## Database: 데이터베이스 전체 리셋 (경고: 데이터 손실!)
	@echo "$(RED)⚠️  WARNING: This will delete all data!$(NC)"
	@read -p "Continue? (y/N): " confirm && [ "$$confirm" = "y" ] && \
	npx prisma migrate reset && \
	echo "$(GREEN)✓ Database reset$(NC)" || echo "Cancelled"

# ============================================================================
# Native Builds
# ============================================================================

android-build: ## Native: Android APK 빌드 (디버그)
	@echo "$(YELLOW)Building Android APK...$(NC)"
	npx cap sync android
	cd $(MOBILE_PATH)/android && ./gradlew assembleDebug
	@echo "$(GREEN)✓ APK built: app/build/outputs/apk/debug/app-debug.apk$(NC)"

android-release: ## Native: Android AAB 빌드 (릴리스)
	@echo "$(YELLOW)Building Android AAB (release)...$(NC)"
	npx cap sync android
	cd $(MOBILE_PATH)/android && ./gradlew bundleRelease
	@echo "$(GREEN)✓ AAB built: app/build/outputs/bundle/release/app-release.aab$(NC)"

android-install: android-build ## Native: Android APK 설치 및 실행
	@echo "$(YELLOW)Installing and running APK...$(NC)"
	adb install $(MOBILE_PATH)/android/app/build/outputs/apk/debug/app-debug.apk
	adb shell am start -n com.company.erp.logistics/.MainActivity
	@echo "$(GREEN)✓ App installed and started$(NC)"

ios-build: ## Native: iOS 앱 빌드
	@echo "$(YELLOW)Building iOS app...$(NC)"
	npx cap sync ios
	cd $(MOBILE_PATH)/ios/App && xcodebuild -scheme App -configuration Debug build
	@echo "$(GREEN)✓ iOS build complete$(NC)"

# ============================================================================
# Utilities & Cleanup
# ============================================================================

clean: ## Cleanup: 빌드 아티팩트 제거
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf dist/
	rm -rf $(MOBILE_PATH)/dist/
	rm -rf $(API_PATH)/dist/
	@echo "$(GREEN)✓ Cleaned$(NC)"

clean-deps: ## Cleanup: node_modules 및 lock 파일 제거
	@echo "$(RED)⚠️  Removing dependencies...$(NC)"
	rm -rf node_modules
	rm -rf $(MOBILE_PATH)/node_modules
	rm -rf $(API_PATH)/node_modules
	rm -rf pnpm-lock.yaml package-lock.json
	@echo "$(GREEN)✓ Cleaned$(NC)"

clean-all: clean clean-deps docker-down ## Cleanup: 전체 정리 (빌드, deps, docker)
	@echo "$(GREEN)✓ Full cleanup complete$(NC)"

reset: ## Cleanup: 프로젝트 초기화 (경고!)
	@echo "$(RED)⚠️  This will reset the entire project!$(NC)"
	@read -p "Continue? (y/N): " confirm && [ "$$confirm" = "y" ] && \
	make clean-all && \
	make install && \
	echo "$(GREEN)✓ Project reset$(NC)" || echo "Cancelled"

cache-clear: ## Cleanup: 모든 캐시 제거
	@echo "$(YELLOW)Clearing caches...$(NC)"
	@rm -rf ~/.cache/pnpm
	@rm -rf ~/.npm
	@npm cache clean --force
	pnpm store prune
	@echo "$(GREEN)✓ Caches cleared$(NC)"

info: ## Utilities: 프로젝트 정보 출력
	@echo "$(BLUE)=== Project Information ===$(NC)"
	@echo "$(GREEN)Node:$(NC) $$(node --version)"
	@echo "$(GREEN)npm:$(NC) $$(npm --version)"
	@echo "$(GREEN)pnpm:$(NC) $$(pnpm --version)"
	@echo "$(GREEN)Angular:$(NC) $$(cd apps/mobile && ng version 2>/dev/null | head -1 || echo 'Not found')"
	@echo "$(GREEN)NestJS:$(NC) $$(cd apps/api && grep '@nestjs/core' package.json | cut -d'"' -f4 || echo 'Not found')"
	@echo "$(GREEN)Docker:$(NC) $$(docker --version 2>/dev/null || echo 'Not installed')"
	@echo "$(GREEN)Docker Compose:$(NC) $$(docker-compose --version 2>/dev/null || echo 'Not installed')"

.DEFAULT_GOAL := help
