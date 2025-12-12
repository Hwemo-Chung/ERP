#!/bin/bash

echo "🚀 ERP E2E 테스트 전체 자동 실행"
echo "=================================="
echo ""

# 1. API 서버 확인
echo "1️⃣ API 서버 상태 확인..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "   ✅ API 서버 이미 실행 중"
else
    echo "   ⏳ API 서버 시작..."
    pnpm run api:dev > /tmp/api.log 2>&1 &
    sleep 8
fi

# 2. 웹 서버 시작
echo "2️⃣ 웹 서버 시작..."
pnpm run web:dev > /tmp/web.log 2>&1 &
sleep 12

# 3. 서버 상태 확인
echo "3️⃣ 서버 헬스 체크..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ API 서버: 응답 OK"
else
    echo "   ⚠️ API 서버: 응답 없음"
fi

if curl -s http://localhost:4200 > /dev/null 2>&1; then
    echo "   ✅ 웹 서버: 응답 OK"
else
    echo "   ⚠️ 웹 서버: 응답 없음"
fi

echo ""
echo "4️⃣ Cypress E2E 테스트 실행 중..."
echo "=================================="
echo ""

# 4. 테스트 실행
npx cypress run --spec "cypress/e2e/page-tests.cy.ts" --headless

echo ""
echo "=================================="
echo "✅ 테스트 완료"
