/**
 * Cypress 커스텀 명령어 정의
 */

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      login(email: string, password: string): Chainable<Subject>;
      logout(): Chainable<Subject>;
      navigateToTab(tab: string): Chainable<Subject>;
      goOffline(): Chainable<Subject>;
      goOnline(): Chainable<Subject>;
      drawSignature(): Chainable<Subject>;
    }
  }
}

// 로그인 명령어
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/auth/login');
  cy.get('[data-cy=email-input]').type(email);
  cy.get('[data-cy=password-input]').type(password);
  cy.get('[data-cy=login-button]').click();
  cy.wait(1000);
  cy.url().should('include', '/dashboard');
});

// 로그아웃 명령어
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy=user-menu]').click();
  cy.get('[data-cy=logout-button]').click();
  cy.url().should('include', '/auth/login');
});

// 탭 네비게이션
Cypress.Commands.add('navigateToTab', (tab: string) => {
  cy.get(`[data-cy=tab-${tab}]`).click();
  cy.wait(500);
});

// 오프라인 모드
Cypress.Commands.add('goOffline', () => {
  cy.window().then((win) => {
    // Service Worker 비활성화
    cy.intercept('**/*', {
      statusCode: 0,
      body: '',
    });

    // 네트워크 연결 상태 시뮬레이션
    win.navigator.onLine = false;
    win.dispatchEvent(new Event('offline'));
  });
});

// 온라인 모드
Cypress.Commands.add('goOnline', () => {
  cy.window().then((win) => {
    // 인터셉터 제거
    cy.intercept('**/*', {
      forceNetworkError: false,
    });

    win.navigator.onLine = true;
    win.dispatchEvent(new Event('online'));
  });
});

// 서명 그리기 (Canvas)
Cypress.Commands.add('drawSignature', () => {
  cy.get('canvas').then(($canvas) => {
    const canvas = $canvas[0] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // 간단한 서명 시뮬레이션 (직선)
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(150, 150);
      ctx.lineTo(200, 50);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Canvas 변경 이벤트 발생
      const event = new Event('change', { bubbles: true });
      canvas.dispatchEvent(event);
    }
  });
});

export {};
