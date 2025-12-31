/**
 * FR-17: Conflict Resolver Service
 * PRD: Optimistic Locking 충돌 해결
 * 
 * 기능:
 * - 버전 충돌 감지
 * - 충돌 해결 다이얼로그 표시
 * - 강제 덮어쓰기 / 새로고침 선택
 */
import { Injectable, inject, signal } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { ConflictData, ConflictResolution } from '../components/conflict-dialog/conflict-dialog.component';

export interface VersionedEntity {
  id: string;
  version: number;
  updatedAt: Date;
}

export interface ConflictError {
  code: 'CONFLICT';
  message: string;
  serverVersion: number;
  serverData: Record<string, unknown>;
  clientVersion: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConflictResolverService {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  // 현재 진행 중인 충돌 해결
  readonly isResolving = signal(false);

  /**
   * API 응답에서 충돌 에러인지 확인
   */
  isConflictError(error: unknown): error is ConflictError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as ConflictError).code === 'CONFLICT'
    );
  }

  /**
   * 충돌 해결 다이얼로그 표시
   */
  async resolveConflict<T extends VersionedEntity>(
    entityName: string,
    localData: T,
    serverData: T,
    fieldLabels?: Partial<Record<keyof T, string>>
  ): Promise<ConflictResolution> {
    this.isResolving.set(true);

    try {
      const { ConflictDialogComponent } = await import(
        '../components/conflict-dialog/conflict-dialog.component'
      );

      // 변경된 필드 찾기
      const changedFields = this.findChangedFields(
        localData as unknown as Record<string, unknown>, 
        serverData as unknown as Record<string, unknown>
      );
      
      const conflictData = {
        entityName,
        localVersion: localData.version,
        serverVersion: serverData.version,
        localUpdatedAt: localData.updatedAt,
        serverUpdatedAt: serverData.updatedAt,
        changedFields: changedFields.map(field => ({
          fieldName: field,
          fieldLabel: (fieldLabels as Record<string, string>)?.[field] ?? field,
          localValue: (localData as Record<string, unknown>)[field],
          serverValue: (serverData as Record<string, unknown>)[field],
        })),
      };

      const modal = await this.modalCtrl.create({
        component: ConflictDialogComponent,
        componentProps: { data: conflictData },
        backdropDismiss: false,
        cssClass: 'conflict-dialog-modal',
      });

      await modal.present();
      const { data } = await modal.onDidDismiss<ConflictResolution>();

      return data ?? 'cancel';
    } finally {
      this.isResolving.set(false);
    }
  }

  /**
   * 자동 충돌 해결 (서버 데이터 우선)
   */
  async autoResolveServerWins<T>(serverData: T): Promise<T> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('CONFLICT.SERVER_WINS_MESSAGE'),
      duration: 3000,
      color: 'warning',
    });
    await toast.present();
    return serverData;
  }

  /**
   * 강제 덮어쓰기 요청 생성
   */
  createForceUpdateRequest<T extends VersionedEntity>(
    data: T, 
    newVersion: number
  ): T & { _forceUpdate: true; _expectedVersion: number } {
    return {
      ...data,
      version: newVersion,
      _forceUpdate: true as const,
      _expectedVersion: newVersion,
    };
  }

  /**
   * 두 객체 간 변경된 필드 찾기
   */
  private findChangedFields(
    local: Record<string, unknown>, 
    server: Record<string, unknown>
  ): string[] {
    const changed: string[] = [];
    const skipFields = ['version', 'updatedAt', 'createdAt', 'id'];

    for (const key of Object.keys(local)) {
      if (skipFields.includes(key)) continue;
      
      const localVal = local[key];
      const serverVal = server[key];

      if (!this.deepEqual(localVal, serverVal)) {
        changed.push(key);
      }
    }

    return changed;
  }

  /**
   * 깊은 비교
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;

    if (typeof a === 'object') {
      // Check array vs object mismatch
      const aIsArray = Array.isArray(a);
      const bIsArray = Array.isArray(b);
      if (aIsArray !== bIsArray) return false;

      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      return aKeys.every(key => this.deepEqual(aObj[key], bObj[key]));
    }

    return false;
  }
}
