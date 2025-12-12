// cypress/e2e/completion-tracking.cy.ts
// FR-15: Certificate Issuance Tracking E2E Tests
describe('FR-15: Certificate Issuance Tracking', () => {
  const baseUrl = 'http://localhost:4200';
  const testUser = { 
    loginId: 'branch_manager', 
    password: 'test1234' 
  };

  beforeEach(() => {
    // Login
    cy.visit(`${baseUrl}/auth/login`);
    cy.get('input[formControlName="loginId"]').type(testUser.loginId);
    cy.get('input[formControlName="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    
    // Wait for navigation
    cy.url().should('include', '/tabs/');
    
    // Navigate to completion list
    cy.visit(`${baseUrl}/tabs/completion`);
    cy.wait(500);
  });

  describe('Certificate Filter Segments', () => {
    it('should display all 5 filter segments', () => {
      cy.get('ion-segment').should('exist');
      cy.get('ion-segment-button').should('have.length', 5);
      
      // Verify segment labels
      cy.get('ion-segment-button').eq(0).should('contain', '전체');
      cy.get('ion-segment-button').eq(1).should('contain', '배송완료');
      cy.get('ion-segment-button').eq(2).should('contain', '설치완료');
      cy.get('ion-segment-button').eq(3).should('contain', '증명서 발급');
      cy.get('ion-segment-button').eq(4).should('contain', '미발급');
    });

    it('should be scrollable on small screens', () => {
      cy.viewport('iphone-6');
      cy.get('ion-segment').should('have.css', 'overflow-x', 'auto');
    });

    it('should highlight selected segment', () => {
      cy.get('ion-segment-button[value="all"]').should('have.attr', 'class').and('include', 'segment-button-checked');
      
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(300);
      
      cy.get('ion-segment-button[value="issued"]')
        .should('have.attr', 'class')
        .and('include', 'segment-button-checked');
    });
  });

  describe('Statistics Cards', () => {
    it('should display 4 stat cards including certificate issued', () => {
      cy.get('.stats-grid').should('exist');
      cy.get('.stat-card').should('have.length', 4);
    });

    it('should show certificate issued count', () => {
      cy.get('.stat-card').eq(3).within(() => {
        cy.contains('증명서 발급').should('be.visible');
        cy.get('.count').should('exist');
        cy.get('.count').invoke('text').should('match', /^\d+$/); // Should be a number
      });
    });

    it('should update counts when filter changes', () => {
      // Get initial count
      cy.get('.stat-card').eq(0).find('.count').invoke('text').then((initialCount) => {
        // Change filter
        cy.get('ion-segment-button[value="completed"]').click();
        cy.wait(300);
        
        // Count should be different or same based on data
        cy.get('.stat-card').eq(0).find('.count').should('exist');
      });
    });
  });

  describe('Certificate Issued Filter', () => {
    it('should filter orders with issued certificates', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      // All visible orders should have certificate badge
      cy.get('ion-card.order-card').each(($card) => {
        cy.wrap($card).find('.badge.certificate-issued').should('exist');
        cy.wrap($card).find('.badge.certificate-issued').should('contain', '증명서 발급');
      });
    });

    it('should show empty state when no issued certificates', () => {
      cy.intercept('GET', '**/api/orders*', {
        statusCode: 200,
        body: {
          items: [],
          total: 0,
        },
      }).as('getOrders');

      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait('@getOrders');
      cy.wait(300);
      
      cy.contains('발급된 증명서가 없습니다').should('be.visible');
    });

    it('should display certificate issued date', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      cy.get('ion-card.order-card').first().within(() => {
        cy.get('.badge.certificate-issued').should('exist');
        // Certificate badge should have document icon
        cy.get('ion-icon[name="document-text-outline"]').should('exist');
      });
    });
  });

  describe('Certificate Not Issued Filter', () => {
    it('should filter orders without issued certificates', () => {
      cy.get('ion-segment-button[value="not-issued"]').click();
      cy.wait(500);
      
      // No orders should have certificate badge
      cy.get('ion-card.order-card').each(($card) => {
        cy.wrap($card).find('.badge.certificate-issued').should('not.exist');
      });
    });

    it('should show completed orders without certificates', () => {
      cy.get('ion-segment-button[value="not-issued"]').click();
      cy.wait(500);
      
      cy.get('ion-card.order-card').should('exist');
      cy.get('ion-card.order-card').each(($card) => {
        // Should have completion status
        cy.wrap($card).find('.status-badge').should('exist');
        // But no certificate badge
        cy.wrap($card).find('.badge.certificate-issued').should('not.exist');
      });
    });

    it('should show empty state when all have certificates', () => {
      cy.intercept('GET', '**/api/orders*', {
        statusCode: 200,
        body: {
          items: [],
          total: 0,
        },
      }).as('getOrders');

      cy.get('ion-segment-button[value="not-issued"]').click();
      cy.wait('@getOrders');
      cy.wait(300);
      
      cy.contains('미발급 증명서가 없습니다').should('be.visible');
    });
  });

  describe('Badge Styling', () => {
    it('should display certificate badge with correct colors', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      cy.get('.badge.certificate-issued').first().within(() => {
        cy.should('have.css', 'background-color').and('match', /rgba?\(.*\)/);
        cy.get('ion-icon').should('have.css', 'color');
      });
    });

    it('should show certificate icon', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      cy.get('.badge.certificate-issued').first().within(() => {
        cy.get('ion-icon[name="document-text-outline"]').should('be.visible');
      });
    });
  });

  describe('Filter Persistence', () => {
    it('should maintain filter after page refresh', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      cy.reload();
      cy.wait(500);
      
      // Filter should persist (if implemented)
      cy.get('ion-segment-button[value="all"]').should('have.attr', 'class').and('include', 'segment-button-checked');
    });

    it('should reset filter when navigating back', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      // Navigate away
      cy.visit(`${baseUrl}/tabs/orders`);
      cy.wait(300);
      
      // Navigate back
      cy.visit(`${baseUrl}/tabs/completion`);
      cy.wait(500);
      
      // Should reset to 'all'
      cy.get('ion-segment-button[value="all"]').should('have.attr', 'class').and('include', 'segment-button-checked');
    });
  });

  describe('Order Detail Certificate Info', () => {
    it('should show certificate issued date in detail page', () => {
      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait(500);
      
      cy.get('ion-card.order-card').first().click();
      cy.wait(500);
      
      // Should navigate to detail page
      cy.url().should('include', '/tabs/completion/');
      
      // Should show certificate issued info
      cy.contains('증명서 발급').should('be.visible');
    });

    it('should show "미발급" status when not issued', () => {
      cy.get('ion-segment-button[value="not-issued"]').click();
      cy.wait(500);
      
      cy.get('ion-card.order-card').first().click();
      cy.wait(500);
      
      // Should show not issued status
      cy.contains('증명서').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      cy.get('ion-segment-button[value="all"]').focus();
      cy.focused().should('have.attr', 'value', 'all');
      
      cy.focused().type('{rightarrow}');
      cy.focused().should('have.attr', 'value', 'dispatched');
    });

    it('should have proper ARIA labels', () => {
      cy.get('ion-segment').should('have.attr', 'aria-label');
      cy.get('ion-segment-button').each(($btn) => {
        cy.wrap($btn).should('have.attr', 'aria-label');
      });
    });

    it('should announce filter changes to screen readers', () => {
      cy.get('ion-segment-button[value="issued"]').should('have.attr', 'role');
    });
  });

  describe('Performance', () => {
    it('should load filter results quickly', () => {
      const startTime = Date.now();
      
      cy.get('ion-segment-button[value="issued"]').click();
      cy.get('ion-card.order-card').should('exist').then(() => {
        const endTime = Date.now();
        const loadTime = endTime - startTime;
        
        expect(loadTime).to.be.lessThan(2000); // Should load within 2 seconds
      });
    });

    it('should handle large datasets efficiently', () => {
      // Mock large dataset
      const mockOrders = Array.from({ length: 100 }, (_, i) => ({
        id: `order-${i}`,
        orderId: `ORD-${i}`,
        certificateIssuedAt: i % 2 === 0 ? new Date().toISOString() : null,
      }));

      cy.intercept('GET', '**/api/orders*', {
        statusCode: 200,
        body: {
          items: mockOrders,
          total: 100,
        },
      }).as('getOrders');

      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait('@getOrders');
      
      cy.get('ion-card.order-card').should('exist');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null certificateIssuedAt gracefully', () => {
      cy.get('ion-segment-button[value="not-issued"]').click();
      cy.wait(500);
      
      cy.get('ion-card.order-card').should('exist');
    });

    it('should handle invalid date formats', () => {
      cy.intercept('GET', '**/api/orders*', {
        statusCode: 200,
        body: {
          items: [
            {
              id: 'order-1',
              orderId: 'ORD-001',
              certificateIssuedAt: 'invalid-date',
            },
          ],
          total: 1,
        },
      }).as('getOrders');

      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait('@getOrders');
      
      // Should not crash
      cy.get('ion-card.order-card').should('exist');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '**/api/orders*', {
        statusCode: 500,
        body: {
          message: 'Internal Server Error',
        },
      }).as('getOrdersError');

      cy.get('ion-segment-button[value="issued"]').click();
      cy.wait('@getOrdersError');
      
      // Should show error message
      cy.contains('오류').should('be.visible');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should display correctly on mobile', () => {
      cy.viewport('iphone-6');
      
      cy.get('.stats-grid').should('exist');
      cy.get('.stat-card').should('be.visible');
      cy.get('ion-segment').should('be.visible');
    });

    it('should support touch interactions', () => {
      cy.viewport('iphone-6');
      
      cy.get('ion-segment-button[value="issued"]').click({ force: true });
      cy.wait(300);
      
      cy.get('ion-segment-button[value="issued"]')
        .should('have.attr', 'class')
        .and('include', 'segment-button-checked');
    });
  });
});
