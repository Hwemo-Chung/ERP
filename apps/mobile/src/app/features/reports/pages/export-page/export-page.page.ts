// apps/web/src/app/features/reports/pages/export-page/export-page.page.ts
import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
  IonLabel, IonButton, IonIcon, IonRadioGroup, IonRadio, IonSpinner,
  IonDatetimeButton, IonModal, IonDatetime,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { downloadOutline, documentOutline, gridOutline, calendarOutline } from 'ionicons/icons';
import { ReportsService, ExportRequest, ExportResult } from '../../../../core/services/reports.service';
import { AuthService } from '../../../../core/services/auth.service';

type ExportType = 'ecoas' | 'completed' | 'pending' | 'waste' | 'raw';
type FileFormat = 'csv' | 'xlsx' | 'pdf';

@Component({
  selector: 'app-export-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
    IonLabel, IonButton, IonIcon, IonRadioGroup, IonRadio, IonSpinner,
    IonDatetimeButton, IonModal, IonDatetime,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/reports"></ion-back-button></ion-buttons>
        <ion-title>데이터 내보내기</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Date Range -->
      <ion-card>
        <ion-card-header><ion-card-title>기간 선택</ion-card-title></ion-card-header>
        <ion-card-content>
          <div class="date-range">
            <ion-datetime-button datetime="exportStartDate"></ion-datetime-button>
            <span>~</span>
            <ion-datetime-button datetime="exportEndDate"></ion-datetime-button>
          </div>
          <ion-modal [keepContentsMounted]="true">
            <ng-template>
              <ion-datetime id="exportStartDate" presentation="date" [value]="dateFrom()" (ionChange)="dateFrom.set($any($event).detail.value)"></ion-datetime>
            </ng-template>
          </ion-modal>
          <ion-modal [keepContentsMounted]="true">
            <ng-template>
              <ion-datetime id="exportEndDate" presentation="date" [value]="dateTo()" (ionChange)="dateTo.set($any($event).detail.value)"></ion-datetime>
            </ng-template>
          </ion-modal>
        </ion-card-content>
      </ion-card>

      <!-- Export Type -->
      <ion-card>
        <ion-card-header><ion-card-title>내보내기 유형</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-radio-group [value]="selectedType()" (ionChange)="selectedType.set($any($event).detail.value)">
            <ion-item>
              <ion-radio value="ecoas" slot="start"></ion-radio>
              <ion-label><h3>ECOAS 포맷</h3><p>레거시 시스템 호환 형식</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="completed" slot="start"></ion-radio>
              <ion-label><h3>설치완료 리스트</h3><p>완료된 주문 목록</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="pending" slot="start"></ion-radio>
              <ion-label><h3>미완료 리스트</h3><p>진행중/대기 주문</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="waste" slot="start"></ion-radio>
              <ion-label><h3>폐가전 회수 집계</h3><p>회수 현황 통계</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="raw" slot="start"></ion-radio>
              <ion-label><h3>Raw 데이터</h3><p>전체 데이터 내보내기</p></ion-label>
            </ion-item>
          </ion-radio-group>
        </ion-card-content>
      </ion-card>

      <!-- File Format -->
      <ion-card>
        <ion-card-header><ion-card-title>파일 형식</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-radio-group [value]="fileFormat()" (ionChange)="fileFormat.set($any($event).detail.value)">
            <ion-item>
              <ion-radio value="csv" slot="start"></ion-radio>
              <ion-label>CSV</ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="xlsx" slot="start"></ion-radio>
              <ion-label>Excel (XLSX)</ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="pdf" slot="start"></ion-radio>
              <ion-label>PDF</ion-label>
            </ion-item>
          </ion-radio-group>
        </ion-card-content>
      </ion-card>

      <!-- Export Button -->
      <ion-button expand="block" [disabled]="isExporting()" (click)="exportData()">
        @if (isExporting()) {
          <ion-spinner name="crescent" slot="start"></ion-spinner>
          처리중...
        } @else {
          <ion-icon name="download-outline" slot="start"></ion-icon>
          내보내기
        }
      </ion-button>

      <!-- Export Status -->
      @if (exportResult()) {
        <ion-card [color]="exportResult()!.status === 'completed' ? 'success' : exportResult()!.status === 'error' ? 'danger' : 'warning'">
          <ion-card-content>
            @switch (exportResult()!.status) {
              @case ('pending') { <p>⏳ 내보내기 준비 중...</p> }
              @case ('processing') { <p>🔄 파일 생성 중...</p> }
              @case ('completed') {
                <p>✅ 내보내기 완료!</p>
                @if (exportResult()!.downloadUrl) {
                  <ion-button expand="block" fill="outline" (click)="downloadFile()">
                    <ion-icon name="download-outline" slot="start"></ion-icon>
                    {{ exportResult()!.fileName || '다운로드' }}
                  </ion-button>
                }
              }
              @case ('error') { <p>❌ 오류: {{ exportResult()!.error }}</p> }
            }
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: [`
    .date-range { display: flex; align-items: center; justify-content: center; gap: 8px; }
    ion-card-title { font-size: 16px; }
  `],
})
export class ExportPagePage {
  private readonly reportsService = inject(ReportsService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly selectedType = signal<ExportType>('ecoas');
  protected readonly fileFormat = signal<FileFormat>('csv');
  protected readonly dateFrom = signal(this.getDefaultDateFrom());
  protected readonly dateTo = signal(new Date().toISOString());
  protected readonly isExporting = signal(false);
  protected readonly exportResult = signal<ExportResult | null>(null);

  constructor() {
    addIcons({ downloadOutline, documentOutline, gridOutline, calendarOutline });
  }

  private getDefaultDateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }

  async exportData() {
    this.isExporting.set(true);
    this.exportResult.set(null);

    const request: ExportRequest = {
      type: this.selectedType(),
      format: this.fileFormat(),
      branchCode: this.authService.user()?.branchCode,
      dateFrom: this.dateFrom().split('T')[0],
      dateTo: this.dateTo().split('T')[0],
    };

    try {
      const result = await this.reportsService.requestExport(request);
      this.exportResult.set(result);

      // Poll for completion if pending/processing
      if (result.status === 'pending' || result.status === 'processing') {
        this.pollExportStatus(result.id);
      } else if (result.status === 'completed') {
        const toast = await this.toastCtrl.create({
          message: '내보내기 완료!',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      }
    } catch (error) {
      this.exportResult.set({
        id: '',
        status: 'error',
        error: '내보내기 요청 실패',
      });
      const toast = await this.toastCtrl.create({
        message: '내보내기 실패',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isExporting.set(false);
    }
  }

  private pollExportStatus(exportId: string) {
    const poll = () => {
      this.reportsService.getExportStatus(exportId).subscribe({
        next: async (result) => {
          this.exportResult.set(result);
          if (result.status === 'pending' || result.status === 'processing') {
            setTimeout(poll, 2000);
          } else if (result.status === 'completed') {
            const toast = await this.toastCtrl.create({
              message: '내보내기 완료!',
              duration: 2000,
              color: 'success',
            });
            await toast.present();
          }
        },
        error: () => {
          this.exportResult.set({
            id: exportId,
            status: 'error',
            error: '상태 확인 실패',
          });
        },
      });
    };
    setTimeout(poll, 2000);
  }

  downloadFile() {
    const result = this.exportResult();
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    } else if (result?.id) {
      this.reportsService.downloadExport(result.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.fileName || `export_${result.id}.${this.fileFormat()}`;
          a.click();
          URL.revokeObjectURL(url);
        },
      });
    }
  }
}
