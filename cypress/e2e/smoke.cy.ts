describe('Smoke Tests', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  describe('Authentication', () => {
    it('should display login page for unauthenticated users', () => {
      cy.visit('/');
      cy.url().should('include', '/auth/login');
      cy.get('ion-input[formControlName="username"]').should('exist');
      cy.get('ion-input[formControlName="password"]').should('exist');
      cy.get('ion-button[type="submit"]').should('exist');
    });

    it('should login successfully with valid credentials', () => {
      cy.loginViaUI('0001', 'test');
      cy.url().should('include', '/tabs/');
      cy.get('ion-tab-bar').should('be.visible');
      cy.get('ion-tab-button').should('have.length.at.least', 4);
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/auth/login');
      cy.get('ion-input[formControlName="username"] input').type('invalid', { force: true });
      cy.get('ion-input[formControlName="password"] input').type('wrongpass', { force: true });
      cy.get('ion-button[type="submit"]').click();
      cy.get('.error-banner').should('be.visible', { timeout: 5000 });
      cy.url().should('include', '/auth/login');
    });

    it('should redirect to login when accessing protected route without auth', () => {
      cy.visit('/tabs/dashboard');
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      cy.loginViaUI('0001', 'test');
    });

    it('should navigate between tabs', () => {
      cy.navigateToTab('dashboard');
      cy.url().should('include', '/tabs/dashboard');

      cy.navigateToTab('assignment');
      cy.url().should('include', '/tabs/assignment');

      cy.navigateToTab('settings');
      cy.url().should('include', '/tabs/settings');
    });

    it('should load dashboard with statistics', () => {
      cy.navigateToTab('dashboard');
      cy.url().should('include', '/tabs/dashboard');
      cy.get('ion-content').should('exist');
      cy.get('.stat-card, .loading-skeleton, .empty-state', { timeout: 10000 }).should('exist');
    });
  });
});
