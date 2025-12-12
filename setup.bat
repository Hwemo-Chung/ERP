@echo off
REM ============================================================================
REM Logistics ERP - One-Shot Setup Script (Windows)
REM 원샷 설정 스크립트: 프로젝트 초기화부터 개발 서버 시작까지
REM ============================================================================

setlocal enabledelayedexpansion

REM 색상 정의 (Windows 10+ 지원)
set "COLOR_RESET=[0m"
set "COLOR_BLUE=[34m"
set "COLOR_GREEN=[32m"
set "COLOR_YELLOW=[33m"
set "COLOR_RED=[31m"

REM ============================================================================
REM Step 0: 환영 메시지
REM ============================================================================
cls
echo.
echo %COLOR_BLUE%╔════════════════════════════════════════════════════════════╗%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%     🚀 Logistics ERP - One-Shot Setup                   %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%                                                        %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%  이 스크립트는 다음을 자동으로 설정합니다:           %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%  ✓ Node.js 버전 (nvm)                                 %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%  ✓ 의존성 설치                                        %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%  ✓ 환경 변수 설정                                     %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%  ✓ Docker 서비스 시작                                 %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%  ✓ 개발 서버 실행                                     %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%║%COLOR_RESET%                                                        %COLOR_BLUE%║%COLOR_RESET%
echo %COLOR_BLUE%╚════════════════════════════════════════════════════════════╝%COLOR_RESET%
echo.
pause

REM ============================================================================
REM Step 1: 전제 조건 확인
REM ============================================================================
echo %COLOR_BLUE%[Step 1] 전제 조건 확인...%COLOR_RESET%

REM Node.js 확인
node --version > nul 2>&1
if errorlevel 1 (
    echo %COLOR_RED%✗ Node.js가 설치되지 않았습니다%COLOR_RESET%
    echo   설치: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set "NODE_VERSION=%%i"
echo %COLOR_GREEN%✓ Node.js !NODE_VERSION! 설치됨%COLOR_RESET%

REM npm 확인
npm --version > nul 2>&1
if errorlevel 1 (
    echo %COLOR_RED%✗ npm이 설치되지 않았습니다%COLOR_RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set "NPM_VERSION=%%i"
echo %COLOR_GREEN%✓ npm !NPM_VERSION! 설치됨%COLOR_RESET%

REM Git 확인
git --version > nul 2>&1
if errorlevel 1 (
    echo %COLOR_RED%✗ Git이 설치되지 않았습니다%COLOR_RESET%
    pause
    exit /b 1
)
echo %COLOR_GREEN%✓ Git 설치됨%COLOR_RESET%

REM Docker 확인 및 설치
docker --version > nul 2>&1
if errorlevel 1 (
    echo %COLOR_YELLOW%⚠️  Docker가 설치되지 않았습니다. 설치를 시작합니다...%COLOR_RESET%
    echo.
    echo %COLOR_BLUE%Docker Desktop 자동 설치 방법:%COLOR_RESET%
    echo 1. Windows Package Manager (winget) 사용:
    echo    winget install Docker.DockerDesktop
    echo.
    echo 2. 또는 수동 다운로드:
    echo    https://www.docker.com/products/docker-desktop
    echo.
    echo %COLOR_YELLOW%설치 후 스크립트를 다시 실행해주세요%COLOR_RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('docker --version') do set "DOCKER_VERSION=%%i"
echo %COLOR_GREEN%✓ !DOCKER_VERSION! 설치됨%COLOR_RESET%

REM Docker Compose 확인
docker-compose --version > nul 2>&1
if errorlevel 1 (
    echo %COLOR_YELLOW%⚠️  Docker Compose를 설치 중입니다...%COLOR_RESET%
    echo Docker Desktop에 포함되어 있습니다.
    echo Docker Desktop을 재시작해주세요.
)
echo %COLOR_GREEN%✓ Docker Compose 설치됨%COLOR_RESET%

echo.

REM ============================================================================
REM Step 2: 설치할 앱 타입 선택
REM ============================================================================
echo %COLOR_BLUE%[Step 2] 설치할 앱 타입을 선택하세요...%COLOR_RESET%
echo.
echo 1. 웹 버전만 (PWA - 데스크톱/모바일 브라우저)
echo    접속: http://localhost:4200
echo.
echo 2. 모바일 앱만 (Ionic - 실제 모바일 앱)
echo    접속: Android/iOS
echo.
echo 3. 둘 다 (웹 + 모바일 - 완전한 ERP 시스템)
echo    웹: http://localhost:4200, 모바일: http://localhost:4201
echo.
echo 4. 아무것도 선택하지 않음 (종료)
echo.

set /p app_choice="선택 (1-4): "

if "!app_choice!"=="1" (
    set APP_TYPES=web
    echo %COLOR_GREEN%✓ 웹 버전 설치 선택%COLOR_RESET%
) else if "!app_choice!"=="2" (
    set APP_TYPES=mobile
    echo %COLOR_GREEN%✓ 모바일 버전 설치 선택%COLOR_RESET%
) else if "!app_choice!"=="3" (
    set APP_TYPES=web mobile
    echo %COLOR_GREEN%✓ 웹 + 모바일 설치 선택%COLOR_RESET%
) else if "!app_choice!"=="4" (
    echo %COLOR_YELLOW%설정을 취소합니다%COLOR_RESET%
    pause
    exit /b 0
) else (
    echo %COLOR_RED%✗ 잘못된 선택입니다%COLOR_RESET%
    pause
    exit /b 1
)

echo.

REM ============================================================================
REM Step 3: 의존성 설치
REM ============================================================================
echo %COLOR_BLUE%[Step 3] 의존성 설치...%COLOR_RESET%

REM Root 레벨 의존성
if not exist "node_modules" (
    echo %COLOR_YELLOW%⚠️  node_modules를 찾을 수 없습니다. 설치 중...%COLOR_RESET%
    call npm install
    echo %COLOR_GREEN%✓ root node_modules 설치 완료%COLOR_RESET%
) else (
    echo %COLOR_GREEN%✓ root node_modules 이미 설치됨%COLOR_RESET%
)

REM 앱별 의존성
for %%A in (!APP_TYPES!) do (
    if not exist "apps\%%A\node_modules" (
        echo %COLOR_YELLOW%⚠️  apps\%%A\node_modules를 찾을 수 없습니다. 설치 중...%COLOR_RESET%
        cd apps\%%A
        call npm install
        cd ..\..
        echo %COLOR_GREEN%✓ apps\%%A 의존성 설치 완료%COLOR_RESET%
    ) else (
        echo %COLOR_GREEN%✓ apps\%%A node_modules 이미 설치됨%COLOR_RESET%
    )
)

echo.

REM ============================================================================
REM Step 4: 환경 변수 설정
REM ============================================================================
echo %COLOR_BLUE%[Step 4] 환경 변수 설정...%COLOR_RESET%

if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env > nul
        echo %COLOR_GREEN%✓ .env 파일 생성됨 (.env.example에서 복사)%COLOR_RESET%
        echo %COLOR_YELLOW%⚠️  .env 파일을 열어서 설정값을 수정해주세요:%COLOR_RESET%
        echo   API_URL, DATABASE_URL, JWT_SECRET 등
    ) else (
        echo %COLOR_RED%✗ .env.example 파일을 찾을 수 없습니다%COLOR_RESET%
        pause
        exit /b 1
    )
) else (
    echo %COLOR_GREEN%✓ .env 파일이 이미 존재합니다%COLOR_RESET%
)

echo.

REM ============================================================================
REM Step 5: Docker 서비스 시작
REM ============================================================================
echo %COLOR_BLUE%[Step 5] Docker 서비스 시작...%COLOR_RESET%

REM Docker 데몬 실행 확인
docker info > nul 2>&1
if errorlevel 1 (
    echo %COLOR_RED%✗ Docker 데몬이 실행 중이 아닙니다%COLOR_RESET%
    echo   Docker Desktop을 시작해주세요
    pause
    exit /b 1
)

echo %COLOR_YELLOW%PostgreSQL과 Redis를 시작 중입니다...%COLOR_RESET%
call docker-compose up -d postgres redis

echo %COLOR_GREEN%✓ Docker 서비스 시작됨%COLOR_RESET%

echo.

REM ============================================================================
REM Step 6: 데이터베이스 마이그레이션 (선택사항)
REM ============================================================================
echo %COLOR_BLUE%[Step 6] 데이터베이스 마이그레이션...%COLOR_RESET%

set /p migrate_choice="데이터베이스 마이그레이션을 실행하시겠습니까? (y/n): "
if /i "!migrate_choice!"=="y" (
    call npx prisma migrate deploy
    echo %COLOR_GREEN%✓ 마이그레이션 완료%COLOR_RESET%
) else (
    echo %COLOR_YELLOW%⚠️  마이그레이션 건너뛰었습니다%COLOR_RESET%
)

echo.

REM ============================================================================
REM Step 7: 개발 서버 시작
REM ============================================================================
echo %COLOR_BLUE%[Step 7] 개발 서버 시작...%COLOR_RESET%

echo.
echo %COLOR_BLUE%어떤 개발 환경을 시작하시겠습니까?%COLOR_RESET%
echo.

if "!APP_TYPES!"=="web mobile" (
    echo 1. 웹만 (port 4200)
    echo 2. 모바일만 (port 4201)
    echo 3. 웹 + 모바일 (4200, 4201)
    echo 4. 백엔드만 (port 3000)
    echo 5. 전체 (웹 + 모바일 + 백엔드)
    echo 6. 수동 실행
    echo.
    set /p dev_choice="선택 (1-6): "
) else if "!APP_TYPES!"=="web" (
    echo 1. 웹 (port 4200)
    echo 2. 백엔드 (port 3000)
    echo 3. 웹 + 백엔드
    echo 4. 수동 실행
    echo.
    set /p dev_choice="선택 (1-4): "
) else if "!APP_TYPES!"=="mobile" (
    echo 1. 모바일 (port 4200)
    echo 2. 백엔드 (port 3000)
    echo 3. 모바일 + 백엔드
    echo 4. 수동 실행
    echo.
    set /p dev_choice="선택 (1-4): "
)

REM 웹 + 모바일 선택
if "!APP_TYPES!"=="web mobile" (
    if "!dev_choice!"=="1" (
        echo %COLOR_YELLOW%웹 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\web
        call ng serve --open
    ) else if "!dev_choice!"=="2" (
        echo %COLOR_YELLOW%모바일 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\mobile
        call ng serve --port 4201 --open
    ) else if "!dev_choice!"=="3" (
        echo %COLOR_YELLOW%웹과 모바일을 시작합니다 (2개의 새 터미널에서)...%COLOR_RESET%

        echo %COLOR_YELLOW%새 터미널에서 웹을 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\web && ng serve --open"

        timeout /t 3

        echo %COLOR_YELLOW%새 터미널에서 모바일을 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\mobile && ng serve --port 4201 --open"
    ) else if "!dev_choice!"=="4" (
        echo %COLOR_YELLOW%백엔드 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\api
        call npm run start:dev
    ) else if "!dev_choice!"=="5" (
        echo %COLOR_YELLOW%전체 스택을 시작합니다 (3개의 새 터미널에서)...%COLOR_RESET%

        echo %COLOR_YELLOW%새 터미널에서 백엔드를 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\api && npm run start:dev"

        timeout /t 3

        echo %COLOR_YELLOW%새 터미널에서 웹을 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\web && ng serve --open"

        timeout /t 3

        echo %COLOR_YELLOW%새 터미널에서 모바일을 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\mobile && ng serve --port 4201"

        echo %COLOR_GREEN%✓ 모든 서버가 시작되었습니다!%COLOR_RESET%
    ) else if "!dev_choice!"=="6" (
        echo %COLOR_YELLOW%개발 서버를 시작하지 않았습니다%COLOR_RESET%
        echo.
        echo %COLOR_BLUE%수동으로 시작하려면:%COLOR_RESET%
        echo   웹:     cd apps\web ^&^& ng serve
        echo   모바일: cd apps\mobile ^&^& ng serve --port 4201
        echo   백엔드: cd apps\api ^&^& npm run start:dev
    ) else (
        echo %COLOR_RED%✗ 잘못된 선택입니다%COLOR_RESET%
        pause
        exit /b 1
    )
) else if "!APP_TYPES!"=="web" (
    if "!dev_choice!"=="1" (
        echo %COLOR_YELLOW%웹 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\web
        call ng serve --open
    ) else if "!dev_choice!"=="2" (
        echo %COLOR_YELLOW%백엔드 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\api
        call npm run start:dev
    ) else if "!dev_choice!"=="3" (
        echo %COLOR_YELLOW%웹과 백엔드를 시작합니다 (2개의 새 터미널에서)...%COLOR_RESET%

        echo %COLOR_YELLOW%새 터미널에서 백엔드를 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\api && npm run start:dev"

        timeout /t 2

        echo %COLOR_YELLOW%새 터미널에서 웹을 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\web && ng serve --open"

        echo %COLOR_GREEN%✓ 모든 서버가 시작되었습니다!%COLOR_RESET%
    ) else if "!dev_choice!"=="4" (
        echo %COLOR_YELLOW%개발 서버를 시작하지 않았습니다%COLOR_RESET%
        echo.
        echo %COLOR_BLUE%수동으로 시작하려면:%COLOR_RESET%
        echo   웹:     cd apps\web ^&^& ng serve
        echo   백엔드: cd apps\api ^&^& npm run start:dev
    ) else (
        echo %COLOR_RED%✗ 잘못된 선택입니다%COLOR_RESET%
        pause
        exit /b 1
    )
) else if "!APP_TYPES!"=="mobile" (
    if "!dev_choice!"=="1" (
        echo %COLOR_YELLOW%모바일 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\mobile
        call ng serve --open
    ) else if "!dev_choice!"=="2" (
        echo %COLOR_YELLOW%백엔드 개발 서버를 시작합니다...%COLOR_RESET%
        cd apps\api
        call npm run start:dev
    ) else if "!dev_choice!"=="3" (
        echo %COLOR_YELLOW%모바일과 백엔드를 시작합니다 (2개의 새 터미널에서)...%COLOR_RESET%

        echo %COLOR_YELLOW%새 터미널에서 백엔드를 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\api && npm run start:dev"

        timeout /t 2

        echo %COLOR_YELLOW%새 터미널에서 모바일을 시작하는 중...%COLOR_RESET%
        start cmd /k "cd apps\mobile && ng serve --open"

        echo %COLOR_GREEN%✓ 모든 서버가 시작되었습니다!%COLOR_RESET%
    ) else if "!dev_choice!"=="4" (
        echo %COLOR_YELLOW%개발 서버를 시작하지 않았습니다%COLOR_RESET%
        echo.
        echo %COLOR_BLUE%수동으로 시작하려면:%COLOR_RESET%
        echo   모바일: cd apps\mobile ^&^& ng serve
        echo   백엔드: cd apps\api ^&^& npm run start:dev
    ) else (
        echo %COLOR_RED%✗ 잘못된 선택입니다%COLOR_RESET%
        pause
        exit /b 1
    )
)

echo.

REM ============================================================================
REM 완료 메시지 (동적)
REM ============================================================================
echo %COLOR_GREEN%╔════════════════════════════════════════════════════════════╗%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%     ✓ 설정 완료!                                       %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%                                                        %COLOR_GREEN%║%COLOR_RESET%

REM 선택된 앱 타입에 따른 접속 주소 표시
if "!APP_TYPES!"=="web mobile" (
    echo %COLOR_GREEN%║%COLOR_RESET%  접속 주소 (웹 + 모바일):                            %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • 웹 App: http://localhost:4200                    %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • 모바일 App: http://localhost:4201                %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • API: http://localhost:3000                       %COLOR_GREEN%║%COLOR_RESET%
) else if "!APP_TYPES!"=="web" (
    echo %COLOR_GREEN%║%COLOR_RESET%  접속 주소 (웹 전용):                               %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • 웹 App: http://localhost:4200                    %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • API: http://localhost:3000                       %COLOR_GREEN%║%COLOR_RESET%
) else if "!APP_TYPES!"=="mobile" (
    echo %COLOR_GREEN%║%COLOR_RESET%  접속 주소 (모바일 전용):                           %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • 모바일 App: http://localhost:4200                %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • API: http://localhost:3000                       %COLOR_GREEN%║%COLOR_RESET%
)

echo %COLOR_GREEN%║%COLOR_RESET%  • DB Studio: http://localhost:5555                   %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  • Redis: localhost:6379                              %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  • PostgreSQL: localhost:5432                         %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%                                                        %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  다음 명령어가 유용합니다:                            %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  • make help          전체 명령어 확인                 %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  • make db-studio     데이터베이스 관리               %COLOR_GREEN%║%COLOR_RESET%

if "!APP_TYPES!"=="web mobile" (
    echo %COLOR_GREEN%║%COLOR_RESET%  • make test-web      웹 테스트                       %COLOR_GREEN%║%COLOR_RESET%
    echo %COLOR_GREEN%║%COLOR_RESET%  • make test-mobile   모바일 테스트                   %COLOR_GREEN%║%COLOR_RESET%
) else if "!APP_TYPES!"=="web" (
    echo %COLOR_GREEN%║%COLOR_RESET%  • make test-web      웹 테스트                       %COLOR_GREEN%║%COLOR_RESET%
) else if "!APP_TYPES!"=="mobile" (
    echo %COLOR_GREEN%║%COLOR_RESET%  • make test-mobile   모바일 테스트                   %COLOR_GREEN%║%COLOR_RESET%
)

echo %COLOR_GREEN%║%COLOR_RESET%  • make test-api      백엔드 테스트                   %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  • docker-compose ps  Docker 상태 확인               %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%                                                        %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%║%COLOR_RESET%  Happy Coding! 🚀                                     %COLOR_GREEN%║%COLOR_RESET%
echo %COLOR_GREEN%╚════════════════════════════════════════════════════════════╝%COLOR_RESET%
echo.

pause
