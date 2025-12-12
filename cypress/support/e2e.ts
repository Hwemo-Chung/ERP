/**
 * Cypress E2E 테스트 지원 파일
 */

import './commands';

// 전역 에러 핸들링
Cypress.on('uncaught:exception', (err, runnable) => {
  // 특정 에러는 무시
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes('Network request failed')
  ) {
    return false;
  }
  return true;
});

// 각 테스트 후 정리
afterEach(() => {
  cy.clearLocalStorage();
});

export {};
