/**
 * Cypress custom commands for Logistics ERP (Angular 19 + Ionic 8)
 *
 * Selectors target actual Ionic components with formControlName bindings.
 * Native inputs inside ion-input are targeted with `ion-input[formControlName="..."] input`.
 */

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      login(username?: string, password?: string): Chainable<Subject>;
      loginViaUI(username?: string, password?: string): Chainable<Subject>;
      navigateToTab(tab: string): Chainable<Subject>;
    }
  }
}

// API-based login (fast, for non-login tests)
Cypress.Commands.add('login', (username = '0001', password = 'test') => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:3000/api/v1/auth/login',
    body: { username, password },
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status === 200 || response.status === 201) {
      const { accessToken, refreshToken, user } = response.body.data;
      window.localStorage.setItem('CapacitorStorage.erp_access_token', accessToken);
      window.localStorage.setItem('CapacitorStorage.erp_refresh_token', refreshToken);
      window.localStorage.setItem('CapacitorStorage.erp_user', JSON.stringify(user));
    }
  });
});

// UI-based login (for login page tests)
Cypress.Commands.add('loginViaUI', (username = '0001', password = 'test') => {
  cy.visit('/auth/login');
  cy.get('ion-input[formControlName="username"] input').type(username, { force: true });
  cy.get('ion-input[formControlName="password"] input').type(password, { force: true });
  cy.get('ion-button[type="submit"]').click();
  cy.url().should('include', '/tabs/', { timeout: 10000 });
});

// Tab navigation
Cypress.Commands.add('navigateToTab', (tab: string) => {
  cy.get(`ion-tab-button[tab="${tab}"]`).click();
  cy.wait(500);
});

export {};
