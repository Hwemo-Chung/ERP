#!/bin/bash

# ============================================
# ERP Logistics - 전체 시스템 자동 구동 스크립트
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# 로그 디렉토리
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

# PID 파일
PID_FILE="$PROJECT_ROOT/.pids"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ERP Logistics 시스템 시작${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 함수: 프로세스 종료
cleanup() {
    echo -e "\n${YELLOW}시스템 종료 중...${NC}"
    if [ -f "$PID_FILE" ]; then
        while read pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                echo -e "${GREEN}프로세스 $pid 종료됨${NC}"
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    echo -e "${GREEN}모든 프로세스 종료 완료${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 함수: 포트 사용 확인
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 함수: 서비스 대기
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    echo -e "${YELLOW}$name 시작 대기 중...${NC}"
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ $name 준비 완료${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e "${RED}✗ $name 시작 실패 (타임아웃)${NC}"
    return 1
}

# 1. 환경 변수 설정
echo -e "${BLUE}[1/6] 환경 변수 설정${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}.env 파일이 없습니다. .env.example에서 복사합니다.${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        # 기본값 설정
        sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://erp_user:erp_password@localhost:5432/erp_logistics|g' .env 2>/dev/null || \
        sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://erp_user:erp_password@localhost:5432/erp_logistics|g' .env
        sed -i '' 's|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=dev-access-secret-key|g' .env 2>/dev/null || \
        sed -i 's|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=dev-access-secret-key|g' .env
        sed -i '' 's|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=dev-refresh-secret-key|g' .env 2>/dev/null || \
        sed -i 's|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=dev-refresh-secret-key|g' .env
    else
        echo -e "${RED}.env.example 파일을 찾을 수 없습니다.${NC}"
        exit 1
    fi
fi

# API 폴더에도 .env 복사
cp .env apps/api/.env 2>/dev/null || true
echo -e "${GREEN}✓ 환경 변수 설정 완료${NC}"

# 2. Docker 컨테이너 시작
echo -e "\n${BLUE}[2/6] Docker 컨테이너 시작${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

docker compose up -d
echo -e "${GREEN}✓ Docker 컨테이너 시작됨${NC}"

# PostgreSQL 준비 대기
echo -e "${YELLOW}PostgreSQL 준비 대기 중...${NC}"
max_pg_attempts=30
pg_attempt=1
while [ $pg_attempt -le $max_pg_attempts ]; do
    if docker exec erp_postgres pg_isready -U erp_user -d erp_logistics >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL 준비 완료${NC}"
        break
    fi
    sleep 1
    pg_attempt=$((pg_attempt + 1))
done

if [ $pg_attempt -gt $max_pg_attempts ]; then
    echo -e "${RED}PostgreSQL 시작 실패${NC}"
    exit 1
fi

# 3. 의존성 설치 확인
echo -e "\n${BLUE}[3/6] 의존성 확인${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}의존성 설치 중...${NC}"
    pnpm install
fi
echo -e "${GREEN}✓ 의존성 확인 완료${NC}"

# 4. Prisma 설정
echo -e "\n${BLUE}[4/6] 데이터베이스 설정${NC}"
source .env
export DATABASE_URL

# Prisma 클라이언트 생성
npx prisma generate --schema=./prisma/schema.prisma >/dev/null 2>&1
echo -e "${GREEN}✓ Prisma 클라이언트 생성됨${NC}"

# 마이그레이션 실행
npx prisma migrate deploy --schema=./prisma/schema.prisma >/dev/null 2>&1
echo -e "${GREEN}✓ 데이터베이스 마이그레이션 완료${NC}"

# 시드 데이터 확인 및 삽입
echo -e "${YELLOW}시드 데이터 확인 중...${NC}"
USER_COUNT=$(docker exec erp_postgres psql -U erp_user -d erp_logistics -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ')
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
    echo -e "${YELLOW}시드 데이터 삽입 중...${NC}"
    npx tsx prisma/seed.ts 2>/dev/null || true
fi
echo -e "${GREEN}✓ 데이터베이스 준비 완료${NC}"

# 5. 백엔드 API 시작
echo -e "\n${BLUE}[5/6] 백엔드 API 시작${NC}"
if check_port 3000; then
    echo -e "${YELLOW}포트 3000이 이미 사용 중입니다. 기존 프로세스 종료...${NC}"
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

cd "$PROJECT_ROOT/apps/api"
nohup pnpm run start:dev > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo $API_PID >> "$PID_FILE"
cd "$PROJECT_ROOT"

wait_for_service "http://localhost:3000/api/v1/health" "Backend API" 60

# 6. 모바일/웹 앱 시작
echo -e "\n${BLUE}[6/6] 모바일/웹 앱 시작${NC}"
if check_port 4200; then
    echo -e "${YELLOW}포트 4200이 이미 사용 중입니다. 기존 프로세스 종료...${NC}"
    lsof -ti :4200 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

cd "$PROJECT_ROOT/apps/mobile"
nohup pnpm run start > "$LOG_DIR/mobile.log" 2>&1 &
MOBILE_PID=$!
echo $MOBILE_PID >> "$PID_FILE"
cd "$PROJECT_ROOT"

wait_for_service "http://localhost:4200" "Mobile App" 60

# 완료 메시지
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✓ 모든 서비스 시작 완료!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}서비스 URL:${NC}"
echo -e "  • 웹/모바일 앱: ${GREEN}http://localhost:4200${NC}"
echo -e "  • API 서버:     ${GREEN}http://localhost:3000${NC}"
echo -e "  • API 문서:     ${GREEN}http://localhost:3000/docs${NC}"
echo -e "  • DB 관리자:    ${GREEN}http://localhost:8080${NC} (Adminer)"
echo ""
echo -e "${BLUE}테스트 계정:${NC}"
echo -e "  • 사용자명: ${GREEN}0001${NC}"
echo -e "  • 비밀번호: ${GREEN}test${NC}"
echo ""
echo -e "${BLUE}로그 파일:${NC}"
echo -e "  • API 로그:    ${GREEN}$LOG_DIR/api.log${NC}"
echo -e "  • Mobile 로그: ${GREEN}$LOG_DIR/mobile.log${NC}"
echo ""
echo -e "${YELLOW}종료하려면 Ctrl+C를 누르세요.${NC}"
echo ""

# 프로세스 유지
while true; do
    # 프로세스 상태 확인
    if ! kill -0 $API_PID 2>/dev/null; then
        echo -e "${RED}API 서버가 종료되었습니다. 로그 확인: $LOG_DIR/api.log${NC}"
        cleanup
    fi
    if ! kill -0 $MOBILE_PID 2>/dev/null; then
        echo -e "${RED}Mobile 앱이 종료되었습니다. 로그 확인: $LOG_DIR/mobile.log${NC}"
        cleanup
    fi
    sleep 5
done
