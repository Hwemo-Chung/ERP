# Claude Code CLI 완벽 가이드

> 최신 버전의 Claude Code 기능을 활용하기 위한 상세 설명서입니다. 실무 예시와 함께 각 기능의 실제 사용 방법을 담았습니다.

---

## 📑 목차

1. [Extended Thinking (확장 사고)](#1-extended-thinking)
2. [Subagent 시스템](#2-subagent-시스템)
3. [Headless 모드 (자동화)](#3-headless-모드)
4. [세션 관리](#4-세션-관리)
5. [MCP 설정](#5-mcp-설정)
6. [커스텀 슬래시 명령어](#6-커스텀-슬래시-명령어)
7. [Plan Mode](#7-plan-mode)
8. [실전 워크플로우](#8-실전-워크플로우)

---

## 1. Extended Thinking (확장 사고)

### 📌 개요

Extended Thinking은 Claude가 **깊은 추론 과정**을 거쳐 더 정확하고 복잡한 문제를 해결할 수 있도록 하는 기능입니다.

- 복잡한 아키텍처 설계
- 깊은 버그 분석
- 다단계 구현 계획
- 수학적/논리적 추론이 필요한 작업

### 🔧 MAX_THINKING_TOKENS 설정 방법

Extended Thinking이 사용할 추론 토큰의 양을 제어합니다.

#### **방법 1: 설정 파일에서 영구 설정**

```json
# ~/.claude/settings.json (사용자 전역 설정)
{
  "env": {
    "MAX_THINKING_TOKENS": "16000"
  }
}
```

```json
# /Users/solution/Documents/GitHub/imap-front/.claude/settings.json (프로젝트 설정)
{
  "env": {
    "MAX_THINKING_TOKENS": "24000"
  }
}
```

#### **방법 2: 환경변수로 세션 설정**

```bash
# 한 번의 세션에만 적용
export MAX_THINKING_TOKENS=16000
claude

# 또는 직접 지정
MAX_THINKING_TOKENS=16000 claude -p "복잡한 질문"
```

#### **권장값 가이드**

| 상황 | 권장값 | 설명 |
|------|--------|------|
| 기본 사용 | 1,024 | 최소 요구값 |
| 일반적인 복잡한 작업 | **16,000** | 대부분의 작업에 추천 |
| 매우 복잡한 설계 | 24,000 | 아키텍처 설계, 깊은 리팩토링 |
| 초대형 작업 | 32,000 이상 | 배치 처리 권장 (타임아웃 방지) |

### 🎮 Tab 키로 즉시 토글

대화 중에 즉시 Extended Thinking을 활성화/비활성화할 수 있습니다.

```bash
claude
> 첫 번째 질문

# Tab 키 누르기 → Extended Thinking 활성화 (사고 시간 표시)
# Tab 키 다시 누르기 → 비활성화
```

### 📝 실제 사용 예시

#### 예시 1: 복잡한 아키텍처 설계

```bash
export MAX_THINKING_TOKENS=24000
claude

> Think deeply about implementing OAuth2 authentication system.
> Consider:
> - Security implications
> - Token refresh mechanism
> - Multi-device support
> - GDPR compliance

# Claude는 깊은 추론을 통해 완벽한 설계 제안
```

#### 예시 2: 버그의 근본 원인 분석

```bash
MAX_THINKING_TOKENS=16000 claude -p "
This database connection pool keeps exhausting.
Help me understand why and provide a fix.

Context:
- Connection limit: 20
- Current connections: 25 (always at limit)
- App restart: Fixes temporarily
"
```

#### 예시 3: 다단계 리팩토링 계획

```bash
claude --permission-mode plan

> Think about refactoring the entire payment processing system.
>
> Current issues:
> - Monolithic design
> - No error recovery
> - Database transaction handling inconsistent
>
> Requirements:
> - Maintain backward compatibility
> - Add comprehensive logging
> - Improve test coverage
> - Zero downtime migration
```

---

## 2. Subagent 시스템

### 📌 개요

**Subagent**는 특정 작업에 특화된 AI 어시스턴트입니다. 각 서브에이전트는:

- 독립적인 컨텍스트 윈도우 사용 → **메인 대화의 토큰 절약**
- 제한된 도구 접근 → **보안 강화**
- 특화된 역할 → **효율성 증대**

### 🎯 주요 Subagent 타입

#### **Plan Subagent** (계획 전문가)
- 목적: 코드베이스 분석 및 계획 수립
- 사용 시기: 복잡한 구현 전 분석이 필요할 때
- 특징: 읽기 전용 도구만 접근

```bash
claude --permission-mode plan
> Analyze the authentication system and create a refactoring plan

# Plan Subagent가 자동으로 활성화되어 코드 분석
```

#### **Explore Subagent** (탐색 전문가)
- 목적: 빠른 코드 탐색 및 검색
- 사용 시기: 특정 기능이나 파일을 찾아야 할 때
- 특징: Haiku 모델 사용 (빠르고 저비용)

```bash
> use the explore subagent to find all authentication-related files
# 빠르게 auth 관련 파일 매핑
```

#### **Code Reviewer Subagent** (코드 리뷰 전문가)
- 목적: 코드 품질, 보안, 성능 검토
- 사용 시기: PR 검토나 코드 변경 후
- 특징: 보안 취약점, 성능 이슈 전문

```bash
claude > /review-pr 456
# 또는
> review my recent changes for security issues
# Code Reviewer Subagent 자동 활성화
```

#### **Debugger Subagent** (디버거)
- 목적: 버그 분석 및 근본 원인 파악
- 사용 시기: 테스트 실패나 예기치 않은 오류 발생 시
- 특징: 체계적인 디버깅 프로세스

```bash
> debug this test failure and fix it
# Debugger Subagent가 자동으로 활성화
```

### 📋 Subagent 생성 및 관리

#### **Option 1: CLI 명령어로 추가**

```bash
# 목록 보기
claude
> /agents

# 또는 한 줄 명령
claude mcp add --transport stdio code-reviewer \
  -- npx -y @anthropic-tools/code-reviewer
```

#### **Option 2: 파일로 직접 생성**

```bash
# 프로젝트 레벨 subagent 디렉토리 생성
mkdir -p /Users/solution/Documents/GitHub/imap-front/.claude/agents

# test-runner.md 생성
cat > /Users/solution/Documents/GitHub/imap-front/.claude/agents/test-runner.md << 'EOF'
---
name: test-runner
description: Test automation specialist. Run and fix failing tests.
tools: Read, Edit, Bash(npm:*), Bash(npm test:*)
model: sonnet
---

You are a test automation expert specializing in:
1. Running test suites
2. Analyzing test failures
3. Fixing broken tests
4. Improving test coverage

When invoked:
- Run appropriate test commands
- Identify root causes of failures
- Apply minimal fixes
- Verify all tests pass
EOF
```

#### **Option 3: 개인용 Subagent 생성**

```bash
mkdir -p ~/.claude/agents

cat > ~/.claude/agents/performance-optimizer.md << 'EOF'
---
name: performance-optimizer
description: Performance analysis expert
tools: Read, Bash, Grep, Glob
model: sonnet
---

Analyze code for:
- N+1 database queries
- Unnecessary re-renders
- Memory leaks
- Inefficient algorithms

Provide specific optimizations with metrics.
EOF
```

### 🚀 Subagent 사용 예시

```bash
# 자동 위임 (Claude가 적절한 Subagent 선택)
> fix these failing tests
# → test-runner subagent 자동 선택

> review this code for security vulnerabilities
# → code-reviewer subagent 자동 선택

# 명시적 호출
> use the performance-optimizer subagent to analyze this function

# 순차 호출
> first use the code-explorer to find all API endpoints,
> then use the code-reviewer to check them for security issues
```

---

## 3. Headless 모드 (자동화)

### 📌 개요

Headless 모드는 **비상호형 자동화** 작업을 위한 모드입니다. 스크립트나 CI/CD 파이프라인에 Claude를 통합할 수 있습니다.

### 🔧 기본 사용법

#### **간단한 쿼리**

```bash
# 텍스트 출력
claude -p "Analyze this code for bugs"

# 파이프 입력
cat src/auth.ts | claude -p "Check for security vulnerabilities"

# 입력 파일
claude -p "Generate documentation" < README.md
```

#### **JSON 출력 (프로그래매틱 처리)**

```bash
# JSON 형식으로 결과 반환
result=$(claude -p "List all security issues" --output-format json)

# jq로 파싱
echo "$result" | jq '.result' > security-report.txt
echo "$result" | jq '.total_cost_usd'  # 비용 확인
echo "$result" | jq '.session_id'      # 세션 ID
```

#### **출력 형식 비교**

```bash
# 1. 텍스트 (기본)
claude -p "query"
# Output: 일반 텍스트 응답

# 2. JSON (프로그래매틱)
claude -p "query" --output-format json
# Output: { "type": "result", "result": "...", "session_id": "...", ... }

# 3. 스트리밍 JSON (실시간)
claude -p "query" --output-format stream-json
# Output: 실시간 스트림 처리 가능
```

### 📝 실무 예시

#### 예시 1: 자동 코드 리뷰 스크립트

```bash
#!/bin/bash
# scripts/auto-review.sh

set -e

PROJECT_PATH="/Users/solution/Documents/GitHub/imap-front"
cd "$PROJECT_PATH"

echo "🔍 Analyzing code changes..."

# 최근 변경사항 분석
result=$(git diff HEAD~1 | \
  claude -p "Review this code for:
    - Security vulnerabilities
    - Performance issues
    - Code style violations
    - Missing tests" \
  --output-format json)

# 결과 저장
echo "$result" | jq '.result' > review.md

# 비용 출력
cost=$(echo "$result" | jq '.total_cost_usd')
echo "✅ Review complete. Cost: \$${cost}"

# 문제 있으면 종료
if echo "$result" | jq -e '.result | contains("Critical")' > /dev/null; then
  echo "⚠️  Critical issues found!"
  exit 1
fi
```

#### 예시 2: CI/CD 파이프라인 통합 (GitHub Actions)

```yaml
# .github/workflows/claude-review.yml
name: Claude Code Review

on:
  pull_request:
    branches: [develop, main]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # 변경사항 분석
          git diff origin/main > changes.diff

          result=$(cat changes.diff | \
            claude -p "Security and code quality review" \
            --output-format json)

          review=$(echo "$result" | jq -r '.result')

          # PR에 코멘트
          gh pr comment ${{ github.event.pull_request.number }} \
            --body "## 🤖 Claude Code Review\n\n$review"
```

#### 예시 3: 배치 분석 스크립트

```bash
#!/bin/bash
# scripts/batch-analysis.sh

PROJECT="/Users/solution/Documents/GitHub/imap-front"
OUTPUT_DIR="/tmp/claude-analysis"
mkdir -p "$OUTPUT_DIR"

cd "$PROJECT"

echo "📊 Starting batch analysis..."

# 각 주요 디렉토리 분석
for dir in src tests utils; do
  echo "Analyzing $dir..."

  result=$(find "$dir" -type f -name "*.ts" -o -name "*.tsx" | \
    head -5 | \
    xargs cat | \
    claude -p "Identify potential improvements in:
      - Code clarity
      - Performance
      - Testing
      - Type safety" \
    --output-format json)

  echo "$result" | jq '.result' > "$OUTPUT_DIR/${dir}_analysis.md"
done

echo "✅ Analysis complete. Results in $OUTPUT_DIR"
```

#### 예시 4: 실시간 스트림 처리

```bash
#!/bin/bash
# scripts/stream-processing.sh

echo "🔄 Streaming analysis..."

claude -p "Generate a comprehensive test suite" \
  --output-format stream-json | \
  while IFS= read -r line; do
    # 각 스트림 청크 처리
    event_type=$(echo "$line" | jq -r '.type // empty')

    case "$event_type" in
      "thinking")
        echo "🧠 Thinking: $(echo "$line" | jq -r '.content' | head -c 50)..."
        ;;
      "text")
        echo "📝 Text: $(echo "$line" | jq -r '.content')"
        ;;
      "result")
        echo "✅ Complete"
        ;;
    esac
  done
```

---

## 4. 세션 관리

### 📌 개요

대화를 일시 중지했다가 나중에 계속할 수 있습니다. 복잡한 작업을 여러 단계로 나누어 진행 가능합니다.

### 🔍 세션 ID 확인

```bash
# 현재 세션 정보 확인
> /status

# Headless 모드에서 추출
session_id=$(claude -p "query" --output-format json | jq -r '.session_id')
echo "Session: $session_id"
```

### 📋 세션 관리 방법

#### **최근 세션 계속하기**

```bash
# 가장 최근 대화 자동 재개
claude --continue

# 메시지와 함께 재개 (-c는 --continue의 단축형)
claude -c "Show me the test results again"

# Headless 모드에서
claude --continue -p "Fix all the linting issues" --output-format json
```

#### **특정 세션 선택**

```bash
# 대화 메뉴 표시 (대화식)
claude --resume

# 특정 세션 ID로 재개 (-r는 --resume의 단축형)
claude -r "550e8400-e29b-41d4-a716-446655440000" "Continue with step 2"
```

#### **세션 포크하기 (분기)**

```bash
# 기존 세션 기반으로 새 독립 세션 생성
claude --resume "abc123" --fork-session "Try different approach"

# 장점:
# - 원본 세션 유지
# - 새로운 시도 가능
# - 나중에 비교 검토
```

### 💼 실무 사용 사례

#### 법률 문서 검토 (멀티스텝)

```bash
#!/bin/bash
# scripts/legal-review.sh

# Step 1: 세션 시작
session=$(claude -p "Start contract review session" \
  --output-format json | jq -r '.session_id')

echo "Started session: $session"

# Step 2: 책임 조항 검토
echo "Reviewing liability clauses..."
claude -r "$session" -p "Check for liability limitations and exclusions" \
  --output-format json > review1.json

# Step 3: 데이터 보호 확인
echo "Reviewing GDPR compliance..."
claude -r "$session" -p "Analyze GDPR and data protection clauses" \
  --output-format json > review2.json

# Step 4: 위험 요약
echo "Generating summary..."
claude -r "$session" -p "Create executive summary of key risks" \
  --output-format json > summary.json

# 결과 정리
echo "=== Contract Review Complete ==="
echo "Reports:"
ls -lh review*.json summary.json
```

---

## 5. MCP 설정

### 📌 개요

**MCP (Model Context Protocol)**은 Claude를 외부 서비스나 도구와 연결합니다.

- GitHub API 접근
- 데이터베이스 쿼리
- 외부 API 통합
- 파일시스템 접근 제어

### 📂 설정 파일 위치

```
프로젝트 레벨:     .mcp.json
사용자 레벨:       ~/.claude.json (mcpServers 섹션)
관리자 수준:       /Library/Application Support/ClaudeCode/managed-mcp.json
```

### 🔧 설정 파일 구조

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio|http|sse",
      "command": "/path/to/executable",
      "args": ["--arg1", "value"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### 📝 실제 설정 예시

#### 설정 예시 1: HTTP 기반 MCP (GitHub)

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}",
        "X-API-Key": "${GITHUB_API_KEY}"
      }
    }
  }
}
```

#### 설정 예시 2: Stdio 기반 MCP (로컬)

```json
{
  "mcpServers": {
    "local-database": {
      "type": "stdio",
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "config.json"],
      "env": {
        "DB_URL": "${DATABASE_URL:-postgresql://localhost/dev}",
        "DB_PASSWORD": "${DB_PASSWORD}"
      }
    }
  }
}
```

#### 설정 예시 3: 통합 설정

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    },
    "database": {
      "type": "stdio",
      "command": "npx",
      "args": ["@anthropic/db-mcp"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["@anthropic/filesystem-mcp", "/Users/solution/Documents"],
      "env": {}
    }
  }
}
```

### 💻 CLI로 MCP 관리

```bash
# MCP 서버 추가
claude mcp add --transport http github \
  "https://api.github.com/mcp"

# 환경변수와 함께 추가
claude mcp add --transport stdio database \
  --env DATABASE_URL=postgresql://localhost/dev \
  -- npx @anthropic/db-mcp

# 목록 보기
claude mcp list

# 특정 서버 정보
claude mcp get github

# 제거
claude mcp remove github
```

### 🚀 MCP 사용

```bash
# CLI에서 직접 사용
claude -p "Get all open GitHub issues in my repos" \
  --mcp-config config.json

# Headless 모드
result=$(claude -p "Query all users from the database" \
  --mcp-config .mcp.json \
  --output-format json)
```

---

## 6. 커스텀 슬래시 명령어

### 📌 개요

프로젝트나 개인 수준에서 **자주 사용하는 작업**을 자동화할 수 있습니다.

```bash
/test              # 테스트 실행
/review            # 코드 리뷰
/fix-bug 123       # Issue 수정
/docs              # 문서 생성
```

### 📂 파일 위치

```
프로젝트 명령어:     .claude/commands/
사용자 명령어:       ~/.claude/commands/
```

### 📝 명령어 작성 방법

#### **기본 형식**

```markdown
---
description: 명령어 설명
allowed-tools: Bash(npm:*), Read, Edit
model: claude-sonnet-4-5-20250929
argument-hint: [param1] [param2]
---

명령어의 실제 프롬프트 내용입니다.
$ARGUMENTS 또는 $1, $2 등으로 인자 받기 가능
```

#### **예시 1: 테스트 실행 명령어**

```bash
# .claude/commands/test.md
cat > /Users/solution/Documents/GitHub/imap-front/.claude/commands/test.md << 'EOF'
---
description: Run all tests and report results
allowed-tools: Bash(npm:*), Bash(npm test:*)
---

Execute complete test suite:

1. Run: npm test
2. Analyze any failures
3. Report coverage metrics
4. Suggest improvements if tests fail
EOF
```

#### **예시 2: 보안 감사 명령어**

```bash
# .claude/commands/security-audit.md
cat > /Users/solution/Documents/GitHub/imap-front/.claude/commands/security-audit.md << 'EOF'
---
description: Security audit of codebase
allowed-tools: Read, Grep, Bash(npm audit:*)
---

Perform comprehensive security audit:

1. **Dependencies**: npm audit
2. **Hardcoded secrets**: Look for API keys, passwords
3. **SQL Injection**: Check database queries
4. **XSS Vulnerabilities**: Review user input handling
5. **Authentication**: Verify security implementation
6. **CORS/Headers**: Check security headers

Provide detailed report with severity levels.
EOF
```

#### **예시 3: 인자를 받는 명령어**

```bash
# .claude/commands/fix-issue.md
cat > /Users/solution/Documents/GitHub/imap-front/.claude/commands/fix-issue.md << 'EOF'
---
description: Fix an issue by number
argument-hint: [issue-number]
allowed-tools: Read, Edit, Bash(git:*)
---

Fix issue #$1:

1. Find the issue description
2. Locate related code
3. Implement the fix
4. Add tests
5. Create commit message
EOF

# 사용: /fix-issue 123
```

#### **예시 4: 문서 생성 명령어**

```bash
# ~/.claude/commands/generate-docs.md
cat > ~/.claude/commands/generate-docs.md << 'EOF'
---
description: Generate project documentation
allowed-tools: Read, Write, Grep
---

Generate comprehensive documentation:

- API endpoints (OpenAPI format)
- Database schema (ER diagram)
- Architecture decision records
- Setup and deployment guide
- Contributing guidelines

Output as markdown in /docs directory.
EOF

# 사용: /generate-docs
```

### 🚀 명령어 사용

```bash
# 프롬프트에서 직접 사용
> /test                           # 모든 테스트 실행
> /security-audit                 # 보안 감사
> /fix-issue 456                  # Issue #456 수정
> /generate-docs                  # 문서 생성

# CLI에서 사용
claude "/test"
claude "/security-audit"
claude "/fix-issue 789"
```

---

## 7. Plan Mode

### 📌 개요

**Plan Mode**는 **읽기 전용 안전 모드**입니다. 코드 분석 후 구현 계획을 세울 때 사용합니다.

- 파일 변경 불가 (조회만 가능)
- 도구 실행 제한
- 계획 수립에 집중

### 🔄 권한 모드의 세 가지 상태

```
Plan Mode (⏸)
  ↓ Shift+Tab
Normal Mode (✎)
  ↓ Shift+Tab
Auto-Accept Mode (⏵⏵)
  ↓ Shift+Tab
Plan Mode (⏸) ...
```

| 모드 | 기호 | 설명 | 사용 시기 |
|------|------|------|---------|
| Plan | ⏸ | 읽기 전용, 변경 불가 | 분석 및 계획 수립 |
| Normal | ✎ | 변경마다 확인 필요 | 신중한 변경 |
| Auto-Accept | ⏵⏵ | 변경 자동 승인 | 빠른 구현 |

### 🚀 Plan Mode 진입

#### **방법 1: 대화 중 전환**

```bash
claude

# Shift+Tab을 눌러 권한 모드 순환
# 반복 클릭으로 Plan Mode (⏸)로 이동
```

#### **방법 2: CLI 플래그로 시작**

```bash
# Plan Mode로 시작
claude --permission-mode plan

# Headless 모드
claude --permission-mode plan -p "Analyze system architecture" --output-format json
```

### 🎯 Plan Mode 사용 예시

#### 예시 1: 아키텍처 분석

```bash
claude --permission-mode plan

> Analyze the current authentication system.
> Consider:
> - Security vulnerabilities
> - Performance bottlenecks
> - Scalability issues
> - Required refactoring

# Claude가 읽기 전용으로 코드 분석
# 상세한 계획 제시
# Shift+Tab으로 구현 모드로 전환 후 실행
```

#### 예시 2: 리팩토링 계획

```bash
export MAX_THINKING_TOKENS=24000
claude --permission-mode plan

> Create a comprehensive refactoring plan for the database layer.
>
> Current state:
> - Monolithic data access layer
> - No query optimization
> - N+1 query problems
>
> Goals:
> - Separate concerns (repository pattern)
> - Add query optimization
> - Implement caching
> - Zero downtime migration

# 깊은 분석으로 상세 계획 수립
```

### ⚙️ 설정 파일에서 기본값 설정

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

설정 후에는 `claude` 명령이 항상 Plan Mode로 시작됩니다.

---

## 8. 실전 워크플로우

### 📊 완벽한 개발 워크플로우

```bash
#!/bin/bash
# scripts/complete-workflow.sh

set -e

PROJECT="/Users/solution/Documents/GitHub/imap-front"
cd "$PROJECT"

echo "🚀 Complete Development Workflow"
echo "================================"

# PHASE 1: 분석 (Plan Mode)
echo -e "\n📊 PHASE 1: Code Analysis (Plan Mode)"
echo "--------------------------------------"
claude --permission-mode plan -p \
  "Analyze the project architecture and suggest improvements" \
  --output-format json > analysis.json

ANALYSIS=$(jq -r '.result' analysis.json)
echo "$ANALYSIS" | head -20
echo "..."

# PHASE 2: 테스트 (자동화)
echo -e "\n🧪 PHASE 2: Test Execution"
echo "--------------------------------------"
test_result=$(claude -p "Run all tests and report results" \
  --allowedTools "Bash(npm:*)" \
  --output-format json)

TEST_PASS=$(echo "$test_result" | jq -r '.result' | grep -q "PASS" && echo "✅" || echo "❌")
echo "$TEST_PASS Tests: $(echo "$test_result" | jq -r '.result' | head -5)"

# PHASE 3: 코드 리뷰 (Subagent)
echo -e "\n👁️ PHASE 3: Code Review"
echo "--------------------------------------"
review=$(claude -p "Review recent changes for security issues" \
  --permission-mode acceptEdits \
  --output-format json)

SESSION=$(echo "$review" | jq -r '.session_id')
echo "Session: $SESSION"
echo "$(echo "$review" | jq -r '.result' | head -10)"

# PHASE 4: 문제 수정 (세션 계속)
echo -e "\n🔧 PHASE 4: Fix Issues"
echo "--------------------------------------"
fix=$(claude -r "$SESSION" -p "Fix the critical issues identified in the review" \
  --permission-mode acceptEdits \
  --output-format json)

echo "$(echo "$fix" | jq -r '.result' | head -10)"

# PHASE 5: 최종 검증
echo -e "\n✅ PHASE 5: Final Verification"
echo "--------------------------------------"
final=$(claude -c -p "Verify all tests pass and no new issues were introduced" \
  --output-format json)

echo "$(echo "$final" | jq -r '.result')"

echo -e "\n🎉 Workflow Complete!"
echo "Total Cost: \$$(echo "$analysis" | jq '.total_cost_usd')"
```

### 🔄 협업 리뷰 워크플로우

```bash
#!/bin/bash
# scripts/collaboration-review.sh

# 팀원의 코드를 검토하고 피드백 제공

PROJECT="/Users/solution/Documents/GitHub/imap-front"
BRANCH=$1  # 검토할 브랜치

cd "$PROJECT"
git fetch origin
git checkout "$BRANCH"

# Step 1: 아키텍처 검토 (Plan Mode)
echo "1️⃣ Architecture Review"
claude --permission-mode plan -p \
  "Review the architecture changes in this PR.
   Consider design patterns, scalability, maintainability." \
  --output-format json | jq '.result' > arch_review.md

# Step 2: 보안 감사
echo "2️⃣ Security Audit"
claude -p "Security audit of changes.
  Check: SQL injection, XSS, authentication, authorization." \
  --output-format json | jq '.result' > security_review.md

# Step 3: 성능 분석
echo "3️⃣ Performance Analysis"
claude -p "Performance impact analysis.
  Identify: N+1 queries, memory leaks, inefficient algorithms." \
  --output-format json | jq '.result' > perf_review.md

# Step 4: 테스트 커버리지
echo "4️⃣ Test Coverage"
claude -p "Analyze test coverage and suggest improvements." \
  --output-format json | jq '.result' > test_review.md

# 모든 리뷰 결과 정리
cat > PR_REVIEW_SUMMARY.md << 'EOF'
# Code Review Summary

## Architecture Review
$(cat arch_review.md)

## Security Audit
$(cat security_review.md)

## Performance Analysis
$(cat perf_review.md)

## Test Coverage
$(cat test_review.md)
EOF

echo "✅ Review complete. See PR_REVIEW_SUMMARY.md"
```

---

## 🎓 핵심 요점 정리

| 기능 | 사용 목적 | 주요 명령 |
|------|---------|---------|
| **Extended Thinking** | 깊은 추론, 복잡한 설계 | `MAX_THINKING_TOKENS=16000 claude` |
| **Subagent** | 특화된 작업 자동화 | `/agents`, 자동 위임 |
| **Headless 모드** | CI/CD 자동화 | `claude -p "query" --output-format json` |
| **세션 관리** | 대화 계속 | `claude --continue`, `claude -r ID` |
| **MCP** | 외부 도구 연동 | `claude mcp add`, `.mcp.json` |
| **슬래시 명령어** | 반복 작업 자동화 | `.claude/commands/*.md` |
| **Plan Mode** | 안전한 분석 | `--permission-mode plan` |

---

## 💡 효율성 팁

1. **프로젝트 설정으로 기본값 설정**: `.claude/settings.json`
2. **자주 쓰는 작업을 슬래시 명령어화**: 시간 절약
3. **복잡한 작업은 Extended Thinking 사용**: 품질 향상
4. **Subagent로 자동 위임**: 메인 대화 토큰 절약
5. **Plan Mode에서 시작**: 안전하게 분석 후 구현
6. **세션 관리로 복잡한 작업 단계화**: 체계적 진행
7. **Headless 모드로 자동화**: 반복 작업 제거

---

**마지막 업데이트**: 2025년 12월 12일
**대상 버전**: Claude Code CLI v1.0+
