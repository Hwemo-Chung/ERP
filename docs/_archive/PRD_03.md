# PRD: 영업물류 통합 관리 시스템 (SLMS) v3.0

| 문서 번호 | SLMS-PRD-2025-03 | 버전 | 3.0 (Performance & Concurrency) |
| :--- | :--- | :--- | :--- |
| **작성일** | 2025. 12. 21 | **우선순위** | P0 (Critical) |
| **타겟 사용자** | **Web:** 본사 관리자 (10 Account)<br>**App:** 현장 기사 (500 Account) | **예상 트래픽** | 일 5,000 Tx (피크 타임: 08:00~09:00 집중) |
| **핵심 목표** | **동시성 제어(중복 배정 방지)**, **저사양 기기(보급형 폰) 완전 대응** |

---

## 1. 시스템 아키텍처: 성능 및 동시성 설계 (Architecture)

### 1.1. 동시성 제어 전략 (Concurrency Control)
본사 관리자 10명이 동시에 배정 작업을 하거나, 기사 500명이 동시에 출근/완료 처리를 할 때 데이터 무결성을 보장합니다.

1.  **배정 단계 (Redis Distributed Lock - 비관적 락 유사):**
    *   **시나리오:** 관리자 A와 B가 동시에 주문 #123을 서로 다른 기사에게 배정 시도.
    *   **해결:** 주문 ID(`order:123:lock`)를 키로 **Redis Mutex Lock** 설정 (TTL 3초). 먼저 선점한 요청만 처리하고, 후순위 요청은 "이미 처리 중인 주문입니다" 에러 반환.
2.  **데이터 수정 단계 (Optimistic Locking - 낙관적 락):**
    *   **시나리오:** 기사가 오프라인 상태에서 데이터를 수정 후 온라인 전환 시 서버 데이터와 충돌.
    *   **해결:** DB 테이블에 `version` 컬럼 추가.
        *   Update 쿼리: `UPDATE orders SET status='DONE', version=version+1 WHERE id=123 AND version=5`
        *   `Affected Rows`가 0이면 누군가 이미 수정했음을 의미 → 사용자에게 "데이터가 변경되었습니다. 새로고침 하세요." 알림.

### 1.2. 저사양 기기 최적화 (Low-Spec Optimization)
보급형 안드로이드(Galaxy A시리즈, 구형 모델)에서도 60fps를 유지하기 위한 경량화 전략입니다.

1.  **Frontend (Angular/Ionic):**
    *   **Change Detection:** 모든 컴포넌트에 `ChangeDetectionStrategy.OnPush` 적용 (불필요한 렌더링 방지).
    *   **Virtual Scrolling:** 리스트가 50개 이상일 경우 `cdk-virtual-scroll` 필수 적용 (DOM 노드 개수 일정 유지).
    *   **Bundle Size:** `Lazy Loading`을 라우터 단위가 아닌 **컴포넌트 단위**까지 세분화. 초기 로딩 번들 2MB 이하 목표.
    *   **Animation:** CSS `transform`, `opacity` 외의 속성(top, left 등) 애니메이션 금지. 저사양 모드 옵션 제공(애니메이션 OFF).
2.  **Network Payload:**
    *   **GraphQL 또는 Partial Response:** 모바일 목록 조회 시 필요한 필드(`id`, `addr`, `status`)만 요청. 불필요한 데이터(`history`, `logs`) 전송 차단.
    *   **Image Optimization:** 업로드 시 클라이언트(App)에서 `WebP` 포맷으로 압축 및 리사이징(Max 1024px) 후 전송.

---

## 2. 사용자 권한 및 역할 정의 (RBAC)

| 역할 (Role) | 인원 | 권한 범위 (Scope) | 주요 기능 |
| :--- | :--- | :--- | :--- |
| **Super Admin** (본사) | 2명 | 전체 데이터 (Read/Write) | 마스터 코드 관리, 계정 생성, 강제 배정 변경, 마감 해제 |
| **Manager** (본사/지사) | 8명 | 관할 지역 데이터 (Read/Write) | **설치 기사 배정**, 스케줄 조정, 이슈 관리, 정산 확정 |
| **Installer** (기사) | 500명 | 본인 배정 데이터 (Read/Write) | **알림 수신**, 설치 확정, 사진 전송, 폐가전 등록 |

---

## 3. 핵심 기능 상세 (Functional Requirements)

### 3.1. 알림 시스템 (Notification System) - 대량 발송 최적화
**제약:** 500명에게 동시에 공지사항 발송 시 서버 부하 분산 필요.

*   **구조:** `API Server` → `Message Queue (BullMQ)` → `Notification Worker` → `FCM`
*   **기능:**
    *   **개별 알림 (즉시):** 배정 확정 시 기사 1명에게 즉시 발송 (지연 시간 < 1초).
    *   **전체 공지 (Throttling):** 500명 대상 공지는 50건씩 끊어서 1초 간격으로 발송 (FCM API Rate Limit 및 서버 스파이크 방지).
    *   **수신 확인:** 기사가 알림 클릭 시 `read_at` 타임스탬프 기록 (관리자가 수신율 확인 가능).

### 3.2. 배정 관리 (Web - Admin) - 실시간 협업
**상황:** 관리자 10명이 같은 화면을 보고 있음.

*   **Socket.io 연동:**
    *   관리자 A가 주문 #100을 "배정 중" 상태로 드래그 시작 → 관리자 B, C 화면의 주문 #100에 "Lock 아이콘/회색 처리" 실시간 표시.
    *   **충돌 방지 UX:** "현재 다른 관리자가 작업 중인 건입니다." 토스트 메시지 출력.

### 3.3. 현장 업무 (App - Installer) - 오프라인 & 저사양
**상황:** 데이터 5,000건 중 기사 1인당 하루 평균 10~20건 처리.

*   **데이터 동기화 전략 (Sync Strategy):**
    *   **Initial Load:** 로그인 시 **오늘 ±3일** 데이터만 로컬 DB(IndexedDB)에 다운로드 (전체 데이터 X).
    *   **Delta Sync:** 이후에는 "마지막 동기화 시간" 이후 변경된 데이터만 가져옴 (Payload 최소화).
*   **이미지 업로드 (Background):**
    *   설치 사진 촬영 즉시 UI는 "완료" 처리(Optimistic UI).
    *   실제 업로드는 백그라운드에서 `Service Worker`가 수행. 실패 시 "재전송 버튼" 활성화.

---

## 4. 데이터베이스 및 쿼리 최적화 (Backend Performance)

### 4.1. 스키마 설계 (PostgreSQL)
*   **Partitioning:** `Orders` 테이블은 데이터가 쌓일 것을 대비해 **월 단위 파티셔닝** (예: `orders_2025_01`).
*   **Indexing:**
    *   자주 조회하는 `installer_id`, `status`, `promise_date`에 복합 인덱스 생성.
    *   **Covering Index:** 목록 조회 쿼리가 테이블 접근 없이 인덱스만으로 처리되도록 설계.

### 4.2. 캐싱 전략 (Redis)
*   **Master Data:** 변경이 적은 `공통 코드`, `센터 정보`, `품목 정보`는 Redis에 영구 캐싱 (1일 1회 갱신).
*   **Dashboard:** 본사 관리자용 대시보드 통계(진행률 등)는 1분 단위로 집계하여 캐싱 (실시간 쿼리 부하 방지).

---

## 5. 개발 및 배포 환경 (DevOps)

### 5.1. 인프라 구성 (AWS/Cloud 기준)
*   **API Server:** Node.js (NestJS) 인스턴스 2대 (Load Balancer 연결) - 고가용성.
*   **Worker Server:** 알림 발송 및 이미지 리사이징 전용 인스턴스 1대 (메인 API 서버 보호).
*   **DB:** Primary (Write) 1대 + Read Replica 1대 (조회 쿼리 분산).

### 5.2. 모니터링
*   **Slow Query:** 1초 이상 걸리는 쿼리 자동 로깅 및 슬랙 알림.
*   **Client Error:** 앱에서 발생하는 JS 에러(Sentry 연동) 수집 (저사양 기기 특화 버그 추적).

---

## 6. 시나리오별 예외 처리 (Edge Cases)

| 시나리오 | 발생 상황 | 시스템 대응 로직 |
| :--- | :--- | :--- |
| **중복 로그인** | 기사가 폰을 바꾸거나 태블릿으로 동시 접속 | **허용하되 알림은 마지막 접속 기기로만 발송.** (단, 보안 정책에 따라 강제 로그아웃 옵션 가능) |
| **네트워크 불안정** | 엘리베이터에서 '설치 완료' 전송 | 1. 로컬 DB에 'Pending' 상태로 저장.<br>2. 네트워크 복구 감지(`window.ononline`).<br>3. 자동 재전송 및 성공 시 푸시 알림 "데이터 동기화 완료". |
| **대량 주문** | 특정 아파트 단지 500건 일괄 등록 | 엑셀 업로드 시 **비동기 처리**. "업로드가 시작되었습니다. 완료되면 알림을 드립니다." 후 백그라운드 큐에서 처리. |

---

## 7. 개발 마일스톤 (우선순위 조정)

1.  **Week 1:** DB 설계, Redis 락 구현, Auth(JWT) 및 RBAC(10 vs 500) 구현.
2.  **Week 2:** **[Web]** 배정 화면 개발 (Socket.io 실시간 Lock 적용).
3.  **Week 3:** **[App]** 기본 골격 및 오프라인 동기화(IndexedDB) 코어 로직 구현.
4.  **Week 4:** **[App]** 저사양 최적화 (가상 스크롤, 이미지 압축), 알림(FCM) 연동.
5.  **Week 5:** 부하 테스트 (5,000건 트랜잭션 시뮬레이션) 및 쿼리 튜닝.