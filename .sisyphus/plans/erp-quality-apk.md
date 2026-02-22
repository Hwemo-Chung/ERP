# ERP 코드 품질 개선 + Android APK 빌드 (v2 — REWRITE)

## TL;DR

> **Quick Summary**: 프로덕션 코드의 `any` 타입 12건 제거 + CI/CD 파이프라인 추가 + Android APK 빌드 (Capacitor 6, 내부 배포용) + 보안 기본 설정 (secure storage, ProGuard, 앱 버전 관리). Git worktree로 `fix/code-quality`와 `feat/android-apk` 두 브랜치에서 병렬 작업 후 main에 병합.
>
> **Deliverables**:
>
> - 프로덕션 코드 `any` 타입 0건 (12건 → 0건, 8개 파일)
> - `.github/workflows/ci.yml` CI/CD 파이프라인
> - Android 프로젝트 초기화 (`npx cap add android`)
> - `environment.android.ts` (절대 API URL)
> - angular.json에 android 빌드 configuration
> - Signing keystore 생성 + Gradle signing 설정
> - ProGuard/R8 기본 설정
> - App versioning (versionCode/versionName)
> - Release APK 파일 (서명된 빌드)
> - Git worktree 기반 병렬 작업 완료
>
> **Estimated Effort**: Medium-High
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: T1 → {T2,T3} → T4 → T5 → T6 → T7 → T8 → T9 → Final

## Revision History

| Version | Date       | Changes                                                                                                                                                                                                                  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1      | 2026-02-21 | Initial plan                                                                                                                                                                                                             |
| v2      | 2026-02-22 | REWRITE — Momus REJECT (3/10, 17 issues) + Oracle security (10 gaps) + Sisyphus verification (1 additional). Fixed: DoD grep, T4-T10 details, build commands, worktree conflicts, FCM blocker, file paths, security gaps |

---

## Context

### Original Request

"현재 프로젝트 파악하고, 개선가능한 부분 확인해서 처리하고, 실제 배포를 위해 apk 파일도 작성. 병렬로 처리하고 git worktree 사용."

### Interview Summary

**Key Discussions**:

- APK 배포 방식: **내부 배포 (APK 직접)** — Play Store 아님
- API 서버: **아직 없음** → placeholder URL (`https://erp-logistics-api.onrender.com/api/v1`) 사용
- 개선 범위: **코드 품질 + APK** (전체 리팩토링 제외)
- Git Worktree: **기능별 브랜치 분리** (`feat/android-apk`, `fix/code-quality`)

**Research Findings**:

- 프로젝트 feature-complete (23/23 요구사항, 264 API 테스트 통과)
- `android/`는 `.gitignore`에 포함됨 → `npx cap add android`으로 생성 후 .gitignore에서 제거 필요
- `@capacitor/android@6.2.1` 이미 설치됨
- `@capacitor/push-notifications@6.0.3` 설치됨 + `capacitor.config.json`에 PushNotifications 설정 있음 → google-services.json 없이 빌드 시 Gradle 실패
- JDK 21 필요 (현재 JDK 8 Zulu만 설치), ANDROID_HOME 미설정, build-tools 28.0.3만 존재
- 프로덕션 any: 정확히 12건 in 8 파일 (apps/web 6파일, apps/mobile 1파일, packages/shared 1파일)

### Cross-Verification Results (v2 basis)

**Momus (카파시 리뷰)**: REJECT 3/10 — 17 issues (5 critical, 5 high, 4 medium, 3 low)
**Oracle (카멕 보안 리뷰)**: 10 security gaps (3 critical, 2 high, 5 medium)
**Sisyphus 직접 검증**: 1 additional (eslint-disable-next-line 주석 제거 누락)

---

## Work Objectives

### Core Objective

프로덕션 코드 품질 향상(any 타입 제거 + CI/CD) 및 Android APK 빌드 파이프라인 구축(보안 기본 설정 포함)을 git worktree 기반 병렬 작업으로 완료한다.

### Concrete Deliverables

- `apps/web/` 6개 파일 + `apps/mobile/` 1개 파일 + `packages/shared/` 1개 파일에서 any 타입 제거
- `.github/workflows/ci.yml` 생성
- `apps/mobile/src/environments/environment.android.ts` 생성
- `apps/mobile/angular.json`에 `android` configuration 추가
- `apps/mobile/android/` 디렉토리 생성 (Capacitor)
- google-services.json placeholder 또는 FCM 비활성화 처리
- release keystore + Gradle signing config
- ProGuard/R8 기본 설정 (`minifyEnabled true`)
- App versioning 설정 (versionCode=1, versionName=1.0.0)
- `apps/mobile/android/app/build/outputs/apk/release/*.apk` 생성

### Definition of Done

- [x] `grep -rn --include="*.ts" -E "(:\s*any\b|<any\b|any\[\])" apps/web/src apps/mobile/src packages/shared/src | grep -v "\.spec\.ts" | grep -v "\.test\.ts" | wc -l` → 0 matches
- [x] `cat .github/workflows/ci.yml` → valid YAML with lint/test/build jobs
- [x] `ls apps/mobile/android/app/build/outputs/apk/release/` → APK 파일 존재
- [x] APK 서명 검증: `$ANDROID_HOME/build-tools/*/apksigner verify` 통과
- [x] `ls apps/mobile/android/app/build/outputs/apk/release/*.apk` 파일 크기 < 50MB

### Must Have

- 프로덕션 코드 any 타입 전부 제거 (12건)
- eslint-disable-next-line 관련 주석도 함께 제거 (any 관련된 것만)
- CI/CD 파이프라인 (GitHub Actions)
- 서명된 release APK
- environment.android.ts (절대 API URL)
- ProGuard/R8 기본 활성화
- App versioning (versionCode/versionName 설정)
- Git worktree 사용 (feat/android-apk, fix/code-quality)

### Must NOT Have (Guardrails)

- ❌ Play Store 배포 설정 (AAB, listing, Fastlane, CD)
- ❌ Firebase/FCM 설정 (google-services.json 생성) — placeholder만
- ❌ Build flavors (debug/staging/release 분리)
- ❌ Test 파일의 any 수정 (별도 작업)
- ❌ CommonModule 분리, Dexie lazy import (별도 작업)
- ❌ VAPID key 생성/설정
- ❌ keystore/signing passwords를 git에 커밋
- ❌ pnpm-lock.yaml 수정
- ❌ Sentry 통합 (별도 작업 — .env.example에 SENTRY_DSN은 이미 존재)
- ❌ Certificate pinning (별도 작업)
- ❌ 앱 업데이트 메커니즘 (별도 작업)

### Deferred to Follow-up (Oracle 보안 권고)

이 항목들은 scope out이지만 **첫 번째 실제 사용자에게 배포 전** 반드시 처리:

1. **JWT Secure Storage** — `@capgo/capacitor-secure-storage` 통합 (~2h)
2. **Certificate Pinning** — network_security_config.xml (~4h)
3. **Sentry Integration** — `@sentry/capacitor` (~2h)
4. **앱 업데이트 메커니즘** — API version check endpoint (~4h)
5. **Key Rotation 문서화** — apksigner v3 signing scheme

---

## Verified Environment

| Item                 | Current       | Required                  | Action                                  |
| -------------------- | ------------- | ------------------------- | --------------------------------------- |
| JDK                  | 8 (Zulu)      | 21                        | `brew install --cask zulu@21`           |
| ANDROID_HOME         | (unset)       | ~/Library/Android/sdk     | export in shell                         |
| build-tools          | 28.0.3        | 34.0.0+                   | `sdkmanager "build-tools;34.0.0"`       |
| platforms            | android-27~35 | android-34                | 이미 존재 확인 필요                     |
| google-services.json | 없음          | 필요 (push-notifications) | placeholder 생성 또는 플러그인 비활성화 |

## Verified Commands

| Intent                | ❌ Wrong (v1)                                        | ✅ Correct (v2)                                                                           |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| API 테스트            | `pnpm api:test`                                      | `pnpm --filter erp-logistics-api test`                                                    |
| Mobile 빌드 (android) | `pnpm --filter mobile build --configuration=android` | `pnpm --filter mobile run build -- --configuration=android`                               |
| Lint                  | `pnpm lint`                                          | `pnpm lint` (root에 존재 ✅)                                                              |
| 전체 빌드             | `pnpm build`                                         | `pnpm api:build && pnpm web:build && pnpm mobile:build` (개별 실행)                       |
| Any 타입 grep         | `grep -r "as any"`                                   | `grep -rn --include="*.ts" -E "(:\s*any\b\|<any\b\|any\[\])" ... \| grep -v "\.spec\.ts"` |
| apksigner 경로        | `$ANDROID_HOME/build-tools/35.0.0/apksigner`         | `$ANDROID_HOME/build-tools/*/apksigner` (동적) 또는 설치된 버전 확인 후 사용              |

---

## Execution Strategy

### Wave Overview

```
Wave 1 (Start — 인프라 설정):
└── T1: Git worktree 초기화 + JDK 21 설치 + ANDROID_HOME 설정 [quick]

Wave 2 (After T1 — 코드 품질, 2 PARALLEL in code-quality worktree):
├── T2: Production any 타입 제거 (12건) — ../ERP-code-quality [deep]
└── T3: CI/CD 파이프라인 생성 — ../ERP-code-quality [quick]

Wave 3 (After T2+T3 — 병합1 + APK 파이프라인, SEQUENTIAL in android-apk worktree):
├── T4: fix/code-quality → main 병합 [quick]
├── T5: environment.android.ts + angular.json android config — ../ERP-android-apk [quick]
├── T6: Capacitor Android 프로젝트 초기화 + FCM 처리 — ../ERP-android-apk [unspecified-high]
├── T7: Keystore 생성 + Gradle signing + ProGuard + versioning — ../ERP-android-apk [quick]
└── T8: Release APK 빌드 + 검증 — ../ERP-android-apk [unspecified-high]

Wave 4 (After T8 — 최종 병합):
└── T9: feat/android-apk → main 병합 + worktree 정리 [quick]

Wave FINAL (After ALL — 독립 검증):
├── F1: Plan compliance audit
├── F2: Code quality review
└── F3: Scope fidelity check

Critical Path: T1 → T2 → T4 → T5 → T6 → T7 → T8 → T9 → F1-F3
```

### Why T5-T8 are SEQUENTIAL (not parallel like v1)

v1에서 T5와 T7이 같은 worktree에서 병렬 실행으로 계획됨 → **파일 충돌** (Momus #5).
v2에서는 T5→T6→T7→T8 순서로 **직렬 실행**. 각 태스크가 이전 태스크의 결과에 의존.

### Dependency Matrix

| Task | Depends On | Blocks         | Worktree            |
| ---- | ---------- | -------------- | ------------------- |
| T1   | —          | T2, T3, T5, T6 | main                |
| T2   | T1         | T4             | ../ERP-code-quality |
| T3   | T1         | T4             | ../ERP-code-quality |
| T4   | T2, T3     | T5             | main                |
| T5   | T4         | T6             | ../ERP-android-apk  |
| T6   | T1, T5     | T7, T8         | ../ERP-android-apk  |
| T7   | T6         | T8             | ../ERP-android-apk  |
| T8   | T7         | T9             | ../ERP-android-apk  |
| T9   | T8         | F1-F3          | main                |

---

## TODOs

- [x] 1. Git Worktree 초기화 + 환경 설정

  **What to do**:
  - JDK 21 설치 (`brew install --cask zulu@21`) — 이미 설치되어 있으면 skip
  - `JAVA_HOME`을 JDK 21로 설정 (`export JAVA_HOME=$(/usr/libexec/java_home -v 21)`)
  - `ANDROID_HOME` 설정 (`export ANDROID_HOME=~/Library/Android/sdk`)
  - `PATH`에 `$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin` 추가
  - build-tools 34.0.0 설치: `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "build-tools;34.0.0"` (cmdline-tools 없으면 설치)
  - `fix/code-quality` 브랜치 생성 (main에서 분기)
  - `feat/android-apk` 브랜치 생성 (main에서 분기)
  - `../ERP-code-quality` 경로에 `fix/code-quality` worktree 추가
  - `../ERP-android-apk` 경로에 `feat/android-apk` worktree 추가
  - 각 worktree에서 `pnpm install --frozen-lockfile` 실행
  - 환경 검증: `java -version` → 21.x, `echo $ANDROID_HOME` → 설정됨

  **Must NOT do**:
  - `pnpm-lock.yaml` 수정하지 않음
  - main 브랜치에 직접 커밋하지 않음
  - 시스템 전역 JAVA_HOME 변경하지 않음 (현재 세션에서만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Acceptance Criteria**:

  ```
  Scenario: JDK 21 + ANDROID_HOME 설정 확인
    Steps:
      1. `java -version` → openjdk 21.x 출력
      2. `echo $ANDROID_HOME` → ~/Library/Android/sdk
      3. `ls $ANDROID_HOME/build-tools/` → 34.0.0 존재
    Evidence: .sisyphus/evidence/task-1-env-check.txt

  Scenario: Worktree 정상 생성 확인
    Steps:
      1. `git worktree list` → 3개 worktree (main + 2개)
      2. ../ERP-code-quality + fix/code-quality 존재
      3. ../ERP-android-apk + feat/android-apk 존재
    Evidence: .sisyphus/evidence/task-1-worktree-list.txt
  ```

  **Commit**: NO

- [x] 2. Production `any` 타입 제거 (12건, 8파일)

  **What to do**:
  - **`../ERP-code-quality` worktree에서 작업** (fix/code-quality 브랜치)
  - 각 any를 코드 흐름에서 추론한 정확한 타입으로 교체
  - 타입 교체 시 기존 import 확인, 필요하면 Ionic/Angular 라이브러리에서 import

  **수정 대상 (정확한 경로 + 라인번호)**:

  | #   | File                                                                                     | Line    | Current                                                | Replacement Strategy                                                           |
  | --- | ---------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
  | 1   | `apps/web/src/app/core/services/offline-sync.service.ts`                                 | 132     | `pushChange(change: any)`                              | Dexie sync queue에 저장되는 change 객체의 실제 shape 확인 → 인터페이스 정의    |
  | 2   | 동일                                                                                     | 167     | `data: any[]`                                          | DeltaSyncResponse 내부 data 필드 — API 응답 shape 확인                         |
  | 3   | 동일                                                                                     | 194     | `mergeRemoteData(dataType: string, remoteData: any[])` | dataType에 따라 다른 타입 → `Record<string, unknown>[]` 또는 union type        |
  | 4   | 동일                                                                                     | 289     | `this.http.get<any[]>`                                 | HTTP 응답 타입 — 동일 DeltaSyncResponse 또는 generic                           |
  | 5   | `apps/web/src/app/core/services/app-init.service.ts`                                     | 93      | `subscribe((evt: any) =>`                              | `@angular/service-worker`의 `VersionEvent` 또는 `VersionReadyEvent`            |
  | 6-7 | `apps/web/src/app/core/services/reports.service.ts`                                      | 171-172 | `{ orders: any[] }`                                    | API 응답 타입 — Order 인터페이스 배열 사용                                     |
  | 8   | `apps/web/src/app/features/settings/pages/biometric-settings/biometric-settings.page.ts` | 322     | `onToggleChange(event: any)`                           | `@ionic/angular`의 `ToggleCustomEvent` 또는 `IonToggleCustomEvent`             |
  | 9   | `apps/web/src/app/features/orders/pages/order-completion/order-completion.modal.ts`      | 425     | `waste.filter((w: any) =>`                             | waste FormArray의 값 shape — 해당 FormGroup 구조에서 추론                      |
  | 10  | `apps/web/src/app/features/assignment/pages/assignment-detail/assignment-detail.page.ts` | 472     | `const buttons: any[] = []`                            | `@ionic/angular`의 `ActionSheetButton[]`                                       |
  | 11  | `apps/mobile/src/app/core/services/reports.service.ts`                                   | 175     | `this.http.get<any[]>`                                 | API 응답 타입 — **Prisma import 불가** (프론트엔드) → 자체 DTO 인터페이스 정의 |
  | 12  | `packages/shared/src/store/orders.utils.ts`                                              | 58      | `transformOrder(order: any): Order`                    | API 응답의 raw order shape → `RawOrderResponse` 인터페이스 정의                |

  **⚠️ 주의사항** (v1 실수 방지):
  - `packages/shared/src/store/orders.utils.ts` — `store/` 디렉토리임 (`utils/` 아님)
  - `apps/mobile/.../reports.service.ts:175` — Prisma import 불가 → 자체 DTO 인터페이스 사용
  - `orders.utils.ts:57`에 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석 있음 → any 제거 시 이 주석도 함께 제거

  **Must NOT do**:
  - 테스트 파일(_.spec.ts, _.test.ts)의 any 수정 금지
  - 로직 변경/리팩토링 금지 — 타입 어노테이션만 수정
  - `as any` 타입 단언 추가 금지 (해결이 아닌 문제 은폐)
  - Prisma를 프론트엔드에서 import하지 않음

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`erp-angular`]
    - `erp-angular`: Angular/Ionic 패턴(inject, Signal, standalone component), `@ionic/angular` 타입 이해 필요

  **Acceptance Criteria**:

  ```
  Scenario: Production any 제로 확인
    Steps:
      1. `grep -rn --include="*.ts" -E "(:\s*any\b|<any\b|any\[\])" apps/web/src apps/mobile/src packages/shared/src | grep -v "\.spec\.ts" | grep -v "\.test\.ts" | wc -l`
      2. 결과가 `0`
    Evidence: .sisyphus/evidence/task-2-any-count.txt

  Scenario: eslint-disable 주석 정리 확인
    Steps:
      1. `grep -rn "eslint-disable.*no-explicit-any" packages/shared/src/store/orders.utils.ts`
      2. 결과가 0줄
    Evidence: .sisyphus/evidence/task-2-eslint-disable.txt

  Scenario: TypeScript 컴파일 통과
    Steps:
      1. `pnpm --filter web exec -- npx tsc --noEmit` → exit 0
      2. `pnpm --filter mobile exec -- npx tsc --noEmit` → exit 0
      3. `pnpm --filter @erp/shared exec -- npx tsc --noEmit` → exit 0
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt

  Scenario: API 테스트 통과
    Steps:
      1. `pnpm --filter erp-logistics-api test` → 264 tests pass
    Evidence: .sisyphus/evidence/task-2-test-results.txt
  ```

  **Commit**: YES
  - Message: `fix(web,mobile,shared): remove all production any types (12 instances)`
  - Pre-commit: `pnpm --filter web exec -- npx tsc --noEmit && pnpm --filter mobile exec -- npx tsc --noEmit`

- [x] 3. GitHub Actions CI/CD 파이프라인 생성

  **What to do**:
  - **`../ERP-code-quality` worktree에서 작업** (fix/code-quality 브랜치)
  - `.github/workflows/ci.yml` 생성
  - Trigger: push to main, PR to main
  - Jobs:
    - **lint**: `pnpm lint`
    - **type-check**: `pnpm --filter web exec -- npx tsc --noEmit`, mobile, shared 각각
    - **test**: `pnpm --filter erp-logistics-api test` (NOT `pnpm api:test`)
    - **build**: `pnpm api:build && pnpm web:build && pnpm mobile:build` (개별 빌드)
  - Node.js 20.x, pnpm 9.x 사용
  - PostgreSQL 15 + Redis 7 service containers (test job용)
  - Caching: pnpm store (`actions/cache@v4`)
  - `.env.example` 기반 환경변수:
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_test`
    - `REDIS_URL=redis://localhost:6379`
    - `JWT_ACCESS_SECRET=test-secret`
    - `JWT_REFRESH_SECRET=test-refresh-secret`

  **Must NOT do**:
  - CD (배포) 파이프라인 추가 금지
  - Android 빌드 job 추가 금지
  - secrets 사용 금지 (모두 기본값으로)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Acceptance Criteria**:

  ```
  Scenario: CI YAML 유효성 검증
    Steps:
      1. `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` → exit 0
      2. `grep -c "pnpm --filter erp-logistics-api test" .github/workflows/ci.yml` → 1 이상
      3. `grep -c "postgres" .github/workflows/ci.yml` → 1 이상
      4. `grep -c "redis" .github/workflows/ci.yml` → 1 이상
    Evidence: .sisyphus/evidence/task-3-ci-validation.txt
  ```

  **Commit**: YES
  - Message: `ci: add GitHub Actions CI pipeline with lint, type-check, test, build`

- [x] 4. fix/code-quality → main 병합

  **What to do**:
  - `../ERP-code-quality` worktree에서 최종 확인
  - main 브랜치로 이동
  - `git merge fix/code-quality --no-ff -m "merge: code quality improvements (any removal + CI)"`
  - 병합 후 검증: `grep -rn --include="*.ts" -E "(:\s*any\b|<any\b|any\[\])" apps/web/src apps/mobile/src packages/shared/src | grep -v "\.spec\.ts" | grep -v "\.test\.ts" | wc -l` → 0
  - `../ERP-android-apk` worktree에서 main 변경사항 pull: `cd ../ERP-android-apk && git merge main`

  **Must NOT do**:
  - fast-forward merge 금지 (히스토리 보존)
  - 충돌 시 자동 해결 금지 — 각 충돌 파일 확인 후 수동 해결

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Acceptance Criteria**:

  ```
  Scenario: 병합 성공 확인
    Steps:
      1. `git log --oneline -3` → merge commit 존재
      2. `ls .github/workflows/ci.yml` → 파일 존재
      3. any grep → 0 matches
    Evidence: .sisyphus/evidence/task-4-merge.txt
  ```

  **Commit**: NO (merge commit으로 처리)

- [x] 5. environment.android.ts + angular.json android configuration

  **What to do**:
  - **`../ERP-android-apk` worktree에서 작업** (feat/android-apk 브랜치)
  - `apps/mobile/src/environments/environment.android.ts` 생성:
    ```typescript
    export const environment = {
      production: true,
      apiUrl: 'https://erp-logistics-api.onrender.com/api/v1',
      appVersion: '1.0.0',
      platform: 'android',
    };
    ```
  - 기존 environment 파일 패턴 확인 후 동일 구조 사용 (environment.prod.ts 참고)
  - `apps/mobile/angular.json`에 `android` configuration 추가:
    - `production` configuration 복사 후 `fileReplacements`에서 `environment.android.ts` 사용
    - `outputPath` 등 나머지는 production과 동일
  - 빌드 검증: `pnpm --filter mobile run build -- --configuration=android` (`--` separator 필수!)

  **Must NOT do**:
  - 기존 environment 파일 수정 금지
  - `--` 없이 `--configuration` 전달 금지 (pnpm이 flag를 가로챔)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`erp-angular`]

  **Acceptance Criteria**:

  ```
  Scenario: Android environment 빌드 확인
    Steps:
      1. `cat apps/mobile/src/environments/environment.android.ts` → apiUrl 포함
      2. `pnpm --filter mobile run build -- --configuration=android` → exit 0
      3. `ls apps/mobile/www/browser/` → 파일 존재
    Evidence: .sisyphus/evidence/task-5-android-env.txt
  ```

  **Commit**: YES
  - Message: `feat(mobile): add android environment and build configuration`

- [x] 6. Capacitor Android 프로젝트 초기화 + FCM 처리

  **What to do**:
  - **`../ERP-android-apk` worktree에서 작업** (feat/android-apk 브랜치)
  - 먼저 android 빌드 산출물 생성: `pnpm --filter mobile run build -- --configuration=android`
  - `npx cap add android` 실행 (apps/mobile 디렉토리에서)
  - `npx cap sync android` 실행 (반드시 cap add 이후에)

  **FCM/google-services.json 처리** (CRITICAL — v1에서 누락):
  - `@capacitor/push-notifications`가 설치되어 있고 `capacitor.config.json`에 PushNotifications 설정 있음
  - Gradle 빌드 시 `google-services.json` 없으면 실패할 수 있음
  - 해결책 (우선순위):
    1. **Preferred**: `android/app/google-services.json`에 dummy/placeholder 파일 생성 (FCM은 작동 안 하지만 빌드는 성공)
    2. **Alternative**: `android/app/build.gradle`에서 `apply plugin: 'com.google.gms.google-services'` 라인 제거/주석처리
  - placeholder google-services.json 예시:
    ```json
    {
      "project_info": {
        "project_number": "000000000000",
        "project_id": "placeholder",
        "storage_bucket": "placeholder.appspot.com"
      },
      "client": [
        {
          "client_info": {
            "mobilesdk_app_id": "1:000000000000:android:0000000000000000",
            "android_client_info": { "package_name": "com.erp.logistics" }
          },
          "api_key": [{ "current_key": "placeholder" }]
        }
      ],
      "configuration_version": "1"
    }
    ```
  - `.gitignore`에서 `android/` 제거 (커밋 대상에 포함)
  - `android/app/google-services.json`은 `.gitignore`에 추가 (실제 키 유출 방지)
  - Gradle sync 확인: `cd android && ./gradlew tasks --all` (또는 간단히 `./gradlew help`)

  **Must NOT do**:
  - `npx cap add android`을 2번 실행하지 않음 (idempotent 하지 않음)
  - 실제 Firebase 프로젝트 설정 하지 않음
  - `cap sync` 없이 진행하지 않음

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`erp-angular`]

  **Acceptance Criteria**:

  ```
  Scenario: Android 프로젝트 생성 확인
    Steps:
      1. `ls apps/mobile/android/app/build.gradle` → 파일 존재
      2. `ls apps/mobile/android/app/google-services.json` → placeholder 존재
      3. `cd apps/mobile/android && ./gradlew help` → exit 0 (Gradle 동작 확인)
    Evidence: .sisyphus/evidence/task-6-cap-android.txt

  Scenario: .gitignore 업데이트 확인
    Steps:
      1. `git status apps/mobile/android/` → untracked 또는 staged (ignored 아님)
      2. `grep "google-services.json" apps/mobile/.gitignore` → 포함됨
    Evidence: .sisyphus/evidence/task-6-gitignore.txt
  ```

  **Commit**: YES
  - Message: `feat(mobile): initialize Capacitor Android project`
  - Pre-commit: `cd apps/mobile/android && ./gradlew help`

- [x] 7. Keystore 생성 + Gradle Signing + ProGuard + Versioning

  **What to do**:
  - **`../ERP-android-apk` worktree에서 작업** (feat/android-apk 브랜치)

  **Keystore 생성**:
  - `keytool -genkey -v -keystore apps/mobile/android/app/erp-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias erp-release -storepass erp-release-2026 -keypass erp-release-2026 -dname "CN=ERP Logistics, OU=Mobile, O=ERP, L=Seoul, ST=Seoul, C=KR"`
  - keystore를 `.gitignore`에 추가: `*.jks`, `*.keystore` (이미 있을 수 있음 — 확인)

  **Gradle signing 설정** (`apps/mobile/android/app/build.gradle`에 추가):

  ```groovy
  android {
      signingConfigs {
          release {
              storeFile file("erp-release.jks")
              storePassword System.getenv("KEYSTORE_PASSWORD") ?: "erp-release-2026"
              keyAlias "erp-release"
              keyPassword System.getenv("KEY_PASSWORD") ?: "erp-release-2026"
          }
      }
      buildTypes {
          release {
              signingConfig signingConfigs.release
              minifyEnabled true
              shrinkResources true
              proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
          }
      }
      defaultConfig {
          versionCode 1
          versionName "1.0.0"
      }
  }
  ```

  **ProGuard 규칙** (`apps/mobile/android/app/proguard-rules.pro`):
  - Capacitor WebView bridge keep rules 추가
  - `-keep class com.getcapacitor.** { *; }`
  - `-dontwarn com.getcapacitor.**`

  **App Versioning**:
  - `versionCode 1` (monotonically increasing integer)
  - `versionName "1.0.0"` (semver)
  - 주석으로 설명: `// Increment versionCode for every release. Tie to CI build number in production.`

  **Must NOT do**:
  - keystore 파일을 git에 커밋하지 않음 (`.gitignore` 확인)
  - 하드코딩된 패스워드를 production에서 사용하지 않도록 `System.getenv()` fallback 패턴 사용
  - ProGuard로 인해 Capacitor 브릿지가 깨지지 않도록 keep rules 확인

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Acceptance Criteria**:

  ```
  Scenario: Keystore 생성 확인
    Steps:
      1. `ls apps/mobile/android/app/erp-release.jks` → 파일 존재
      2. `keytool -list -keystore apps/mobile/android/app/erp-release.jks -storepass erp-release-2026` → alias 'erp-release' 표시
    Evidence: .sisyphus/evidence/task-7-keystore.txt

  Scenario: Gradle signing + ProGuard 설정 확인
    Steps:
      1. `grep "signingConfigs" apps/mobile/android/app/build.gradle` → 존재
      2. `grep "minifyEnabled true" apps/mobile/android/app/build.gradle` → 존재
      3. `grep "versionCode" apps/mobile/android/app/build.gradle` → 1
      4. `cat apps/mobile/android/app/proguard-rules.pro` → capacitor keep rules 존재
    Evidence: .sisyphus/evidence/task-7-gradle-config.txt
  ```

  **Commit**: YES
  - Message: `feat(mobile): add release signing, ProGuard, and versioning config`

- [x] 8. Release APK 빌드 + 검증

  **What to do**:
  - **`../ERP-android-apk` worktree에서 작업** (feat/android-apk 브랜치)
  - 환경 변수 확인: `echo $JAVA_HOME` → JDK 21, `echo $ANDROID_HOME` → set
  - `cd apps/mobile/android`
  - `./gradlew assembleRelease` 실행
  - APK 출력 확인: `ls -la app/build/outputs/apk/release/`
  - APK 서명 검증: 설치된 build-tools 중 apksigner 찾아서 사용
    - `find $ANDROID_HOME/build-tools -name "apksigner" | head -1` 로 경로 확인
    - `<apksigner-path> verify --verbose app/build/outputs/apk/release/*.apk`
  - APK 크기 확인: < 50MB
  - ProGuard mapping 파일 확인: `ls app/build/outputs/mapping/release/mapping.txt`

  **실패 시 대응**:
  - JDK 버전 오류 → `JAVA_HOME` 확인
  - google-services.json 오류 → T6에서 placeholder 생성 확인
  - ProGuard 오류 → `minifyEnabled false`로 변경 후 재시도, 성공하면 ProGuard rules 조정
  - Gradle daemon 메모리 → `org.gradle.jvmargs=-Xmx2048m` in `gradle.properties`

  **Must NOT do**:
  - debug APK로 대체하지 않음 (반드시 release)
  - 서명 검증 skip 하지 않음
  - apksigner 경로 하드코딩 금지 (동적으로 찾기)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Acceptance Criteria**:

  ```
  Scenario: Release APK 빌드 + 서명 확인
    Steps:
      1. `ls apps/mobile/android/app/build/outputs/apk/release/*.apk` → 파일 존재
      2. `du -h apps/mobile/android/app/build/outputs/apk/release/*.apk` → < 50MB
      3. apksigner verify → "Verified using v1 scheme" 또는 "Verified using v2 scheme"
      4. `ls apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` → ProGuard mapping 존재
    Evidence: .sisyphus/evidence/task-8-apk-build.txt
  ```

  **Commit**: NO (빌드 산출물은 커밋하지 않음 — .gitignore에 \*.apk 포함)

- [x] 9. feat/android-apk → main 병합 + Worktree 정리

  **What to do**:
  - main 브랜치로 이동
  - `git merge feat/android-apk --no-ff -m "merge: Android APK build pipeline (Capacitor, signing, ProGuard)"`
  - 병합 후 검증:
    - `ls apps/mobile/android/app/build.gradle` → 존재
    - `ls apps/mobile/src/environments/environment.android.ts` → 존재
    - `ls .github/workflows/ci.yml` → 존재
    - any grep → 0 matches
  - Worktree 정리:
    - `git worktree remove ../ERP-code-quality`
    - `git worktree remove ../ERP-android-apk`
    - `git branch -d fix/code-quality`
    - `git branch -d feat/android-apk`
  - `git worktree list` → main만 남음

  **Must NOT do**:
  - `--force` 옵션 사용 금지
  - worktree에 uncommitted changes 있으면 정리 전 확인

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Acceptance Criteria**:

  ```
  Scenario: 최종 병합 + 정리 확인
    Steps:
      1. `git worktree list` → 1개 (main만)
      2. `git branch` → fix/code-quality, feat/android-apk 없음
      3. `git log --oneline -5` → 2개 merge commit 존재
    Evidence: .sisyphus/evidence/task-9-final-merge.txt
  ```

  **Commit**: NO (merge commit으로 처리)

---

## Final Verification Wave

> 3 review agents. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit**
      Read the plan. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review**
      Run `pnpm --filter web exec -- npx tsc --noEmit`, mobile, shared. Run `pnpm --filter erp-logistics-api test`. Grep for remaining any (using CORRECT pattern). Check for `@ts-ignore`, empty catches. Review CI YAML.
      Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Any remaining [count] | VERDICT`

- [x] F3. **Scope Fidelity Check**
      For each task: read diff. Verify 1:1 — everything in spec built, nothing beyond spec built. Check "Must NOT do" compliance. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Scope Violations [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

| Branch             | Commit                                                                   | Files                                 | Pre-commit                                                  |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------- |
| `fix/code-quality` | `fix(web,mobile,shared): remove all production any types (12 instances)` | 8 files                               | `tsc --noEmit` (web, mobile, shared)                        |
| `fix/code-quality` | `ci: add GitHub Actions CI pipeline`                                     | `.github/workflows/ci.yml`            | YAML parse check                                            |
| `feat/android-apk` | `feat(mobile): add android environment and build configuration`          | environment.android.ts, angular.json  | `pnpm --filter mobile run build -- --configuration=android` |
| `feat/android-apk` | `feat(mobile): initialize Capacitor Android project`                     | android/, capacitor files, .gitignore | `cd android && ./gradlew help`                              |
| `feat/android-apk` | `feat(mobile): add release signing, ProGuard, and versioning config`     | build.gradle, proguard-rules.pro      | N/A                                                         |

---

## Success Criteria

### Verification Commands

```bash
# any 타입 제거 확인 (CORRECT grep pattern — v1 bug fix)
grep -rn --include="*.ts" -E "(:\s*any\b|<any\b|any\[\])" apps/web/src apps/mobile/src packages/shared/src | grep -v "\.spec\.ts" | grep -v "\.test\.ts" | wc -l  # Expected: 0

# CI 파일 존재
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"  # Expected: exit 0

# APK 존재
ls -la apps/mobile/android/app/build/outputs/apk/release/  # Expected: *.apk file

# APK 서명 검증 (동적 경로)
find $ANDROID_HOME/build-tools -name "apksigner" | head -1 | xargs -I{} {} verify apps/mobile/android/app/build/outputs/apk/release/*.apk  # Expected: Verified

# TypeScript 컴파일
pnpm --filter web exec -- npx tsc --noEmit  # Expected: no errors
pnpm --filter mobile exec -- npx tsc --noEmit  # Expected: no errors

# API 테스트
pnpm --filter erp-logistics-api test  # Expected: 264 tests pass

# ProGuard mapping 존재
ls apps/mobile/android/app/build/outputs/mapping/release/mapping.txt  # Expected: exists
```

### Final Checklist

- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All tests pass
- [x] Both branches merged to main
- [x] Worktrees cleaned up
- [x] APK signed and verified
- [x] ProGuard enabled
- [x] App versioning configured
