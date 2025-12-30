// apps/web/src/app/features/reports/pages/export-page/export-page.page.ts
// Data export feature page - ECOAS, CSV, PDF export
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
    CommonModule, FormsModule, TranslateModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
    IonLabel, IonButton, IonIcon, IonRadioGroup, IonRadio, IonSpinner,
    IonDatetimeButton, IonModal, IonDatetime,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/reports"></ion-back-button></ion-buttons>
        <!-- 데이터 내보내기 타이틀 -->
        <ion-title>{{ 'REPORTS.EXPORT.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Date Range - 기간 선택 -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ 'REPORTS.EXPORT.DATE_SELECT' | translate }}</ion-card-title></ion-card-header>
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

      <!-- Export Type - 내보내기 유형 -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ 'REPORTS.EXPORT.TYPE_SELECT' | translate }}</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-radio-group [value]="selectedType()" (ionChange)="selectedType.set($any($event).detail.value)">
            <ion-item>
              <ion-radio value="ecoas" slot="start"></ion-radio>
              <ion-label><h3>{{ 'REPORTS.EXPORT.TYPE_ECOAS' | translate }}</h3><p>{{ 'REPORTS.EXPORT.TYPE_ECOAS_DESC' | translate }}</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="completed" slot="start"></ion-radio>
              <ion-label><h3>{{ 'REPORTS.EXPORT.TYPE_COMPLETED' | translate }}</h3><p>{{ 'REPORTS.EXPORT.TYPE_COMPLETED_DESC' | translate }}</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="pending" slot="start"></ion-radio>
              <ion-label><h3>{{ 'REPORTS.EXPORT.TYPE_PENDING' | translate }}</h3><p>{{ 'REPORTS.EXPORT.TYPE_PENDING_DESC' | translate }}</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="waste" slot="start"></ion-radio>
              <ion-label><h3>{{ 'REPORTS.EXPORT.TYPE_WASTE' | translate }}</h3><p>{{ 'REPORTS.EXPORT.TYPE_WASTE_DESC' | translate }}</p></ion-label>
            </ion-item>
            <ion-item>
              <ion-radio value="raw" slot="start"></ion-radio>
              <ion-label><h3>{{ 'REPORTS.EXPORT.TYPE_RAW' | translate }}</h3><p>{{ 'REPORTS.EXPORT.TYPE_RAW_DESC' | translate }}</p></ion-label>
            </ion-item>
          </ion-radio-group>
        </ion-card-content>
      </ion-card>

      <!-- File Format - 파일 형식 -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ 'REPORTS.EXPORT.FORMAT_SELECT' | translate }}</ion-card-title></ion-card-header>
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

      <!-- Export Button - 내보내기 버튼 -->
      <ion-button expand="block" [disabled]="isExporting()" (click)="exportData()">
        @if (isExporting()) {
          <ion-spinner name="crescent" slot="start"></ion-spinner>
          {{ 'REPORTS.EXPORT.PROCESSING' | translate }}
        } @else {
          <ion-icon name="download-outline" slot="start"></ion-icon>
          {{ 'REPORTS.EXPORT.EXPORT_BTN' | translate }}
        }
      </ion-button>

      <!-- Export Status - 내보내기 상태 -->
      @if (exportResult()) {
        <ion-card [color]="exportResult()!.status === 'completed' ? 'success' : exportResult()!.status === 'error' ? 'danger' : 'warning'">
          <ion-card-content>
            @switch (exportResult()!.status) {
              @case ('pending') { <p>⏳ {{ 'REPORTS.EXPORT.STATUS_PENDING' | translate }}</p> }
              @case ('processing') { <p>🔄 {{ 'REPORTS.EXPORT.STATUS_PROCESSING' | translate }}</p> }
              @case ('completed') {
                <p>✅ {{ 'REPORTS.EXPORT.STATUS_COMPLETED' | translate }}</p>
                @if (exportResult()!.downloadUrl) {
                  <ion-button expand="block" fill="outline" (click)="downloadFile()">
                    <ion-icon name="download-outline" slot="start"></ion-icon>
                    {{ exportResult()!.fileName || ('REPORTS.EXPORT.DOWNLOAD' | translate) }}
                  </ion-button>
                }
              }
              @case ('error') { <p>❌ {{ 'REPORTS.EXPORT.STATUS_ERROR' | translate }}: {{ exportResult()!.error }}</p> }
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
  private readonly translate = inject(TranslateService);

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

  // 데이터 내보내기 실행
  async exportData() {
    this.isExporting.set(true);
    this.exportResult.set(null);

    // TranslateService 참조 캡처 (async 핸들러 내 this 문제 방지)
    const translateService = this.translate;
    const toastController = this.toastCtrl;

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
        const toast = await toastController.create({
          message: translateService.instant('REPORTS.EXPORT.SUCCESS'),
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      }
    } catch (error) {
      this.exportResult.set({
        id: '',
        status: 'error',
        error: translateService.instant('REPORTS.EXPORT.REQUEST_FAILED'),
      });
      const toast = await toastController.create({
        message: translateService.instant('REPORTS.EXPORT.FAILED'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isExporting.set(false);
    }
  }

  // 내보내기 상태 폴링
  private pollExportStatus(exportId: string) {
    const translateService = this.translate;
    const toastController = this.toastCtrl;

    const poll = () => {
      this.reportsService.getExportStatus(exportId).subscribe({
        next: async (result) => {
          this.exportResult.set(result);
          if (result.status === 'pending' || result.status === 'processing') {
            setTimeout(poll, 2000);
          } else if (result.status === 'completed') {
            const toast = await toastController.create({
              message: translateService.instant('REPORTS.EXPORT.SUCCESS'),
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
            error: translateService.instant('REPORTS.EXPORT.STATUS_CHECK_FAILED'),
          });
        },
      });
    };
    setTimeout(poll, 2000);
  }

  // 파일 다운로드
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
