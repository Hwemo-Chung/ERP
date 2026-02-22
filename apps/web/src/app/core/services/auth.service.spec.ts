import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, User, AuthTokens } from './auth.service';
import { __configureMock, GetOptions } from '@capacitor/preferences';
import { environment } from '@env/environment';
import { ENVIRONMENT_CONFIG } from '@erp/shared';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 'user-123',
    loginId: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    phone: '010-1234-5678',
    roles: ['BRANCH_MANAGER'],
    branchId: 'branch-001',
    branchCode: 'BR001',
  } as User;

  const mockTokens: AuthTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    __configureMock.resetMocks();

    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: ENVIRONMENT_CONFIG, useValue: environment },
      ],
    }).compileComponents();

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
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
      __configureMock.setGetMock(async (opts: GetOptions) => {
        switch (opts.key) {
          case 'erp_access_token':
            return { value: mockTokens.accessToken };
          case 'erp_refresh_token':
            return { value: mockTokens.refreshToken };
          case 'erp_user':
            return { value: JSON.stringify(mockUser) };
          default:
            return { value: null };
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

    it('should handle corrupted user JSON gracefully', fakeAsync(() => {
      __configureMock.setGetMock(async (opts: GetOptions) => {
        switch (opts.key) {
          case 'erp_access_token':
            return { value: mockTokens.accessToken };
          case 'erp_refresh_token':
            return { value: mockTokens.refreshToken };
          case 'erp_user':
            return { value: 'undefined' };
          default:
            return { value: null };
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
    it('should authenticate user on successful login', fakeAsync(() => {
      const credentials = { username: 'testuser', password: 'password123' };

      service.login(credentials);

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      });

      tick();

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.user()).toEqual(mockUser);
    }));

    it('should set error on failed login', fakeAsync(() => {
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
    it('should clear auth state and navigate to login', fakeAsync(() => {
      service.logout();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
      req.flush({});

      tick();

      expect(service.isAuthenticated()).toBeFalse();
      expect(service.user()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));

    it('should logout even if API call fails', fakeAsync(() => {
      service.logout();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      tick();

      expect(service.isAuthenticated()).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));
  });

  describe('role helpers', () => {
    beforeEach(fakeAsync(() => {
      __configureMock.setGetMock(async (opts: GetOptions) => {
        switch (opts.key) {
          case 'erp_access_token':
            return { value: mockTokens.accessToken };
          case 'erp_refresh_token':
            return { value: mockTokens.refreshToken };
          case 'erp_user':
            return {
              value: JSON.stringify({ ...mockUser, roles: ['BRANCH_MANAGER', 'INSTALLER'] }),
            };
          default:
            return { value: null };
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
      __configureMock.setGetMock(async (opts: GetOptions) => {
        switch (opts.key) {
          case 'erp_access_token':
            return { value: mockTokens.accessToken };
          case 'erp_refresh_token':
            return { value: mockTokens.refreshToken };
          case 'erp_user':
            return { value: JSON.stringify(mockUser) };
          default:
            return { value: null };
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
