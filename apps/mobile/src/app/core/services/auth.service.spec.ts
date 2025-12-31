import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, User, AuthTokens } from './auth.service';
import { Preferences, __configureMock } from '@capacitor/preferences';
import { environment } from '@env/environment';

// Helper function to create a valid JWT token with expiry
function createMockJwt(expiresInSeconds: number = 3600): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'user-123',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = 'mock-signature';
  return `${header}.${payload}.${signature}`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    fullName: 'Test User',
    roles: ['BRANCH_MANAGER'],
    branchCode: 'BR001',
    locale: 'ko',
  };

  // Use valid JWT format tokens (expires in 1 hour)
  let mockTokens: AuthTokens;

  beforeEach(async () => {
    // Reset mock to default behavior
    __configureMock.resetMocks();

    // Generate fresh valid JWT tokens for each test
    mockTokens = {
      accessToken: createMockJwt(3600),  // Expires in 1 hour
      refreshToken: createMockJwt(86400), // Expires in 24 hours
    };

    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    __configureMock.resetMocks();
    TestBed.resetTestingModule();
  });

  describe('safeJsonParse', () => {
    const callSafeJsonParse = (value: string | null, clearKey?: string): any => {
      return (service as any).safeJsonParse(value, clearKey);
    };

    it('should return null for null value', () => {
      expect(callSafeJsonParse(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(callSafeJsonParse('')).toBeNull();
    });

    it('should return null for literal string "undefined"', () => {
      expect(callSafeJsonParse('undefined')).toBeNull();
    });

    it('should return null for literal string "null"', () => {
      expect(callSafeJsonParse('null')).toBeNull();
    });

    it('should parse valid JSON correctly', () => {
      const json = JSON.stringify(mockUser);
      expect(callSafeJsonParse(json)).toEqual(mockUser);
    });

    it('should return null for invalid JSON', () => {
      expect(callSafeJsonParse('invalid json {')).toBeNull();
    });

    it('should parse nested objects correctly', () => {
      const nestedData = { user: mockUser, metadata: { timestamp: 12345 } };
      expect(callSafeJsonParse(JSON.stringify(nestedData))).toEqual(nestedData);
    });

    it('should parse arrays correctly', () => {
      const arrayData = [mockUser, { ...mockUser, id: 'user-456' }];
      expect(callSafeJsonParse(JSON.stringify(arrayData))).toEqual(arrayData);
    });
  });

  describe('initialize', () => {
    it('should restore session when valid tokens exist in storage', fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: JSON.stringify(mockUser) };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.user()).toEqual(mockUser);
    }));

    it('should remain unauthenticated when no tokens in storage', fakeAsync(() => {
      __configureMock.setGetMock(async () => ({ value: null }));

      service.initialize();
      tick();

      expect(service.isAuthenticated()).toBeFalse();
      expect(service.user()).toBeNull();
    }));

    it('should remain unauthenticated when only access token exists', fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        if (opts.key === 'erp_access_token') {
          return { value: mockTokens.accessToken };
        }
        return { value: null };
      });

      service.initialize();
      tick();

      expect(service.isAuthenticated()).toBeFalse();
    }));

    it('should handle corrupted user JSON gracefully', fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: 'undefined' };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.user()).toBeNull();
    }));

    it('should handle invalid JSON in user storage gracefully', fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: 'invalid json {{{' };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.user()).toBeNull();
    }));

    it('should handle storage access errors gracefully', fakeAsync(() => {
      __configureMock.setGetMock(async () => {
        throw new Error('Storage access denied');
      });

      service.initialize();
      tick();

      expect(service.isAuthenticated()).toBeFalse();
    }));
  });

  describe('login', () => {
    it('should store tokens and user on successful login', fakeAsync(() => {
      const credentials = { username: 'testuser', password: 'password123' };
      let storedValues: Record<string, string> = {};

      __configureMock.setSetMock(async (opts) => {
        storedValues[opts.key] = opts.value;
      });

      service.login(credentials);

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);

      req.flush({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });

      tick();

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.user()).toEqual(mockUser);
      expect(storedValues['erp_access_token']).toBe(mockTokens.accessToken);
      expect(storedValues['erp_refresh_token']).toBe(mockTokens.refreshToken);
      expect(storedValues['erp_user']).toBe(JSON.stringify(mockUser));
    }));

    it('should return false and set error on failed login', fakeAsync(() => {
      const credentials = { username: 'testuser', password: 'wrong' };

      service.login(credentials);

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      tick();

      expect(service.isAuthenticated()).toBeFalse();
      expect(service.error()).toBeTruthy();
    }));

    it('should set loading state during login', fakeAsync(() => {
      const credentials = { username: 'testuser', password: 'password123' };

      service.login(credentials);

      expect(service.isLoading()).toBeTrue();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });

      tick();

      expect(service.isLoading()).toBeFalse();
    }));
  });

  describe('logout', () => {
    // Initialize authenticated state before each logout test
    beforeEach(fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: JSON.stringify(mockUser) };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();
    }));

    it('should clear storage and navigate to login', fakeAsync(() => {
      const removedKeys: string[] = [];

      __configureMock.setRemoveMock(async (opts) => {
        removedKeys.push(opts.key);
      });

      service.logout();
      tick(); // Allow the logout to start

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
      req.flush({});

      tick();

      expect(removedKeys).toContain('erp_access_token');
      expect(removedKeys).toContain('erp_refresh_token');
      expect(removedKeys).toContain('erp_user');
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.user()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));

    it('should still logout even if API call fails', fakeAsync(() => {
      const removedKeys: string[] = [];

      __configureMock.setRemoveMock(async (opts) => {
        removedKeys.push(opts.key);
      });

      service.logout();
      tick(); // Allow the logout to start

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      tick();

      expect(removedKeys.length).toBe(3);
      expect(service.isAuthenticated()).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));
  });

  describe('refreshTokens', () => {
    beforeEach(fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: JSON.stringify(mockUser) };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();
    }));

    it('should update tokens on successful refresh', fakeAsync(() => {
      const storedValues: Record<string, string> = {};
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      __configureMock.setSetMock(async (opts) => {
        storedValues[opts.key] = opts.value;
      });

      service.refreshTokens();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
      expect(req.request.body).toEqual({ refreshToken: mockTokens.refreshToken });
      req.flush(newTokens);

      tick();

      expect(storedValues['erp_access_token']).toBe(newTokens.accessToken);
      expect(storedValues['erp_refresh_token']).toBe(newTokens.refreshToken);
    }));

    it('should logout on failed refresh', fakeAsync(() => {
      service.refreshTokens();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      // Need to tick to allow error handling to trigger logout
      tick();

      // Logout will make another request
      const logoutReq = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
      logoutReq.flush({});

      tick();

      expect(service.isAuthenticated()).toBeFalse();
    }));

    it('should return false when no refresh token exists', fakeAsync(async () => {
      // Reset to unauthenticated state by calling logout
      service.logout();
      tick(); // Allow logout to start

      // Flush the logout request that was made since we had tokens
      const logoutReq = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
      logoutReq.flush({});
      tick();

      // Now refreshTokens should return false since there are no tokens
      const result = await service.refreshTokens();

      expect(result).toBeFalse();
    }));
  });

  describe('role helpers', () => {
    beforeEach(fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: JSON.stringify({ ...mockUser, roles: ['BRANCH_MANAGER', 'INSTALLER'] }) };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();
    }));

    it('should return true for existing role', () => {
      expect(service.hasRole('BRANCH_MANAGER')).toBeTrue();
    });

    it('should return false for non-existing role', () => {
      expect(service.hasRole('HQ_ADMIN')).toBeFalse();
    });

    it('should return true when user has any of the specified roles', () => {
      expect(service.hasAnyRole(['HQ_ADMIN', 'BRANCH_MANAGER'])).toBeTrue();
    });

    it('should return false when user has none of the specified roles', () => {
      expect(service.hasAnyRole(['HQ_ADMIN', 'PARTNER_COORDINATOR'])).toBeFalse();
    });
  });

  describe('getAccessToken', () => {
    it('should return access token when authenticated', fakeAsync(() => {
      __configureMock.setGetMock(async (opts) => {
        switch (opts.key) {
          case 'erp_access_token': return { value: mockTokens.accessToken };
          case 'erp_refresh_token': return { value: mockTokens.refreshToken };
          case 'erp_user': return { value: JSON.stringify(mockUser) };
          default: return { value: null };
        }
      });

      service.initialize();
      tick();

      expect(service.getAccessToken()).toBe(mockTokens.accessToken);
    }));

    it('should return null when not authenticated', () => {
      expect(service.getAccessToken()).toBeNull();
    });
  });
});
