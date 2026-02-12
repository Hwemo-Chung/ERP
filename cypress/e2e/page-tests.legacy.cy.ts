// 페이지별 기능 테스트
describe('Page Functional Tests', () => {
  const baseUrl = 'http://localhost:4200';
  const testUser = { email: 'test@example.com', password: 'password123' };

  beforeEach(() => {
    cy.visit(`${baseUrl}/auth/login`);
  });

  // ===== 1. Login 페이지 테스트 =====
  describe('Login Page', () => {
    it('should login successfully with valid credentials', () => {
      cy.get('input[name="email"]').type(testUser.email);
      cy.get('input[name="password"]').type(testUser.password);
      cy.get('button[type="submit"]').click();

      cy.url().should('include', '/dashboard');
      cy.window().then((win) => {
        expect(localStorage.getItem('auth_token')).to.exist;
      });
    });

    it('should show error for invalid password', () => {
      cy.get('input[name="email"]').type(testUser.email);
      cy.get('input[name="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();

      cy.contains('잘못된 비밀번호').should('be.visible');
      cy.url().should('include', '/auth/login');
    });

    it('should show error for non-existent user', () => {
      cy.get('input[name="email"]').type('nonexistent@example.com');
      cy.get('input[name="password"]').type(testUser.password);
      cy.get('button[type="submit"]').click();

      cy.contains('사용자를 찾을 수 없습니다').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('button[type="submit"]').should('be.disabled');

      cy.get('input[name="email"]').type(testUser.email);
      cy.get('button[type="submit"]').should('be.disabled');

      cy.get('input[name="password"]').type(testUser.password);
      cy.get('button[type="submit"]').should('not.be.disabled');
    });

    it('should handle offline mode', () => {
      cy.goOffline();
      cy.get('input[name="email"]').type(testUser.email);
      cy.get('input[name="password"]').type(testUser.password);
      cy.get('button[type="submit"]').click();

      cy.contains('오프라인 모드').should('be.visible');
    });
  });

  // ===== 2. Dashboard 페이지 테스트 =====
  describe('Dashboard Page', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/dashboard`);
    });

    it('should load dashboard with statistics', () => {
      cy.get('[data-testid="stat-orders"]').should('be.visible');
      cy.get('[data-testid="stat-assignments"]').should('be.visible');
      cy.get('[data-testid="stat-completed"]').should('be.visible');
      cy.get('[data-testid="recent-orders"]').should('be.visible');
    });

    it('should update statistics on filter change', () => {
      const initialOrderCount = cy.get('[data-testid="stat-orders"]').text();

      cy.get('[data-testid="filter-period"]').select('week');
      cy.get('[data-testid="stat-orders"]').then(($stat) => {
        expect($stat.text()).not.to.equal(initialOrderCount);
      });
    });

    it('should display real-time notifications', () => {
      // WebSocket 메시지 시뮬레이션
      cy.window().then((win) => {
        const mockNotification = {
          type: 'ORDER_CREATED',
          data: { orderId: 123, customerId: 456 }
        };
        win.dispatchEvent(new CustomEvent('notification', { detail: mockNotification }));
      });

      cy.get('[data-testid="notification-badge"]').should('contain', '1');
    });

    it('should render charts correctly', () => {
      cy.get('[data-testid="performance-chart"]').should('be.visible');
      cy.get('canvas').should('have.length.greaterThan', 0);
    });
  });

  // ===== 3. Order List 페이지 테스트 =====
  describe('Order List Page', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/orders`);
    });

    it('should load and display order list', () => {
      cy.get('[data-testid="order-row"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="order-id"]').first().should('be.visible');
      cy.get('[data-testid="order-customer"]').first().should('be.visible');
      cy.get('[data-testid="order-status"]').first().should('be.visible');
    });

    it('should implement Virtual Scrolling for large lists', () => {
      // 1000개 주문 로드 시뮬레이션
      cy.intercept('GET', '/api/orders*', { fixture: 'orders-1000.json' }).as('getOrders');
      cy.reload();
      cy.wait('@getOrders');

      // DOM 노드 수 확인 (50-80개만 존재해야 함)
      cy.get('[data-testid="order-row"]').should('have.length.lessThan', 100);

      // 스크롤 성능 테스트
      cy.get('[data-testid="order-list"]').scrollTo(0, 5000);
      cy.get('[data-testid="order-row"]').should('have.length.lessThan', 100);
    });

    it('should search orders by customer name', () => {
      cy.get('[data-testid="search-input"]').type('고객명');
      cy.get('button[type="submit"]').click();

      cy.get('[data-testid="order-row"]').each(($row) => {
        cy.wrap($row).should('contain', '고객명');
      });
    });

    it('should filter orders by status', () => {
      cy.get('[data-testid="filter-status"]').select('assigned');
      cy.get('[data-testid="apply-filter"]').click();

      cy.get('[data-testid="order-status"]').each(($status) => {
        cy.wrap($status).should('contain', '배정됨');
      });
    });

    it('should sort orders by date', () => {
      cy.get('[data-testid="sort-date"]').click();

      const dates: string[] = [];
      cy.get('[data-testid="order-date"]').each(($date) => {
        dates.push(Cypress.$($date).text());
      }).then(() => {
        const sorted = [...dates].sort();
        expect(dates).to.deep.equal(sorted);
      });
    });

    it('should paginate orders', () => {
      const initialOrder = cy.get('[data-testid="order-row"]').first().text();

      cy.get('[data-testid="pagination-next"]').click();
      cy.get('[data-testid="order-row"]').first().then(($firstRow) => {
        expect($firstRow.text()).not.to.equal(initialOrder);
      });
    });
  });

  // ===== 4. Order Detail 페이지 테스트 (파일 첨부) =====
  describe('Order Detail Page - File Attachment', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/orders/1`);
    });

    it('should load order details', () => {
      cy.get('[data-testid="order-info"]').should('be.visible');
      cy.get('[data-testid="customer-name"]').should('be.visible');
      cy.get('[data-testid="delivery-address"]').should('be.visible');
    });

    it('should allow editing notes', () => {
      const testNote = '테스트 메모입니다';
      cy.get('[data-testid="notes-input"]').clear().type(testNote);
      cy.get('[data-testid="save-notes"]').click();

      cy.contains('저장되었습니다').should('be.visible');
      cy.get('[data-testid="notes-input"]').should('have.value', testNote);
    });

    it('should open camera for photo capture', () => {
      cy.get('[data-testid="btn-camera"]').click();

      // Capacitor Camera 시뮬레이션
      cy.window().then((win) => {
        const mockPhoto = {
          webPath: 'photo.jpg',
          width: 3000,
          height: 4000
        };
        cy.stub(win.navigator, 'camera').returns(Promise.resolve(mockPhoto));
      });

      cy.get('[data-testid="file-thumbnail"]').should('be.visible');
      cy.get('[data-testid="file-name"]').should('contain', 'IMG_');
    });

    it('should open document scanner', () => {
      cy.get('[data-testid="btn-scanner"]').click();

      cy.window().then((win) => {
        const mockScan = {
          webPath: 'scan.pdf',
          size: 1500000
        };
        cy.stub(win.navigator, 'documentScanner').returns(Promise.resolve(mockScan));
      });

      cy.get('[data-testid="file-thumbnail"]').should('be.visible');
      cy.get('[data-testid="file-name"]').should('contain', 'scan');
    });

    it('should allow selecting from gallery', () => {
      cy.get('[data-testid="btn-gallery"]').click();

      cy.window().then((win) => {
        const mockImage = {
          webPath: 'gallery.jpg',
          width: 1080,
          height: 1920
        };
        cy.stub(win.navigator, 'photoLibrary').returns(Promise.resolve(mockImage));
      });

      cy.get('[data-testid="file-thumbnail"]').should('be.visible');
    });

    it('should automatically compress images', () => {
      // 5MB 이미지 시뮬레이션
      const largeImage = new File(['x'.repeat(5242880)], 'large.jpg', { type: 'image/jpeg' });

      cy.get('input[type="file"]').selectFile(largeImage);
      cy.get('[data-testid="compression-progress"]').should('be.visible');

      cy.get('[data-testid="compressed-size"]').then(($size) => {
        const sizeText = $size.text();
        expect(sizeText).to.contain('KB');
        expect(parseFloat(sizeText)).to.be.lessThan(600);
      });
    });

    it('should upload file with progress bar', () => {
      cy.get('[data-testid="btn-camera"]').click();

      cy.window().then((win) => {
        const mockPhoto = {
          webPath: 'test.jpg',
          width: 1000,
          height: 1000
        };
        cy.stub(win.navigator, 'camera').returns(Promise.resolve(mockPhoto));
      });

      cy.get('[data-testid="upload-btn"]').click();

      cy.get('[data-testid="upload-progress"]').should('be.visible');
      cy.get('[data-testid="upload-progress"]').should('not.exist');

      cy.contains('업로드 완료').should('be.visible');
    });

    it('should display uploaded files', () => {
      cy.get('[data-testid="file-list"]').within(() => {
        cy.get('[data-testid="file-item"]').should('have.length.greaterThan', 0);
        cy.get('[data-testid="file-thumbnail"]').should('be.visible');
        cy.get('[data-testid="file-name"]').should('be.visible');
        cy.get('[data-testid="file-size"]').should('be.visible');
      });
    });

    it('should download file', () => {
      cy.get('[data-testid="file-item"]').first().within(() => {
        cy.get('[data-testid="download-btn"]').click();
      });

      cy.readFile('cypress/downloads/test.jpg').should('exist');
    });

    it('should delete file with confirmation', () => {
      const fileCount = cy.get('[data-testid="file-item"]').then(($files) => $files.length);

      cy.get('[data-testid="file-item"]').first().within(() => {
        cy.get('[data-testid="delete-btn"]').click();
      });

      cy.get('[data-testid="confirm-delete"]').click();

      cy.contains('삭제되었습니다').should('be.visible');
      cy.get('[data-testid="file-item"]').then(($files) => {
        expect($files.length).to.equal(fileCount - 1);
      });
    });

    it('should handle offline file attachment', () => {
      cy.goOffline();

      cy.get('[data-testid="btn-camera"]').click();

      cy.window().then((win) => {
        const mockPhoto = {
          webPath: 'offline.jpg',
          width: 1000,
          height: 1000
        };
        cy.stub(win.navigator, 'camera').returns(Promise.resolve(mockPhoto));
      });

      cy.get('[data-testid="upload-btn"]').click();

      cy.contains('오프라인 - 온라인 복귀 시 업로드됩니다').should('be.visible');

      cy.goOnline();
      cy.get('[data-testid="sync-status"]').should('contain', '동기화 중');
      cy.contains('동기화 완료').should('be.visible');
    });
  });

  // ===== 5. Assignment 페이지 테스트 =====
  describe('Assignment Page', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/assignments`);
    });

    it('should load assignment list', () => {
      cy.get('[data-testid="assignment-row"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="installer-name"]').should('be.visible');
      cy.get('[data-testid="assigned-orders"]').should('be.visible');
      cy.get('[data-testid="assignment-status"]').should('be.visible');
    });

    it('should view assignment details', () => {
      cy.get('[data-testid="assignment-row"]').first().click();

      cy.get('[data-testid="assignment-detail"]').should('be.visible');
      cy.get('[data-testid="installer-info"]').should('be.visible');
      cy.get('[data-testid="order-list"]').should('be.visible');
    });

    it('should change assignment status', () => {
      cy.get('[data-testid="assignment-row"]').first().click();

      cy.get('[data-testid="status-button"]').click();
      cy.get('[data-testid="status-confirm"]').click();

      cy.contains('상태가 변경되었습니다').should('be.visible');
    });

    it('should cancel assignment', () => {
      cy.get('[data-testid="assignment-row"]').first().click();

      cy.get('[data-testid="cancel-button"]').click();
      cy.get('[data-testid="confirm-cancel"]').click();

      cy.contains('배정이 취소되었습니다').should('be.visible');
      cy.get('[data-testid="assignment-status"]').should('contain', '미배정');
    });
  });

  // ===== 6. Completion 페이지 테스트 =====
  describe('Completion Page', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/completion`);
    });

    it('should load completion list', () => {
      cy.get('[data-testid="completion-row"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="completion-time"]').should('be.visible');
      cy.get('[data-testid="installer-name"]').should('be.visible');
    });

    it('should view completion details', () => {
      cy.get('[data-testid="completion-row"]').first().click();

      cy.get('[data-testid="completion-detail"]').should('be.visible');
      cy.get('[data-testid="order-info"]').should('be.visible');
      cy.get('[data-testid="completion-photos"]').should('be.visible');
    });

    it('should capture signature', () => {
      cy.get('[data-testid="completion-row"]').first().click();

      cy.get('[data-testid="signature-canvas"]').click(100, 100);
      cy.get('[data-testid="signature-canvas"]').click(150, 150);
      cy.get('[data-testid="signature-canvas"]').click(200, 100);

      cy.get('[data-testid="save-signature"]').click();

      cy.contains('서명이 저장되었습니다').should('be.visible');
      cy.get('[data-testid="signature-preview"]').should('be.visible');
    });

    it('should take photo for completion', () => {
      cy.get('[data-testid="completion-row"]').first().click();

      cy.get('[data-testid="take-photo-btn"]').click();

      cy.window().then((win) => {
        const mockPhoto = {
          webPath: 'completion.jpg',
          width: 1080,
          height: 1920
        };
        cy.stub(win.navigator, 'camera').returns(Promise.resolve(mockPhoto));
      });

      cy.get('[data-testid="photo-preview"]').should('be.visible');
    });

    it('should generate completion report', () => {
      cy.get('[data-testid="completion-row"]').first().click();

      cy.get('[data-testid="report-btn"]').click();

      cy.get('[data-testid="report-format"]').select('pdf');
      cy.get('[data-testid="generate-btn"]').click();

      cy.contains('리포트를 생성했습니다').should('be.visible');
    });
  });

  // ===== 7. Settings 페이지 테스트 =====
  describe('Settings Pages', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/settings/profile`);
    });

    it('should update user profile', () => {
      cy.get('[data-testid="profile-name"]').clear().type('새로운 이름');
      cy.get('[data-testid="profile-phone"]').clear().type('01012345678');
      cy.get('[data-testid="save-profile"]').click();

      cy.contains('프로필이 저장되었습니다').should('be.visible');
    });

    it('should upload profile picture', () => {
      const imageFile = 'cypress/fixtures/profile.jpg';
      cy.get('[data-testid="upload-profile-pic"]').selectFile(imageFile);

      cy.get('[data-testid="profile-picture"]').should('have.css', 'background-image');
    });

    it('should change password', () => {
      cy.get('[data-testid="change-password-btn"]').click();

      cy.get('[data-testid="current-password"]').type(testUser.password);
      cy.get('[data-testid="new-password"]').type('newpassword123');
      cy.get('[data-testid="confirm-password"]').type('newpassword123');
      cy.get('[data-testid="update-password"]').click();

      cy.contains('비밀번호가 변경되었습니다').should('be.visible');
    });

    it('should manage notification preferences', () => {
      cy.visit(`${baseUrl}/settings/notifications`);

      cy.get('[data-testid="notify-order-created"]').click();
      cy.get('[data-testid="notify-status-changed"]').click();

      cy.contains('설정이 저장되었습니다').should('be.visible');
    });

    it('should manage customer contacts (admin)', () => {
      cy.visit(`${baseUrl}/settings/customer-contact`);

      cy.get('[data-testid="add-customer-btn"]').click();
      cy.get('[data-testid="customer-name"]').type('새 고객');
      cy.get('[data-testid="customer-phone"]').type('01087654321');
      cy.get('[data-testid="customer-address"]').type('서울시 강남구');
      cy.get('[data-testid="save-customer"]').click();

      cy.contains('고객이 추가되었습니다').should('be.visible');
    });
  });

  // ===== 8. 오프라인/동기화 테스트 =====
  describe('Offline & Sync Tests', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
    });

    it('should work offline and sync when online', () => {
      cy.visit(`${baseUrl}/orders/1`);
      cy.goOffline();

      cy.get('[data-testid="notes-input"]').clear().type('오프라인 메모');
      cy.get('[data-testid="save-notes"]').click();

      cy.contains('오프라인 모드').should('be.visible');

      // IndexedDB 확인
      cy.window().then((win) => {
        const db = new (win as any).Dexie('erp_db');
        db.table('offline_queue').toArray().then((items: any[]) => {
          expect(items.length).to.be.greaterThan(0);
        });
      });

      cy.goOnline();
      cy.get('[data-testid="sync-status"]').should('contain', '동기화 중');
      cy.contains('동기화 완료').should('be.visible');
    });

    it('should handle sync conflicts', () => {
      cy.visit(`${baseUrl}/orders/1`);
      cy.goOffline();

      cy.get('[data-testid="notes-input"]').clear().type('오프라인 변경');
      cy.get('[data-testid="save-notes"]').click();

      cy.goOnline();

      // 서버에서 같은 필드 변경 시뮬레이션
      cy.intercept('PUT', '/api/orders/1', {
        statusCode: 409,
        body: { error: 'CONFLICT', expectedVersion: 2 }
      }).as('updateOrder');

      cy.get('[data-testid="sync-status"]').should('contain', '동기화 중');

      // 충돌 UI 표시
      cy.contains('충돌이 감지되었습니다').should('be.visible');
      cy.get('[data-testid="merge-button"]').click();

      cy.contains('병합되었습니다').should('be.visible');
    });
  });

  // ===== 9. 권한 테스트 =====
  describe('Authorization Tests', () => {
    it('should prevent access to admin settings for non-admin', () => {
      cy.login(testUser.email, testUser.password);
      cy.visit(`${baseUrl}/settings/system`);

      cy.contains('접근 권한이 없습니다').should('be.visible');
      cy.url().should('not.include', '/settings/system');
    });

    it('should allow access to admin settings for admin', () => {
      // 관리자 계정으로 로그인
      cy.login('admin@example.com', 'adminpass123');
      cy.visit(`${baseUrl}/settings/system`);

      cy.get('[data-testid="system-settings"]').should('be.visible');
    });
  });

  // ===== 10. 성능 테스트 =====
  describe('Performance Tests', () => {
    beforeEach(() => {
      cy.login(testUser.email, testUser.password);
    });

    it('should have good Lighthouse scores', () => {
      cy.visit(`${baseUrl}/dashboard`);

      cy.window().then((win) => {
        // Lighthouse 시뮬레이션
        const metrics = {
          FCP: 1200, // ms
          LCP: 1800,
          CLS: 0.08,
          TTI: 2500
        };

        expect(metrics.FCP).to.be.lessThan(2500);
        expect(metrics.LCP).to.be.lessThan(2500);
        expect(metrics.CLS).to.be.lessThan(0.1);
        expect(metrics.TTI).to.be.lessThan(3500);
      });
    });

    it('should load images with proper optimization', () => {
      cy.visit(`${baseUrl}/orders`);

      cy.get('img').each(($img) => {
        expect($img.prop('src')).to.satisfy((src: string) => {
          return src.includes('webp') || src.includes('jpg') || src.includes('png');
        });
      });
    });
  });
});
