#!/bin/bash

# ============================================================================
# Logistics ERP - One-Shot Setup Script
# 원샷 설정 스크립트: 프로젝트 초기화부터 개발 서버 시작까지
# ============================================================================

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================================================
# Step 0: 환영 메시지
# ============================================================================
clear
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     🚀 Logistics ERP - One-Shot Setup                   ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}                                                        ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  이 스크립트는 다음을 자동으로 설정합니다:           ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ✓ Node.js 버전 (nvm)                                 ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ✓ Java 버전 (jenv)                                   ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ✓ 의존성 설치                                        ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ✓ 환경 변수 설정                                     ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ✓ Docker 서비스 시작                                 ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ✓ 개발 서버 실행                                     ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}                                                        ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Step 1: 전제 조건 확인
# ============================================================================
log_info "Step 1: 전제 조건 확인..."

# Git 확인
if ! command -v git &> /dev/null; then
    log_error "Git이 설치되지 않았습니다"
    exit 1
fi
log_success "Git 설치됨"

# nvm 확인
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    log_success "nvm 설치됨"
else
    log_warn "nvm이 설치되지 않았습니다. 수동으로 설치해주세요:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
fi

# jenv 확인
if ! command -v jenv &> /dev/null; then
    log_warn "jenv가 설치되지 않았습니다. 수동으로 설치해주세요:"
    echo "  brew install jenv"
fi

# Docker 확인 및 설치
if ! command -v docker &> /dev/null; then
    log_warn "Docker가 설치되지 않았습니다. 설치를 시작합니다..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        log_info "Homebrew를 통해 Docker Desktop 설치 중..."
        if ! command -v brew &> /dev/null; then
            log_error "Homebrew가 필요합니다. 다음 명령어로 설치하세요:"
            echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            exit 1
        fi
        brew install docker
        log_success "Docker 설치됨"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux (Ubuntu/Debian)
        log_info "apt를 통해 Docker 설치 중..."
        sudo apt-get update
        sudo apt-get install -y docker.io docker-compose
        sudo usermod -aG docker $USER
        log_success "Docker 설치됨 (재로그인 필요할 수 있습니다)"
    else
        log_error "지원하지 않는 OS입니다. 수동 설치 필요:"
        log_info "https://www.docker.com/products/docker-desktop"
        exit 1
    fi
else
    DOCKER_VERSION=$(docker --version 2>/dev/null | sed -E 's/Docker version ([0-9.]+).*/\1/')
    log_success "Docker $DOCKER_VERSION 설치됨"
fi

# Docker Compose 확인 (플러그인 또는 standalone)
check_docker_compose() {
    # docker compose (플러그인) 확인
    if docker compose version > /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
        COMPOSE_VERSION=$(docker compose version 2>/dev/null | sed -E 's/.*version[: ]?([0-9.]+).*/\1/')
        return 0
    fi
    # docker-compose (standalone) 확인
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        COMPOSE_VERSION=$(docker-compose --version 2>/dev/null | sed -E 's/.*version[: ]?([0-9.]+).*/\1/')
        return 0
    fi
    return 1
}

if ! check_docker_compose; then
    log_warn "Docker Compose가 설치되지 않았습니다. 설치 중..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install docker-compose
        # 플러그인 경로 설정
        mkdir -p ~/.docker
        if [ -f ~/.docker/config.json ]; then
            # jq가 있으면 JSON 수정, 없으면 단순 추가
            if command -v jq &> /dev/null; then
                jq '. + {"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]}' ~/.docker/config.json > ~/.docker/config.json.tmp && mv ~/.docker/config.json.tmp ~/.docker/config.json
            fi
        else
            echo '{"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]}' > ~/.docker/config.json
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y docker-compose
    fi
    check_docker_compose
    log_success "Docker Compose 설치됨"
else
    log_success "Docker Compose $COMPOSE_VERSION 설치됨"
fi

echo ""

# ============================================================================
# Step 2: 앱 타입 선택 (웹 vs 모바일 vs 둘 다)
# ============================================================================
log_info "Step 2: 설치할 앱 타입을 선택하세요..."
echo ""
echo -e "${BLUE}어떤 버전을 설치하시겠습니까?${NC}"
echo "1. 웹 버전만 (PWA - 데스크톱/모바일 브라우저) → http://localhost:4200"
echo "2. 모바일 앱만 (Ionic - 실제 모바일 앱) → Android/iOS"
echo "3. 둘 다 (웹 + 모바일 - 완전한 ERP 시스템)"
echo ""
read -p "선택 (1-3): " app_choice

case $app_choice in
    1)
        APP_TYPES="web"
        log_success "웹 버전 설치 선택"
        ;;
    2)
        APP_TYPES="mobile"
        log_success "모바일 버전 설치 선택"
        ;;
    3)
        APP_TYPES="web mobile"
        log_success "웹 + 모바일 버전 설치 선택"
        ;;
    *)
        log_error "잘못된 선택입니다"
        exit 1
        ;;
esac

echo ""

# ============================================================================
# Step 3: Node.js 버전 설정
# ============================================================================
log_info "Step 3: Node.js 버전 설정 (.nvmrc)..."

if [ -f ".nvmrc" ]; then
    NVM_DIR="${NVM_DIR-$HOME/.nvm}"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm use
    log_success "Node.js $(node --version) 로드됨"
else
    log_warn ".nvmrc 파일을 찾을 수 없습니다"
fi

echo ""

# ============================================================================
# Step 3: Java 버전 설정
# ============================================================================
log_info "Step 3: Java 버전 설정 (.java-version)..."

if command -v jenv &> /dev/null; then
    if [ -f ".java-version" ]; then
        eval "$(jenv init -)"
        jenv local
        log_success "Java 버전 로드됨"
    else
        log_warn ".java-version 파일을 찾을 수 없습니다"
    fi
else
    log_warn "jenv가 설치되지 않아 Java 버전 설정을 건너뜁니다"
fi

echo ""

# ============================================================================
# Step 4: 의존성 설치
# ============================================================================
log_info "Step 4: 의존성 설치..."

# Root level dependencies
if [ ! -d "node_modules" ]; then
    log_info "root node_modules 설치 중..."
    if command -v pnpm &> /dev/null; then
        pnpm install
        log_success "pnpm으로 의존성 설치 완료"
    else
        npm install
        log_success "npm으로 의존성 설치 완료"
    fi
else
    log_success "root node_modules 이미 설치됨"
fi

# App-specific dependencies
for APP in $APP_TYPES; do
    if [ ! -d "apps/$APP/node_modules" ]; then
        log_info "apps/$APP node_modules 설치 중..."
        cd apps/$APP
        if command -v pnpm &> /dev/null; then
            pnpm install
        else
            npm install
        fi
        cd ../..
        log_success "apps/$APP 의존성 설치 완료"
    else
        log_success "apps/$APP node_modules 이미 설치됨"
    fi
done

echo ""

# ============================================================================
# Step 5: 환경 변수 설정
# ============================================================================
log_info "Step 5: 환경 변수 설정..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success ".env 파일 생성됨 (.env.example에서 복사)"
        log_warn "⚠️  .env 파일을 열어서 설정값을 수정해주세요:"
        echo "  API_URL, DATABASE_URL, JWT_SECRET 등"
    else
        log_error ".env.example 파일을 찾을 수 없습니다"
        exit 1
    fi
else
    log_success ".env 파일이 이미 존재합니다"
fi

echo ""

# ============================================================================
# Step 6: Docker 서비스 시작
# ============================================================================
log_info "Step 6: Docker 서비스 시작..."

# Colima 사용 여부 확인 및 Docker 소켓 설정
setup_docker_socket() {
    # Colima 소켓 확인
    if [ -S "$HOME/.colima/default/docker.sock" ]; then
        export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
        log_info "Colima Docker 소켓 사용"
        return 0
    fi
    # Docker Desktop 소켓 확인
    if [ -S "$HOME/.docker/run/docker.sock" ]; then
        export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
        return 0
    fi
    # 기본 소켓 확인
    if [ -S "/var/run/docker.sock" ]; then
        return 0
    fi
    return 1
}

# Docker 데몬 실행 확인 및 시작
start_docker() {
    setup_docker_socket

    if docker info > /dev/null 2>&1; then
        log_success "Docker 데몬이 이미 실행 중"
        return 0
    fi

    log_warn "Docker 데몬이 실행 중이 아닙니다. 시작하는 중..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - Colima 또는 Docker Desktop 시도
        if command -v colima &> /dev/null; then
            log_info "Colima를 시작 중입니다..."
            colima start 2>/dev/null || true
            sleep 5
            setup_docker_socket
            if docker info > /dev/null 2>&1; then
                log_success "Colima Docker 시작됨"
                return 0
            fi
        fi

        # Docker Desktop 시도
        if [ -d "/Applications/Docker.app" ]; then
            log_info "Docker Desktop을 시작 중입니다 (30초 대기)..."
            open -a Docker
            for i in {1..30}; do
                setup_docker_socket
                if docker info > /dev/null 2>&1; then
                    log_success "Docker Desktop 시작됨"
                    return 0
                fi
                sleep 1
                printf "."
            done
        fi

        log_error "Docker 시작 실패. 다음 중 하나를 실행해주세요:"
        echo "  - Colima: colima start"
        echo "  - Docker Desktop: open -a Docker"
        exit 1
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - Docker daemon 시작
        log_info "Docker daemon을 시작 중입니다..."
        sudo systemctl start docker
        sudo usermod -aG docker $USER
        newgrp docker
        log_success "Docker 시작됨"
    fi
}

start_docker

# Docker Compose 시작
log_info "PostgreSQL과 Redis를 시작 중입니다..."
$COMPOSE_CMD up -d postgres redis

# 컨테이너 준비 대기 (30초)
log_info "데이터베이스 준비 대기 중... (최대 30초)"
for i in {1..30}; do
    if docker exec erp_postgres pg_isready -U erp_user > /dev/null 2>&1; then
        echo ""
        log_success "PostgreSQL 준비 완료"
        break
    fi

    if [ $i -eq 30 ]; then
        echo ""
        log_warn "PostgreSQL 준비 시간 초과. 계속 진행합니다."
    fi

    sleep 1
    printf "."
done

log_success "Redis 시작됨"

echo ""

# ============================================================================
# Step 7: 데이터베이스 마이그레이션
# ============================================================================
log_info "Step 7: 데이터베이스 마이그레이션..."

read -p "데이터베이스 마이그레이션을 실행하시겠습니까? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Prisma 스키마는 프로젝트 루트에 있음

    # Prisma client 생성
    log_info "Prisma client 생성 중..."
    npx prisma generate

    # 마이그레이션 실행 (deploy는 기존 마이그레이션 적용, dev는 새 마이그레이션 생성)
    log_info "마이그레이션 실행 중..."
    if [ -d "prisma/migrations" ]; then
        npx prisma migrate deploy
    else
        log_info "마이그레이션 폴더가 없습니다. 초기 마이그레이션을 생성합니다..."
        npx prisma migrate dev --name init
    fi

    log_success "마이그레이션 완료"
else
    log_info "마이그레이션 건너뛰었습니다"
fi

echo ""

# ============================================================================
# Step 8: 개발 서버 시작
# ============================================================================
log_info "Step 8: 개발 서버 시작..."

echo ""
echo -e "${BLUE}어떤 개발 환경을 시작하시겠습니까?${NC}"

if echo "$APP_TYPES" | grep -q "web"; then
    echo "1. 웹 버전만 - http://localhost:4200"
fi
if echo "$APP_TYPES" | grep -q "mobile"; then
    if echo "$APP_TYPES" | grep -q "web"; then
        echo "2. 모바일 버전만 - http://localhost:4201"
        echo "3. 웹 + 모바일 (두 개의 포트에서) - 4200 + 4201"
        echo "4. 백엔드만 (API) - http://localhost:3000"
        echo "5. 전체 (웹 + 모바일 + 백엔드) - 3개의 터미널"
        echo "6. 수동 실행"
    else
        echo "2. 백엔드만 (API) - http://localhost:3000"
        echo "3. 전체 (모바일 + 백엔드) - 2개의 터미널"
        echo "4. 수동 실행"
    fi
else
    echo "1. 백엔드만 (API) - http://localhost:3000"
    echo "2. 전체 (웹 + 백엔드) - 2개의 터미널"
    echo "3. 수동 실행"
fi

echo ""
read -p "선택: " dev_choice

# 선택된 앱 타입에 따른 처리
if echo "$APP_TYPES" | grep -q "web" && echo "$APP_TYPES" | grep -q "mobile"; then
    # 웹 + 모바일 둘 다
    case $dev_choice in
        1)
            log_info "웹 버전 개발 서버를 시작합니다..."
            cd apps/web && ng serve --open
            ;;
        2)
            log_info "모바일 버전 개발 서버를 시작합니다..."
            cd apps/mobile && ng serve --port 4201 --open
            ;;
        3)
            log_info "웹 + 모바일을 시작합니다 (2개의 포트)..."
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/web' && ng serve --open"
end tell
EOF
            sleep 2
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/mobile' && ng serve --port 4201 --open"
end tell
EOF
            log_success "웹 (4200) + 모바일 (4201) 시작됨!"
            ;;
        4)
            log_info "백엔드 개발 서버를 시작합니다..."
            cd apps/api && npm run start:dev
            ;;
        5)
            log_info "전체 스택을 시작합니다 (3개의 터미널)..."
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/api' && npm run start:dev"
end tell
EOF
            sleep 2
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/web' && ng serve --open"
end tell
EOF
            sleep 2
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/mobile' && ng serve --port 4201 --open"
end tell
EOF
            log_success "모든 서버가 시작되었습니다! (API: 3000, 웹: 4200, 모바일: 4201)"
            ;;
        6)
            log_info "수동 실행 선택"
            echo ""
            echo -e "${BLUE}다음 명령어로 시작하세요:${NC}"
            echo "  웹:       cd apps/web && ng serve"
            echo "  모바일:   cd apps/mobile && ng serve --port 4201"
            echo "  백엔드:   cd apps/api && npm run start:dev"
            ;;
        *)
            log_error "잘못된 선택입니다"
            exit 1
            ;;
    esac
elif echo "$APP_TYPES" | grep -q "web"; then
    # 웹만
    case $dev_choice in
        1)
            log_info "웹 버전 개발 서버를 시작합니다..."
            cd apps/web && ng serve --open
            ;;
        2)
            log_info "백엔드 개발 서버를 시작합니다..."
            cd apps/api && npm run start:dev
            ;;
        3)
            log_info "웹 + 백엔드를 시작합니다..."
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/api' && npm run start:dev"
end tell
EOF
            sleep 2
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/web' && ng serve --open"
end tell
EOF
            log_success "웹 (4200) + 백엔드 (3000) 시작됨!"
            ;;
        4)
            log_info "수동 실행 선택"
            echo ""
            echo -e "${BLUE}다음 명령어로 시작하세요:${NC}"
            echo "  웹:       cd apps/web && ng serve"
            echo "  백엔드:   cd apps/api && npm run start:dev"
            ;;
        *)
            log_error "잘못된 선택입니다"
            exit 1
            ;;
    esac
else
    # 모바일만
    case $dev_choice in
        1)
            log_info "모바일 버전 개발 서버를 시작합니다..."
            cd apps/mobile && ng serve --open
            ;;
        2)
            log_info "백엔드 개발 서버를 시작합니다..."
            cd apps/api && npm run start:dev
            ;;
        3)
            log_info "모바일 + 백엔드를 시작합니다..."
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/api' && npm run start:dev"
end tell
EOF
            sleep 2
            osascript <<EOF
tell app "Terminal"
    do script "cd '$(pwd)/apps/mobile' && ng serve --open"
end tell
EOF
            log_success "모바일 (4200) + 백엔드 (3000) 시작됨!"
            ;;
        4)
            log_info "수동 실행 선택"
            echo ""
            echo -e "${BLUE}다음 명령어로 시작하세요:${NC}"
            echo "  모바일:   cd apps/mobile && ng serve"
            echo "  백엔드:   cd apps/api && npm run start:dev"
            ;;
        *)
            log_error "잘못된 선택입니다"
            exit 1
            ;;
    esac
fi

echo ""

# ============================================================================
# 완료 메시지 (동적)
# ============================================================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}     ✓ 설정 완료!                                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                        ${GREEN}║${NC}"

# 선택된 앱 타입에 따른 접속 주소 표시
if [[ "$APP_TYPES" == "web mobile" ]]; then
    echo -e "${GREEN}║${NC}  접속 주소 (웹 + 모바일):                            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • 웹 App: http://localhost:4200                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • 모바일 App: http://localhost:4201                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • API: http://localhost:3000                       ${GREEN}║${NC}"
elif [[ "$APP_TYPES" == "web" ]]; then
    echo -e "${GREEN}║${NC}  접속 주소 (웹 전용):                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • 웹 App: http://localhost:4200                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • API: http://localhost:3000                       ${GREEN}║${NC}"
elif [[ "$APP_TYPES" == "mobile" ]]; then
    echo -e "${GREEN}║${NC}  접속 주소 (모바일 전용):                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • 모바일 App: http://localhost:4200                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • API: http://localhost:3000                       ${GREEN}║${NC}"
fi

echo -e "${GREEN}║${NC}  • DB Studio: http://localhost:5555                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  • Redis: localhost:6379                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  • PostgreSQL: localhost:5432                         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  다음 명령어가 유용합니다:                            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  • make help          전체 명령어 확인                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  • make db-studio     데이터베이스 관리               ${GREEN}║${NC}"

if [[ "$APP_TYPES" == *"mobile"* ]]; then
    echo -e "${GREEN}║${NC}  • make test-mobile   모바일 테스트                   ${GREEN}║${NC}"
fi
if [[ "$APP_TYPES" == *"web"* ]]; then
    echo -e "${GREEN}║${NC}  • make test-web      웹 테스트                       ${GREEN}║${NC}"
fi

echo -e "${GREEN}║${NC}  • make test-api      백엔드 테스트                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  • docker compose ps  Docker 상태 확인               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Happy Coding! 🚀                                     ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
