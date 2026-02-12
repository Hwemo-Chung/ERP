/**
 * FR-19: Session Manager Service
 * PRD: 30분 유휴 타임아웃 & 재인증 (폼 데이터 보존)
 *
 * 기능:
 * - 유휴 시간 추적
 * - 세션 만료 경고
 * - 폼 데이터 자동 저장 (LocalStorage)
 * - 세션 연장
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { AuthService } from '@core/services/auth.service';
import { LoggerService } from '@core/services/logger.service';

export interface SessionState {
  isAuthenticated: boolean;
  lastActivity: Date;
  expiresAt: Date;
  preservedFormData: Record<string, unknown>;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 만료 5분 전 경고
const STORAGE_KEY = 'session_preserved_data';

@Injectable({
  providedIn: 'root',
})
export class SessionManagerService {
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly authService = inject(AuthService);
  private readonly logger = inject(LoggerService);

  // State
  private _state = signal<SessionState>({
    isAuthenticated: false,
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + IDLE_TIMEOUT_MS),
    preservedFormData: {},
  });

  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  // Public signals
  readonly state = this._state.asReadonly();
  readonly remainingSeconds = signal(IDLE_TIMEOUT_MS / 1000);
  readonly showWarning = signal(false);

  readonly isExpired = computed(() => {
    return new Date() > this._state().expiresAt;
  });

  constructor() {
    this.setupActivityListeners();
    this.loadPreservedData();
  }

  /**
   * 세션 시작 (로그인 후 호출)
   */
  startSession() {
    this._state.update((s) => ({
      ...s,
      isAuthenticated: true,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + IDLE_TIMEOUT_MS),
    }));
    this.resetTimers();
    this.startCountdown();
  }

  /**
   * 세션 종료 (로그아웃)
   */
  endSession(clearPreserved = true) {
    this.clearTimers();
    if (clearPreserved) {
      this.clearPreservedData();
    }
    this._state.update((s) => ({
      ...s,
      isAuthenticated: false,
    }));
  }

  /**
   * 세션 연장 (사용자 활동 또는 명시적 연장)
   */
  extendSession() {
    this._state.update((s) => ({
      ...s,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + IDLE_TIMEOUT_MS),
    }));
    this.showWarning.set(false);
    this.resetTimers();
    this.remainingSeconds.set(IDLE_TIMEOUT_MS / 1000);
  }

  /**
   * 폼 데이터 보존 (현재 페이지의 입력값)
   */
  preserveFormData(key: string, data: unknown) {
    this._state.update((s) => ({
      ...s,
      preservedFormData: {
        ...s.preservedFormData,
        [key]: data,
      },
    }));
    this.saveToStorage();
  }

  /**
   * 보존된 폼 데이터 가져오기
   */
  getPreservedData<T>(key: string): T | null {
    return (this._state().preservedFormData[key] as T) ?? null;
  }

  /**
   * 특정 키의 보존 데이터 삭제
   */
  clearPreservedData(key?: string) {
    if (key) {
      this._state.update((s) => {
        const { [key]: _, ...rest } = s.preservedFormData;
        return { ...s, preservedFormData: rest };
      });
    } else {
      this._state.update((s) => ({
        ...s,
        preservedFormData: {},
      }));
    }
    this.saveToStorage();
  }

  /**
   * 재인증 후 세션 복구
   * FR-19: Refresh tokens and restore session with preserved form data
   */
  async restoreSession(): Promise<boolean> {
    try {
      // Call token refresh API
      const success = await this.authService.refreshTokens();

      if (success) {
        // Restart session tracking
        this.startSession();

        // Restore any preserved form data from storage
        this.loadPreservedData();

        return true;
      } else {
        // Token refresh failed - redirect to login
        await this.authService.logout();
        return false;
      }
    } catch (error) {
      this.logger.error('[SessionManager] Failed to restore session:', error);
      await this.authService.logout();
      return false;
    }
  }

  // Private methods
  private setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => {
      document.addEventListener(event, () => this.onUserActivity(), { passive: true });
    });
  }

  private onUserActivity() {
    if (!this._state().isAuthenticated) return;

    // 경고 상태가 아닐 때만 자동 연장
    if (!this.showWarning()) {
      this.extendSession();
    }
  }

  private resetTimers() {
    this.clearTimers();

    // 경고 타이머 설정
    this.warningTimer = setTimeout(() => {
      this.showWarning.set(true);
      this.openWarningModal();
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    // 만료 타이머 설정
    this.activityTimer = setTimeout(() => {
      this.handleSessionExpired();
    }, IDLE_TIMEOUT_MS);
  }

  private clearTimers() {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private startCountdown() {
    this.countdownInterval = setInterval(() => {
      const remaining = Math.max(0, this._state().expiresAt.getTime() - Date.now());
      this.remainingSeconds.set(Math.floor(remaining / 1000));
    }, 1000);
  }

  private async openWarningModal() {
    // SessionTimeoutModalComponent를 동적으로 로드
    const { SessionTimeoutModalComponent } =
      await import('../components/session-timeout-modal/session-timeout-modal.component');

    const modal = await this.modalCtrl.create({
      component: SessionTimeoutModalComponent,
      backdropDismiss: false,
      cssClass: 'session-timeout-modal',
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data?.action === 'extend') {
      this.extendSession();
    } else if (data?.action === 'logout') {
      this.handleSessionExpired();
    }
  }

  private handleSessionExpired() {
    this.saveToStorage(); // 마지막으로 데이터 저장
    this.endSession(false); // 보존 데이터는 유지
    this.router.navigate(['/auth/login'], {
      queryParams: { sessionExpired: true },
    });
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state().preservedFormData));
    } catch (e) {
      this.logger.error('Failed to save preserved data:', e);
    }
  }

  private loadPreservedData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this._state.update((s) => ({
          ...s,
          preservedFormData: JSON.parse(stored),
        }));
      }
    } catch (e) {
      this.logger.error('Failed to load preserved data:', e);
    }
  }
}
