// apps/web/src/app/core/services/biometric.service.spec.ts
// FR-22: Biometric Authentication Service Unit Tests
import { TestBed } from '@angular/core/testing';
import { BiometricService, BiometricConfig } from './biometric.service';
import { AuthStore } from '../store/auth/auth.store';
import { BiometryType, NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

// Mock Capacitor
jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(),
  },
}));

// Mock NativeBiometric
jest.mock('capacitor-native-biometric', () => ({
  NativeBiometric: {
    isAvailable: jest.fn(),
    verifyIdentity: jest.fn(),
    setCredentials: jest.fn(),
    getCredentials: jest.fn(),
    deleteCredentials: jest.fn(),
  },
  BiometryType: {
    NONE: 0,
    TOUCH_ID: 1,
    FACE_ID: 2,
    FINGERPRINT: 3,
    FACE_AUTHENTICATION: 4,
    IRIS_AUTHENTICATION: 5,
  },
}));

describe('BiometricService', () => {
  let service: BiometricService;
  let authStore: jasmine.SpyObj<AuthStore>;

  const mockUserId = 'user-123';
  const mockRefreshToken = 'mock-refresh-token-abc';

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Create mock AuthStore
    authStore = jasmine.createSpyObj('AuthStore', [], {
      userId: jest.fn().mockReturnValue(mockUserId),
    });

    TestBed.configureTestingModule({
      providers: [
        BiometricService,
        { provide: AuthStore, useValue: authStore },
      ],
    });

    service = TestBed.inject(BiometricService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('checkAvailability', () => {
    it('should return false on web platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

      const result = await service.checkAvailability();

      expect(result).toBeFalse();
      expect(NativeBiometric.isAvailable).not.toHaveBeenCalled();
    });

    it('should return true on native platform with biometric support', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockResolvedValue({
        isAvailable: true,
        biometryType: BiometryType.FACE_ID,
      });

      const result = await service.checkAvailability();

      expect(result).toBeTrue();
      expect(NativeBiometric.isAvailable).toHaveBeenCalled();
    });

    it('should return false when biometric not supported', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockResolvedValue({
        isAvailable: false,
        biometryType: BiometryType.NONE,
      });

      const result = await service.checkAvailability();

      expect(result).toBeFalse();
    });

    it('should handle errors gracefully', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockRejectedValue(new Error('Not supported'));

      const result = await service.checkAvailability();

      expect(result).toBeFalse();
    });
  });

  describe('enableBiometric', () => {
    beforeEach(() => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockResolvedValue({
        isAvailable: true,
        biometryType: BiometryType.FINGERPRINT,
      });
    });

    it('should enable biometric and store credentials', async () => {
      (NativeBiometric.verifyIdentity as jest.Mock).mockResolvedValue({});
      (NativeBiometric.setCredentials as jest.Mock).mockResolvedValue({});

      await service.enableBiometric(mockUserId, mockRefreshToken);

      expect(NativeBiometric.verifyIdentity).toHaveBeenCalledWith({
        reason: '생체 인증 활성화',
        title: '생체 인증 등록',
        subtitle: '빠른 로그인을 위해 생체 인증을 등록합니다',
      });

      expect(NativeBiometric.setCredentials).toHaveBeenCalledWith({
        username: mockUserId,
        password: mockRefreshToken,
        server: 'erp-logistics',
      });

      // Check localStorage
      const config = JSON.parse(localStorage.getItem('biometric_config')!);
      expect(config.enabled).toBeTrue();
      expect(config.userId).toBe(mockUserId);
      expect(config.lastUsedAt).toBeDefined();
    });

    it('should throw error if biometric verification fails', async () => {
      (NativeBiometric.verifyIdentity as jest.Mock).mockRejectedValue(
        new Error('User cancelled')
      );

      await expectAsync(
        service.enableBiometric(mockUserId, mockRefreshToken)
      ).toBeRejectedWithError('User cancelled');

      expect(NativeBiometric.setCredentials).not.toHaveBeenCalled();
    });

    it('should throw error on web platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

      await expectAsync(
        service.enableBiometric(mockUserId, mockRefreshToken)
      ).toBeRejectedWithError('Biometric authentication is only available on native platforms');
    });
  });

  describe('authenticate', () => {
    beforeEach(() => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
    });

    it('should return credentials on successful authentication', async () => {
      // Setup enabled config
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 0,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      (NativeBiometric.verifyIdentity as jest.Mock).mockResolvedValue({});
      (NativeBiometric.getCredentials as jest.Mock).mockResolvedValue({
        username: mockUserId,
        password: mockRefreshToken,
      });

      const result = await service.authenticate();

      expect(result).toEqual({
        userId: mockUserId,
        refreshToken: mockRefreshToken,
      });

      expect(NativeBiometric.verifyIdentity).toHaveBeenCalledWith({
        reason: '빠른 로그인',
        title: '생체 인증',
        subtitle: '생체 인증으로 로그인합니다',
      });
    });

    it('should return null if biometric not enabled', async () => {
      const result = await service.authenticate();

      expect(result).toBeNull();
      expect(NativeBiometric.verifyIdentity).not.toHaveBeenCalled();
    });

    it('should check expiration (30 days)', async () => {
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
        maxAttempts: 3,
        attemptCount: 0,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      const result = await service.authenticate();

      expect(result).toBeNull();
      
      // Should auto-disable
      const savedConfig = JSON.parse(localStorage.getItem('biometric_config')!);
      expect(savedConfig.enabled).toBeFalse();
    });

    it('should track failed attempts and lock after max attempts', async () => {
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 2, // Already 2 failed attempts
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      (NativeBiometric.verifyIdentity as jest.Mock).mockRejectedValue(
        new Error('Authentication failed')
      );

      const result = await service.authenticate();

      expect(result).toBeNull();

      // Should disable after 3rd failed attempt
      const savedConfig = JSON.parse(localStorage.getItem('biometric_config')!);
      expect(savedConfig.enabled).toBeFalse();
      expect(savedConfig.attemptCount).toBe(3);
    });

    it('should reset attempt count on successful authentication', async () => {
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 1,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      (NativeBiometric.verifyIdentity as jest.Mock).mockResolvedValue({});
      (NativeBiometric.getCredentials as jest.Mock).mockResolvedValue({
        username: mockUserId,
        password: mockRefreshToken,
      });

      await service.authenticate();

      const savedConfig = JSON.parse(localStorage.getItem('biometric_config')!);
      expect(savedConfig.attemptCount).toBe(0);
      expect(savedConfig.lastUsedAt).toBeGreaterThan(config.lastUsedAt);
    });
  });

  describe('disableBiometric', () => {
    it('should disable biometric and delete credentials', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.deleteCredentials as jest.Mock).mockResolvedValue({});

      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 0,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      await service.disableBiometric();

      expect(NativeBiometric.deleteCredentials).toHaveBeenCalledWith({
        server: 'erp-logistics',
      });

      // Should clear config
      const savedConfig = JSON.parse(localStorage.getItem('biometric_config')!);
      expect(savedConfig.enabled).toBeFalse();
      expect(savedConfig.userId).toBe('');
    });

    it('should work on web platform (no-op)', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

      await expectAsync(service.disableBiometric()).toBeResolved();

      expect(NativeBiometric.deleteCredentials).not.toHaveBeenCalled();
    });

    it('should handle errors when deleting credentials', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.deleteCredentials as jest.Mock).mockRejectedValue(
        new Error('Keychain error')
      );

      await expectAsync(service.disableBiometric()).toBeResolved();

      // Should still disable in config
      const savedConfig = JSON.parse(localStorage.getItem('biometric_config')!);
      expect(savedConfig.enabled).toBeFalse();
    });
  });

  describe('getBiometryTypeName', () => {
    it('should return Face ID for FACE_ID type', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockResolvedValue({
        isAvailable: true,
        biometryType: BiometryType.FACE_ID,
      });

      await service.checkAvailability();
      const name = service.getBiometryTypeName();

      expect(name).toBe('Face ID');
    });

    it('should return 지문 인식 for FINGERPRINT type', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockResolvedValue({
        isAvailable: true,
        biometryType: BiometryType.FINGERPRINT,
      });

      await service.checkAvailability();
      const name = service.getBiometryTypeName();

      expect(name).toBe('지문 인식');
    });

    it('should return 지문 인식 for TOUCH_ID type', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (NativeBiometric.isAvailable as jest.Mock).mockResolvedValue({
        isAvailable: true,
        biometryType: BiometryType.TOUCH_ID,
      });

      await service.checkAvailability();
      const name = service.getBiometryTypeName();

      expect(name).toBe('지문 인식');
    });

    it('should return empty string when not available', () => {
      const name = service.getBiometryTypeName();

      expect(name).toBe('');
    });
  });

  describe('isEnabledForUser', () => {
    it('should return true when enabled for user', () => {
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 0,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      // Reload config
      service['loadConfig']();

      const result = service.isEnabledForUser(mockUserId);

      expect(result).toBeTrue();
    });

    it('should return false when disabled', () => {
      const config: BiometricConfig = {
        enabled: false,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 0,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      service['loadConfig']();

      const result = service.isEnabledForUser(mockUserId);

      expect(result).toBeFalse();
    });

    it('should return false for different user', () => {
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 0,
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      service['loadConfig']();

      const result = service.isEnabledForUser('different-user-id');

      expect(result).toBeFalse();
    });
  });

  describe('config$ observable', () => {
    it('should emit config changes', (done) => {
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        lastUsedAt: Date.now(),
        maxAttempts: 3,
        attemptCount: 0,
      };

      service.config$.subscribe(emittedConfig => {
        if (emittedConfig.enabled) {
          expect(emittedConfig.userId).toBe(mockUserId);
          done();
        }
      });

      localStorage.setItem('biometric_config', JSON.stringify(config));
      service['loadConfig']();
    });
  });
});
