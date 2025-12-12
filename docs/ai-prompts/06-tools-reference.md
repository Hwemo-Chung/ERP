# Claude Code Tools Reference (도구 활용 가이드)

> Last Updated: 2025-12-12
> Project: Logistics ERP

---

## Overview

Claude Code에서 제공하는 **도구와 모드**를 ERP 프로젝트에 효과적으로 활용하는 방법입니다.

---

## 1. ULTRATHINK Mode

### 활성화
프롬프트에 `ULTRATHINK` 키워드 포함

### 사용 상황
- 복잡한 디버깅 (여러 파일 연관)
- 아키텍처 분석 및 설계
- 대규모 리팩토링 계획
- 성능 최적화 분석

### 예시
```
ULTRATHINK

apps/api/src/orders/orders.service.ts를 분석하고,
상태 전환 로직을 State Machine 패턴으로 분리하는 리팩토링 계획을 수립해주세요.

고려사항:
1. 기존 테스트 호환성
2. 점진적 마이그레이션 가능성
3. 트랜잭션 처리

Reference:
- Current: apps/api/src/orders/orders.service.ts
- State Machine: apps/api/src/orders/order-state-machine.ts
```

---

## 2. Plan Mode

### 활성화
- `Shift+Tab` 단축키
- `/superpowers:write-plan` 명령어

### 사용 상황
- 다중 파일 변경이 필요한 기능
- 새로운 모듈/기능 개발
- 큰 규모의 리팩토링

### 예시
```
/superpowers:write-plan

새로운 "Reports" 모듈을 개발합니다.

요구사항:
1. 일간/주간/월간 보고서 생성
2. PDF 내보내기
3. 권한: HQ_ADMIN, BRANCH_MANAGER만 접근

출력:
- apps/api/src/reports/ (NestJS 모듈)
- apps/mobile/src/app/features/reports/ (Angular 페이지)
- apps/mobile/src/app/store/reports/ (SignalStore)
```

---

## 3. Context7 (최신 문서 참조)

### 활성화
프롬프트에 `use context7` 포함

### 사용 상황
- Angular 19 공식 문서 확인
- NestJS 11 API 레퍼런스
- Prisma 6 쿼리 패턴
- Ionic 8 컴포넌트

### 예시
```
use context7

Angular 19의 새로운 Signal input() API를 사용하여
OrderCardComponent에 Order 데이터를 전달하는 방법을 알려주세요.

기존 코드:
@Input() order: Order;

Signal 방식으로 변환해주세요.
```

### 주요 라이브러리 ID
```
Angular: /angular/angular
NestJS: /nestjs/nest
Prisma: /prisma/prisma
Ionic: /ionic-team/ionic-framework
RxJS: /reactivex/rxjs
```

---

## 4. Explore Agent

### 활성화
Task 도구 + `subagent_type=Explore`

### 사용 상황
- 코드베이스 구조 파악
- 특정 패턴 검색
- 의존성 추적

### 내부 사용 (Claude가 자동 활용)
- 파일 검색, 패턴 찾기
- 관련 코드 탐색
- 아키텍처 이해

---

## 5. Serena Memory

### 사용 가능한 명령어
```bash
# 메모리 목록 확인
mcp__serena__list_memories

# 메모리 읽기
mcp__serena__read_memory(memory_file_name="...")

# 메모리 작성
mcp__serena__write_memory(memory_file_name="...", content="...")

# 메모리 삭제
mcp__serena__delete_memory(memory_file_name="...")
```

### 사용 상황
- 프로젝트 규칙/컨벤션 저장
- 중요한 학습 내용 기록
- 반복되는 참조 정보

### 예시
```
프로젝트의 State Machine 규칙을 Serena Memory에 저장해주세요.

내용:
- 허용된 상태 전환
- Guard 조건
- 에러 코드

파일명: order_state_machine_rules.md
```

---

## 6. Symbolic Tools (Serena)

### 주요 도구
```typescript
// 파일의 심볼 개요
mcp__serena__get_symbols_overview(relative_path: "...")

// 심볼 찾기
mcp__serena__find_symbol(name_path_pattern: "...")

// 참조 찾기
mcp__serena__find_referencing_symbols(name_path: "...", relative_path: "...")

// 심볼 교체
mcp__serena__replace_symbol_body(name_path: "...", relative_path: "...", body: "...")
```

### 사용 상황
- 특정 클래스/메서드 찾기
- 리팩토링 시 참조 추적
- 코드 구조 분석

---

## 7. Slash Commands

### 유용한 명령어
```bash
# 브레인스토밍
/superpowers:brainstorm

# 구현 계획 작성
/superpowers:write-plan

# 계획 실행
/superpowers:execute-plan

# Git Flow
/git-workflow:feature <feature-name>
/git-workflow:finish

# 코드 리뷰
/pr-review-toolkit:review-pr

# 커밋
/commit-commands:commit
```

---

## 8. Skills

### 관련 스킬
```
superpowers:brainstorming          # 아이디어 구체화
superpowers:systematic-debugging   # 체계적 디버깅
superpowers:test-driven-development # TDD
superpowers:verification-before-completion # 완료 전 검증
episodic-memory:remembering-conversations # 대화 기억
```

### 활성화
```
Skill tool 사용: Skill(skill: "superpowers:brainstorming")
```

---

## Best Practices

### 복잡한 작업 시
```
1. ULTRATHINK로 분석
2. /superpowers:write-plan으로 계획
3. Plan 승인 후 구현
4. /commit-commands:commit으로 커밋
```

### 문서 참조 시
```
1. use context7로 공식 문서 확인
2. 프로젝트 .doc/ 폴더 참조
3. .prompt-guides/ 템플릿 활용
```

### 디버깅 시
```
1. Skill(superpowers:systematic-debugging) 활성화
2. 02-debugging-templates.md 참조
3. Explore Agent로 관련 코드 탐색
```

---

## Quick Reference

| 상황 | 도구/모드 | 활성화 |
|------|----------|--------|
| 복잡한 분석 | ULTRATHINK | 키워드 포함 |
| 다중 파일 변경 | Plan Mode | Shift+Tab |
| 공식 문서 참조 | Context7 | `use context7` |
| 패턴 검색 | Explore Agent | 자동 |
| 규칙 저장 | Serena Memory | `write_memory` |
| 코드 구조 | Symbolic Tools | `find_symbol` |
| 브레인스토밍 | Skill | `/superpowers:brainstorm` |
