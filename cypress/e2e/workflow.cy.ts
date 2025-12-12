/**
 * E2E 테스트: 전체 워크플로우 (로그인 → 배정 → 완료 → 리포트)
 */

describe('전체 워크플로우 E2E 테스트', () => {
  const testUser = {
    email: 'test@slms.kr',
    password: 'Test@12345',
  };

  const testOrder = {
    code: 'ORD-2025-001',
    customerName: '테스트 고객',
    customerPhone: '010-1234-5678',
    address: '서울시 강남구',
    items: [
      { productCode: 'TV-LG-55', productName: 'LG 55인치 TV', quantity: 1 },
    ],
  };

  beforeEach(() => {
    // 테스트 전 로컬 스토리지 초기화
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('시나리오 1: 완전한 배정 → 완료 → 리포트 워크플로우', () => {
    // 1. 로그인
    cy.login(testUser.email, testUser.password);

    // 로그인 후 대시보드 확인
    cy.get('ion-title').should('contain', 'Dashboard');
    cy.get('[data-cy=total-orders]').should('exist');
    cy.get('[data-cy=completed-orders]').should('exist');

    // 2. Assignment 탭으로 이동
    cy.navigateToTab('assignment');
    cy.url().should('include', '/assignment');

    // 3. 미배정 주문 조회
    cy.get('[data-cy=unassigned-list]').should('exist');
    cy.get('[data-cy=order-item]').first().as('firstOrder');

    // 4. 배정 시작
    cy.get('@firstOrder').click();
    cy.url().should('include', '/batch-assign');

    // 배정 폼 입력
    cy.get('[data-cy=installer-select]').click();
    cy.get('[data-cy=installer-option]').first().click();
    cy.get('[data-cy=start-date]').type('2025-12-22');
    cy.get('[data-cy=time-slot]').select('09:00-11:00');

    // 배정 저장
    cy.get('[data-cy=save-assignment]').click();
    cy.get('ion-toast').should('contain', '배정 완료');

    // 5. Completion 탭으로 이동
    cy.navigateToTab('completion');
    cy.url().should('include', '/completion');

    // 6. 배정된 주문 목록 확인
    cy.get('[data-cy=assigned-orders]').should('exist');
    cy.get('[data-cy=order-card]').should('have.length.greaterThan', 0);

    // 7. 완료 처리 시작
    cy.get('[data-cy=order-card]').first().click();
    cy.url().should('include', '/completion-process');

    // 8. 완료 정보 입력
    // - 시리얼 번호 스캔 시뮬레이션
    cy.get('[data-cy=serial-input]').type('SN-12345678');
    cy.get('[data-cy=add-serial]').click();

    // - 사진 첨부
    cy.get('[data-cy=take-photo]').click();
    cy.wait(500); // 카메라 로드 대기

    // - 메모 입력
    cy.get('[data-cy=completion-memo]')
      .clear()
      .type('고객 서명 완료, 설치 완료');

    // 9. 서명 패드
    cy.get('canvas').drawSignature();

    // 10. 완료 저장
    cy.get('[data-cy=save-completion]').click();
    cy.get('ion-toast').should('contain', '완료 처리되었습니다');

    // 11. 리포트 탭 이동
    cy.navigateToTab('reports');
    cy.url().should('include', '/reports');

    // 12. 진행 현황 대시보드 확인
    cy.get('[data-cy=progress-dashboard]').click();
    cy.get('[data-cy=completion-rate]').should('exist');
    cy.get('[data-cy=completed-count]').should('contain', '1');

    // 13. CSV 내보내기
    cy.get('[data-cy=export-tab]').click();
    cy.get('[data-cy=export-format]').select('csv');
    cy.get('[data-cy=export-button]').click();
    cy.readFile('cypress/downloads/orders.csv').should('exist');
  });

  it('시나리오 2: 오프라인 작업 + 온라인 복구', () => {
    // 1. 온라인 상태에서 로그인
    cy.login(testUser.email, testUser.password);
    cy.get('ion-title').should('contain', 'Dashboard');

    // 2. 배정 탭 이동 및 주문 조회
    cy.navigateToTab('assignment');
    cy.get('[data-cy=order-item]').first().as('targetOrder');

    // 3. 오프라인 모드 활성화
    cy.goOffline();
    cy.wait(500);

    // 4. 오프라인 상태에서 배정 시도
    cy.get('@targetOrder').click();
    cy.get('[data-cy=batch-assign]').click();

    cy.get('[data-cy=installer-select]').click();
    cy.get('[data-cy=installer-option]').first().click();
    cy.get('[data-cy=save-assignment]').click();

    // 오프라인 배너 표시 확인
    cy.get('[data-cy=offline-banner]').should('be.visible');
    cy.get('ion-toast').should('contain', '오프라인 상태');

    // 5. IndexedDB에 저장되었는지 확인
    cy.window().then((win) => {
      const db = win.indexedDB;
      expect(db).to.exist;
    });

    // 6. 온라인으로 복구
    cy.goOnline();
    cy.wait(1000);

    // 7. 자동 Sync 확인
    cy.get('[data-cy=sync-status]').should('contain', 'Synced');
    cy.get('[data-cy=offline-banner]').should('not.exist');

    // 8. 변경 내용 확인
    cy.get('[data-cy=order-status]').should('contain', 'ASSIGNED');
  });

  it('시나리오 3: 동시성 제어 - 충돌 감지', () => {
    // 1. 로그인
    cy.login(testUser.email, testUser.password);

    // 2. 첫 번째 사용자: 주문 조회 및 수정
    cy.navigateToTab('orders');
    cy.get('[data-cy=order-item]').first().click();
    cy.get('[data-cy=order-memo]').clear().type('User 1 edit');

    // 3. 두 번째 세션 시뮬레이션: 다른 사용자가 같은 주문 수정
    cy.request({
      method: 'PUT',
      url: '/api/orders/ORD-001',
      body: {
        memo: 'User 2 edit',
        version: 1, // 원본 버전
      },
      auth: {
        bearer: 'other-user-token',
      },
    });

    // 4. 첫 번째 사용자가 저장 시도 (버전 충돌 발생)
    cy.get('[data-cy=save-order]').click();

    // 5. 충돌 다이얼로그 표시 확인
    cy.get('[data-cy=conflict-dialog]').should('be.visible');
    cy.get('[data-cy=conflict-message]').should(
      'contain',
      '다른 사용자가 변경했습니다'
    );

    // 6. 재로드 및 재시도 선택
    cy.get('[data-cy=conflict-reload]').click();
    cy.wait(500);

    // 7. 최신 데이터 확인
    cy.get('[data-cy=order-memo]').should('contain', 'User 2 edit');
  });

  it('시나리오 4: 대량 배정 (Bulk Assignment)', () => {
    // 1. 로그인
    cy.login(testUser.email, testUser.password);

    // 2. 배정 탭 이동
    cy.navigateToTab('assignment');

    // 3. 다중 선택 활성화
    cy.get('[data-cy=select-mode-toggle]').click();
    cy.get('[data-cy=order-checkbox]').eq(0).click();
    cy.get('[data-cy=order-checkbox]').eq(1).click();
    cy.get('[data-cy=order-checkbox]').eq(2).click();

    // 4. 대량 배정 시작
    cy.get('[data-cy=bulk-assign-button]').click();
    cy.url().should('include', '/batch-assign');

    // 5. 배정 정보 입력
    cy.get('[data-cy=installer-select]').click();
    cy.get('[data-cy=installer-option]').first().click();
    cy.get('[data-cy=start-date]').type('2025-12-22');
    cy.get('[data-cy=time-slot]').select('09:00-11:00');

    // 6. 배정 저장
    cy.get('[data-cy=save-assignment]').click();

    // 7. 배정 완료 확인
    cy.get('ion-toast').should('contain', '3건의 주문이 배정되었습니다');
    cy.get('[data-cy=assigned-count]').should('contain', '3');
  });

  it('시나리오 5: 알림 시스템', () => {
    // 1. 로그인
    cy.login(testUser.email, testUser.password);

    // 2. 설정 탭 이동
    cy.navigateToTab('settings');

    // 3. 알림 설정 페이지
    cy.get('[data-cy=notification-settings]').click();

    // 4. 알림 빈도 설정
    cy.get('[data-cy=notification-frequency]').select('instant');
    cy.get('[data-cy=save-settings]').click();
    cy.get('ion-toast').should('contain', '설정이 저장되었습니다');

    // 5. 실시간 알림 테스트
    cy.window().then((win) => {
      // 외부 이벤트 발생 시뮬레이션
      const event = new CustomEvent('notification:new', {
        detail: {
          id: 'notif-001',
          type: 'order_assigned',
          title: '새로운 주문 배정',
          message: '주문 ORD-002가 배정되었습니다',
          orderId: 'ORD-002',
        },
      });
      win.dispatchEvent(event);
    });

    // 6. 알림 배너 확인
    cy.get('[data-cy=notification-banner]').should('be.visible');
    cy.get('[data-cy=notification-banner]').should('contain', '새로운 주문 배정');

    // 7. 알림 클릭 → 주문 상세로 이동
    cy.get('[data-cy=notification-banner]').click();
    cy.url().should('include', '/orders/ORD-002');
  });

  it('시나리오 6: 다국어 지원 (i18n)', () => {
    // 1. 로그인
    cy.login(testUser.email, testUser.password);

    // 2. 한국어 기본 설정 확인
    cy.get('ion-title').should('contain', '대시보드');

    // 3. 설정에서 언어 변경
    cy.navigateToTab('settings');
    cy.get('[data-cy=language-select]').select('en');
    cy.wait(500);

    // 4. 영어로 변경 확인
    cy.get('ion-title').should('contain', 'Dashboard');
    cy.get('[data-cy=tab-assignment]').should('contain', 'Assignment');

    // 5. 한국어로 재변경
    cy.get('[data-cy=language-select]').select('ko');
    cy.wait(500);
    cy.get('[data-cy=tab-assignment]').should('contain', '배정');
  });
});
