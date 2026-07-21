# ERP 개선 PRD
**작성일**: 2026-07-04 · **분류**: 개인 · **활동 상태**: dormant · **권장**: 개선 투자

## 1. 개요
ERP는 창고 주문 처리와 현장 드라이버 설치 워크플로우를 하나의 코드베이스에서 Web/Android/iOS로 제공하는 오프라인 우선 물류 ERP PWA다. Angular/Ionic + Capacitor 프론트엔드와 NestJS/Prisma 백엔드를 pnpm 모노레포(turborepo, apps/api·apps/web·apps/mobile·packages/shared) 구조로 운영한다.

마지막 커밋이 2026-02-22로 현재(2026-07-04) 기준 약 4.3개월간 활동이 없어 dormant 상태다. 다만 ~353개 non-spec .ts 파일, 약 66,000줄 규모(2026-07-04 검증: git 추적 non-spec .ts 353개, 66,486줄)의 비트리비얼한 코드베이스이며 CI(.github/workflows/ci.yml)와 Cypress/Playwright/Angular 유닛테스트 스캐폴딩이 이미 갖춰져 있어, 방치보다는 정리·업그레이드를 통한 재가동 가치가 있는 프로젝트로 판단된다.

## 2. 현황 진단

| 스택 | 현재 버전 | 최신 안정 버전 | 비고 |
|---|---|---|---|
| Angular | 19 | 22.0.5 (2026-06-03 메이저 릴리스) | v19 LTS는 2026-05-19 종료 — 사실상 EOL 상태 |
| Ionic Framework | 8 | 8.8.13 (2026-07-01) | 동일 메이저, 패치만 뒤처짐 — 긴급성 낮음 |
| Capacitor | 6 | 8.4.1 (2026-06-19) | 2개 메이저 뒤처짐. Node 22+ 요구, edge-to-edge 강제, iOS SPM 기본화 등 breaking change 다수 |
| TypeScript | 5.7.2 | 6.0.3 (2026-04-16) | Angular 22가 TS 6.0+를 요구하므로 Angular 업그레이드와 묶어서 처리 필요 |
| NestJS | 11 | (research 데이터 없음) | 별도 조사 필요 |
| Prisma / @prisma/client | 6.0.0 | (research 데이터 없음) | 별도 조사 필요 |

- 테스트: 있음 (Cypress e2e, Playwright e2e, Angular 유닛테스트 tsconfig.spec.json/src/testing)
- CI: 있음 (.github/workflows/ci.yml)
- 핵심 문제:
  1. 워킹 트리에 미커밋 변경(.nvmrc, CLAUDE.md, docs/CLAUDE.md 수정, docs/templates/waterfall/CLAUDE.md 삭제) 존재
  2. ERP 리포지토리 루트에 무관한 Swift 프로젝트 `MDIRCommander/`(Package.swift 기반)가 untracked 상태로 섞여 있음
  3. 리포 루트에 임시 상태/보고서 md 파일 다수(CHANGELOG-2026-01-04.md, FE-02-VIRTUAL-SCROLLING-COMPLETE.md, PROGRESS.md, handoff.md 등)와 빌드 산출물(erp-logistics-v0.0.01a-release.apk, android-login-success.png, web-deployed.png)이 docs/나 릴리스 위치가 아닌 루트에 커밋되어 있음
  4. Render(render.yaml), Cloudflare(wrangler.toml), Vercel(vercel.json ×2), Docker(Dockerfile.api, docker-compose.yml)가 동시에 존재 — 배포 대상이 정리되지 않고 churn 상태

## 3. 개선 항목

### P0

**1. Angular 19 EOL 업그레이드**
- **문제**: 현재 angular@19 사용 중이나 v19 LTS는 2026-05-19에 종료되어 보안 패치를 받지 못하는 상태.
- **개선안**: Angular v19 → v20(LTS, 2026-11-28까지) 또는 v21(LTS)을 거쳐 v22로 단계적 업그레이드(`ng update`, 메이저 1단계씩).
- **근거**: scan.stack `angular@19`; research Angular support notes("v19 = LTS ended 2026-05-19, fully EOL"), https://angular.dev/reference/releases
- **수용 기준**: `ng version` 출력이 Angular 20 이상, `ng build`/기존 Cypress·Playwright·유닛테스트 스위트가 모두 통과.

**2. 리포지토리 워킹 트리 정리 및 이질적 프로젝트 분리**
- **문제**: 미커밋 상태의 CLAUDE.md/.nvmrc 변경, docs/templates/waterfall/CLAUDE.md 삭제가 커밋 안 된 채 방치. 무관한 Swift 패키지 MDIRCommander/가 ERP 리포 루트에 untracked로 존재.
- **개선안**: 현재 diff를 리뷰해 의도된 변경만 커밋하고, MDIRCommander/는 별도 리포지토리로 분리(git 이력 필요 시 subtree/filter-repo, 아니면 단순 이동 후 .gitignore 등록).
- **근거**: keyFindings "Uncommitted working-tree changes present... and an entirely untracked top-level directory MDIRCommander/"
- **수용 기준**: `git status`가 clean(untracked 없음), MDIRCommander/가 ERP 리포지토리 경로에 더 이상 존재하지 않음.

### P1

**3. Capacitor 6 → 8 업그레이드**
- **문제**: capacitor@6은 최신(8.4.1) 대비 2개 메이저 뒤처져 있으며, Capacitor 8은 Node 22+, Android Studio Otter, compileSdk/targetSdk 36, edge-to-edge 강제(구 `android.adjustMarginsForEdgeToEdge` 제거), iOS 기본 SPM 전환 등 breaking change를 포함.
- **개선안**: Capacitor 7을 경유해 8로 순차 업그레이드(`npx cap migrate` 활용), Android edge-to-edge CSS `env()` 대응 및 iOS SPM 마이그레이션 검증.
- **근거**: scan.stack `capacitor@6`; research Capacitor migrationNotes, https://capacitorjs.com/docs/updating/8-0
- **수용 기준**: apps/mobile의 Android/iOS 빌드가 Capacitor 8 기준으로 성공, 기존 E2E(Cypress/Playwright)가 회귀 없이 통과.

**4. 리포 루트 정리 — 임시 문서·빌드 산출물 이동**
- **문제**: CHANGELOG-2026-01-04.md, PROGRESS.md, handoff.md 등 ad-hoc 문서와 erp-logistics-v0.0.01a-release.apk, 스크린샷(android-login-success.png, web-deployed.png) 같은 빌드 산출물이 리포 루트에 커밋되어 있어 리포지토리가 비대해지고 탐색성이 떨어짐.
- **개선안**: 문서는 `docs/` 하위로, 빌드 산출물(.apk, 스크린샷)은 GitHub Releases 또는 별도 아티팩트 저장소로 이동하고 리포 루트에서 제거, 향후 재발 방지를 위해 `.gitignore`에 빌드 산출물 패턴 추가.
- **근거**: keyFindings "Repo root is cluttered with many ad-hoc status/report markdown files... plus committed build artifacts... at top level"
- **수용 기준**: 리포 루트에 임시 md 파일 및 바이너리 산출물이 0건, 해당 자료는 docs/ 또는 Releases에서 접근 가능.

### P2

**5. 배포 설정 단일화**
- **문제**: render.yaml, wrangler.toml, Dockerfile.api, docker-compose.yml, apps/web과 apps/mobile 양쪽의 vercel.json이 동시에 존재해 실제 배포 대상이 불명확(Render/Cloudflare Pages/Vercel/Docker 간 churn 흔적).
- **개선안**: 실제 운영 중인 배포 타깃 1곳(또는 web/api 분리 시 최소 구성)을 확정하고 나머지 설정 파일 제거 또는 `docs/deployment.md`에 사유와 함께 보관.
- **근거**: keyFindings "Multiple deployment configs coexist... suggesting deployment-target churn across Render, Cloudflare Pages, Vercel and Docker"
- **수용 기준**: 리포지토리에 활성 배포 설정 파일이 1개 배포 경로당 1세트만 남고, 나머지는 삭제되거나 문서화된 사유와 함께 명시적으로 보관됨.

**6. TypeScript 5.7.2 → 6.0 업그레이드 (Angular 22 선행 조건)**
- **문제**: typescript@5.7.2는 Angular 22가 요구하는 TS 6.0+에 미달하며, TS 6.0은 `types=[]` 기본값 등 다수의 major default 변경을 동반.
- **개선안**: Angular v22 업그레이드(P0-1) 진행 전 TypeScript를 6.0.3으로 올리고, `ignoreDeprecations: "6.0"`로 경고를 확인한 뒤 필요한 @types 패키지를 명시적으로 추가.
- **근거**: scan.stack `typescript@5.7.2`; research TypeScript migrationNotes, https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- **수용 기준**: `tsc --version`이 6.0.x 이상, 전체 워크스페이스(apps/api, apps/web, apps/mobile, packages/shared) `tsc --noEmit` 통과.

## 4. 비범위 (YAGNI)
- NestJS 11, Prisma 6.0.0에 대한 버전 업그레이드 제안 — research 데이터 부재로 이번 PRD에서 다루지 않음(별도 조사 필요).
- 신규 기능/제품 로드맵 제안 — 이번 PRD는 유지보수·의존성·리포 위생 개선에 한정.
- DEV_CREDENTIALS.md 관련 보안 조치 — 확인 결과 로컬 Docker Adminer용 placeholder이며 실제 프로덕션 시크릿이 아니므로 조치 불필요.
- MDIRCommander/ 내부 Swift 코드의 기능 개선 — 이번 PRD 범위는 "ERP 리포에서 분리"까지이며, 분리 후 해당 프로젝트 자체 개선은 별도 PRD 대상.

## 5. 참고 자료
- https://angular.dev/reference/releases
- https://github.com/angular/angular/releases
- https://capacitorjs.com/docs/updating/8-0
- https://github.com/ionic-team/capacitor/releases
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- https://github.com/microsoft/typescript/releases

<!-- ULW_PRD_ROOT_PLACEMENT source=/Users/solution/Documents/GitHub/_docs-plans/prd/ERP.md project=ERP -->

---

## 추가 데이터 조사 지침

- 원본 PRD: `/Users/solution/Documents/GitHub/_docs-plans/prd/ERP.md`
- 프로젝트 루트: `/Users/solution/Documents/GitHub/_projects/ERP`
- 감지된 스택/근거: Android/Gradle, Node/JavaScript/TypeScript, Angular, Swift/SwiftPM (manifest: .github/workflows, MDIRCommander/Package.swift, apps/api/package.json, apps/mobile/android/build.gradle, apps/mobile/android/gradlew, apps/mobile/android/settings.gradle, apps/mobile/angular.json, apps/mobile/package.json, apps/web/angular.json, apps/web/package.json, package.json, packages/shared/package.json)
- 조사 기준일: 2026-07-04. 날짜/버전/가격/시장 수치는 최신성이 흔들리므로 재작성 직전에 공식 문서나 원 출처로 재검증한다.

### 조사 우선순위
1. 저장소 사실 확인: `git status --short`, `git log -5 --oneline --decorate`, 최근 변경 파일, 실제 디렉터리 구조, manifest/lockfile, 테스트/CI/배포 파일을 먼저 확인한다.
2. 문서-코드 일치성: README, CLAUDE/AGENTS류 문서, docs/ 설계서의 주장과 실제 소스/설정/스크립트를 대조하고 불일치는 파일 경로와 함께 기록한다.
3. 실행 가능성: 빌드/테스트 명령은 manifest의 실제 scripts를 기준으로 선택한다. 실행하지 못하면 사유(의존성 없음, SDK 없음, 인증 필요 등)를 PRD에 명시한다.
4. 의존성 최신성: 프레임워크/SDK/런타임 버전은 공식 릴리즈 노트, EOL 표, 패키지 레지스트리에서 확인하고 조회일을 남긴다.
5. 제품/시장 근거: 시장 규모, 경쟁 제품, 가격, 앱스토어/배포 상태, 사용자 지표는 원 출처 URL과 조회일을 같이 남기며 추정치는 추정으로 표시한다.
6. 우선순위 재산정: P0는 빌드 불가/데이터 손실/보안/배포 차단처럼 즉시 막는 문제만 둔다. P1은 유지보수와 재현성, P2는 정리/문서/후속 개선으로 제한한다.

### 권장 로컬 조사 명령
```sh
git -C "/Users/solution/Documents/GitHub/_projects/ERP" status --short
git -C "/Users/solution/Documents/GitHub/_projects/ERP" log -5 --oneline --decorate
find "/Users/solution/Documents/GitHub/_projects/ERP" -maxdepth 3 \( -name package.json -o -name pubspec.yaml -o -name build.gradle -o -name build.gradle.kts -o -name Package.swift -o -name pyproject.toml -o -name go.mod -o -name Cargo.toml -o -name README.md -o -path '*/.github/workflows/*' \) -print
```

### PRD 작성 규칙
- 관찰한 사실과 제안을 분리한다. 증거 없는 단정은 `확인 필요`로 남긴다.
- 각 개선 항목은 문제, 근거, 최소 개선안, 수용 기준을 포함한다.
- 신규 기능보다 현재 코드의 재현성, 테스트 가능성, 배포 가능성을 먼저 평가한다.
- 이 지침은 조사 절차이며, 조사 결과 자체로 간주하지 않는다.
