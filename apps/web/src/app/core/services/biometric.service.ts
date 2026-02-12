/**
 * FR-22: Biometric Authentication Service
 * PRD: Biometric quick login (Face ID/Fingerprint)
 *
 * After opt-in, biometric prompt unlocks session without password
 * if refresh token valid; fallback path logged.
 */
import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometryType, NativeBiometric } from 'capacitor-native-biometric';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { LoggerService } from './logger.service';

export interface BiometricConfig {
  enabled: boolean;
  biometryType: BiometryType | null;
  userId: string | null;
  lastUsedAt: number | null;
}

const BIOMETRIC_CONFIG_KEY = 'biometric_config';
const BIOMETRIC_CREDENTIAL_SERVER = 'erp-logistics';

@Injectable({
  providedIn: 'root',
})
export class BiometricService {
  // Reactive state
  private readonly configSubject = new BehaviorSubject<BiometricConfig>({
    enabled: false,
    biometryType: null,
    userId: null,
    lastUsedAt: null,
  });

  public readonly config$ = this.configSubject.asObservable();

  /** Get current config value synchronously */
  get currentConfig(): BiometricConfig {
    return this.configSubject.value;
  }

  public readonly isAvailable = signal<boolean>(false);
  public readonly biometryType = signal<BiometryType | null>(null);

  private readonly translate = inject(TranslateService);
  private readonly logger = inject(LoggerService);

  constructor() {
    this.initializeBiometric();
  }

  /**
   * Initialize biometric authentication
   */
  private async initializeBiometric(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.isAvailable.set(false);
      return;
    }

    try {
      const result = await NativeBiometric.isAvailable();
      this.isAvailable.set(result.isAvailable);
      this.biometryType.set(result.biometryType);

      // Load saved config
      const savedConfig = this.loadConfig();
      if (savedConfig) {
        this.configSubject.next(savedConfig);
      }
    } catch (error) {
      this.logger.error('Failed to initialize biometric:', error);
      this.isAvailable.set(false);
    }
  }

  /**
   * Check if biometric is available on device
   */
  async checkAvailability(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const result = await NativeBiometric.isAvailable();
      this.isAvailable.set(result.isAvailable);
      this.biometryType.set(result.biometryType);
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  /**
   * Enable biometric authentication for current user
   */
  async enableBiometric(userId: string, refreshToken: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Biometric authentication not available');
    }

    try {
      // Request biometric verification
      await this.verifyIdentity('인증 활성화');

      // Store credentials securely
      await NativeBiometric.setCredentials({
        username: userId,
        password: refreshToken,
        server: BIOMETRIC_CREDENTIAL_SERVER,
      });

      // Update config
      const config: BiometricConfig = {
        enabled: true,
        biometryType: this.biometryType(),
        userId,
        lastUsedAt: Date.now(),
      };

      this.saveConfig(config);
      this.configSubject.next(config);

      // Log to audit trail
      this.logger.info(`[BiometricService] Biometric enabled for user: ${userId}`);

      return true;
    } catch (error) {
      this.logger.error('Failed to enable biometric:', error);
      throw error;
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(): Promise<void> {
    try {
      // Delete stored credentials
      await NativeBiometric.deleteCredentials({
        server: BIOMETRIC_CREDENTIAL_SERVER,
      });

      // Clear config
      const config: BiometricConfig = {
        enabled: false,
        biometryType: null,
        userId: null,
        lastUsedAt: null,
      };

      this.saveConfig(config);
      this.configSubject.next(config);

      this.logger.info('[BiometricService] Biometric disabled');
    } catch (error) {
      this.logger.error('Failed to disable biometric:', error);
      throw error;
    }
  }

  /**
   * Authenticate using biometric
   */
  async authenticate(): Promise<{ userId: string; refreshToken: string } | null> {
    const config = this.configSubject.value;

    if (!config.enabled || !this.isAvailable()) {
      throw new Error('Biometric not enabled or not available');
    }

    try {
      // Verify biometric
      await this.verifyIdentity(this.translate.instant('AUTH.LOGIN.SIGN_IN'));

      // Retrieve stored credentials
      const credentials = await NativeBiometric.getCredentials({
        server: BIOMETRIC_CREDENTIAL_SERVER,
      });

      // Update last used timestamp
      const updatedConfig = {
        ...config,
        lastUsedAt: Date.now(),
      };
      this.saveConfig(updatedConfig);
      this.configSubject.next(updatedConfig);

      // Log to audit trail
      this.logger.info(
        `[BiometricService] Biometric auth success for user: ${credentials.username}`,
      );

      return {
        userId: credentials.username,
        refreshToken: credentials.password,
      };
    } catch (error) {
      this.logger.error('Biometric authentication failed:', error);

      // Log fallback path
      this.logger.warn('[BiometricService] Falling back to password login');

      return null;
    }
  }

  /**
   * Verify user identity with biometric
   */
  private async verifyIdentity(reason: string): Promise<void> {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Logistics ERP',
      subtitle: '생체 인증이 필요합니다',
      description: `${reason}을 위해 생체 인증을 진행합니다`,
      maxAttempts: 3,
    });
  }

  /**
   * Get biometry type display name
   */
  getBiometryTypeName(): string {
    const type = this.biometryType();

    if (!type) return '';

    switch (type) {
      case BiometryType.FACE_AUTHENTICATION:
      case BiometryType.FACE_ID:
        return 'Face ID';
      case BiometryType.FINGERPRINT:
      case BiometryType.TOUCH_ID:
        return '지문 인식';
      case BiometryType.IRIS_AUTHENTICATION:
        return '홍채 인식';
      default:
        return '생체 인증';
    }
  }

  /**
   * Check if biometric is enabled for current user
   */
  isEnabledForUser(userId: string): boolean {
    const config = this.configSubject.value;
    return config.enabled && config.userId === userId;
  }

  /**
   * Load config from storage
   */
  private loadConfig(): BiometricConfig | null {
    try {
      const stored = localStorage.getItem(BIOMETRIC_CONFIG_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save config to storage
   */
  private saveConfig(config: BiometricConfig): void {
    try {
      localStorage.setItem(BIOMETRIC_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      this.logger.error('Failed to save biometric config:', error);
    }
  }

  /**
   * Clear all biometric data
   */
  async clearAllData(): Promise<void> {
    try {
      await this.disableBiometric();
      localStorage.removeItem(BIOMETRIC_CONFIG_KEY);
    } catch (error) {
      this.logger.error('Failed to clear biometric data:', error);
    }
  }
}
