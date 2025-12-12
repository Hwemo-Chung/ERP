/**
 * FR-18: Bulk Operation Service
 * PRD: 일괄 작업 부분 실패 처리
 * 
 * 기능:
 * - 일괄 작업 실행
 * - 부분 실패 처리
 * - 재시도 로직
 * - 결과 집계
 */
import { Injectable, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { BulkOperationItem, BulkOperationResult } from '../components/bulk-operation-result/bulk-operation-result.component';

export interface BulkOperationConfig<T, R> {
  items: T[];
  operationName: string;
  operation: (item: T) => Promise<R>;
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  concurrency?: number;
  continueOnError?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BulkOperationService {
  private modalCtrl = inject(ModalController);

  // State
  readonly isProcessing = signal(false);
  readonly progress = signal(0);
  readonly currentItem = signal<string | null>(null);

  /**
   * 일괄 작업 실행
   */
  async execute<T, R>(config: BulkOperationConfig<T, R>): Promise<BulkOperationResult> {
    const {
      items,
      operationName,
      operation,
      getItemId,
      getItemLabel,
      concurrency = 1,
      continueOnError = true,
    } = config;

    this.isProcessing.set(true);
    this.progress.set(0);

    const results: BulkOperationItem[] = [];
    let processed = 0;

    try {
      if (concurrency === 1) {
        // 순차 처리
        for (const item of items) {
          this.currentItem.set(getItemLabel(item));
          
          try {
            await operation(item);
            results.push({
              id: getItemId(item),
              label: getItemLabel(item),
              success: true,
            });
          } catch (error) {
            results.push({
              id: getItemId(item),
              label: getItemLabel(item),
              success: false,
              error: error instanceof Error ? error.message : '알 수 없는 오류',
            });
            
            if (!continueOnError) break;
          }

          processed++;
          this.progress.set(Math.round((processed / items.length) * 100));
        }
      } else {
        // 병렬 처리 (배치)
        for (let i = 0; i < items.length; i += concurrency) {
          const batch = items.slice(i, i + concurrency);
          const batchResults = await Promise.allSettled(
            batch.map(async item => {
              this.currentItem.set(getItemLabel(item));
              await operation(item);
              return { item, success: true as const };
            })
          );

          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const item = batch[j];
            
            if (result.status === 'fulfilled') {
              results.push({
                id: getItemId(item),
                label: getItemLabel(item),
                success: true,
              });
            } else {
              results.push({
                id: getItemId(item),
                label: getItemLabel(item),
                success: false,
                error: result.reason?.message ?? '알 수 없는 오류',
              });
            }
          }

          processed += batch.length;
          this.progress.set(Math.round((processed / items.length) * 100));
        }
      }
    } finally {
      this.isProcessing.set(false);
      this.currentItem.set(null);
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return {
      operation: operationName,
      totalCount: items.length,
      successCount,
      failedCount,
      items: results,
    };
  }

  /**
   * 결과 다이얼로그 표시
   */
  async showResultDialog(result: BulkOperationResult): Promise<'close' | 'retry'> {
    const { BulkOperationResultComponent } = await import(
      '../components/bulk-operation-result/bulk-operation-result.component'
    );

    const modal = await this.modalCtrl.create({
      component: BulkOperationResultComponent,
      componentProps: { result },
      cssClass: 'bulk-operation-result-modal',
    });

    await modal.present();
    const { data } = await modal.onDidDismiss<'close' | 'retry'>();
    
    return data ?? 'close';
  }

  /**
   * 실패한 항목만 재시도
   */
  async retryFailed<T, R>(
    failedItems: T[],
    config: Omit<BulkOperationConfig<T, R>, 'items'>
  ): Promise<BulkOperationResult> {
    return this.execute({
      ...config,
      items: failedItems,
    });
  }
}
