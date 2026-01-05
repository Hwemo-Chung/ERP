#!/bin/bash

# ============================================
# ERP Logistics - 전체 시스템 종료 스크립트
# ============================================

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_ROOT/.pids"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ERP Logistics 시스템 종료${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 1. 저장된 PID로 프로세스 종료
if [ -f "$PID_FILE" ]; then
    echo -e "${YELLOW}저장된 프로세스 종료 중...${NC}"
    while read pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo -e "${GREEN}✓ 프로세스 $pid 종료됨${NC}"
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
fi

# 2. 포트로 프로세스 종료
echo -e "\n${YELLOW}포트 3000 (API) 프로세스 종료...${NC}"
if lsof -ti :3000 >/dev/null 2>&1; then
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ 포트 3000 프로세스 종료됨${NC}"
else
    echo -e "${GREEN}✓ 포트 3000 사용 중인 프로세스 없음${NC}"
fi

echo -e "\n${YELLOW}포트 4300 (Web) 프로세스 종료...${NC}"
if lsof -ti :4300 >/dev/null 2>&1; then
    lsof -ti :4300 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ 포트 4300 프로세스 종료됨${NC}"
else
    echo -e "${GREEN}✓ 포트 4300 사용 중인 프로세스 없음${NC}"
fi

echo -e "\n${YELLOW}포트 4201 (Mobile) 프로세스 종료...${NC}"
if lsof -ti :4201 >/dev/null 2>&1; then
    lsof -ti :4201 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ 포트 4201 프로세스 종료됨${NC}"
else
    echo -e "${GREEN}✓ 포트 4201 사용 중인 프로세스 없음${NC}"
fi

# 3. Docker 컨테이너 종료 옵션
echo ""
read -p "Docker 컨테이너도 종료하시겠습니까? (y/N): " stop_docker
if [ "$stop_docker" = "y" ] || [ "$stop_docker" = "Y" ]; then
    echo -e "\n${YELLOW}Docker 컨테이너 종료 중...${NC}"
    cd "$PROJECT_ROOT"
    docker compose down
    echo -e "${GREEN}✓ Docker 컨테이너 종료됨${NC}"
else
    echo -e "${GREEN}✓ Docker 컨테이너 유지${NC}"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✓ 시스템 종료 완료${NC}"
echo -e "${GREEN}============================================${NC}"
