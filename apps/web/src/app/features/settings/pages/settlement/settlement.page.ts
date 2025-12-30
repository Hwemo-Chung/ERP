// apps/web/src/app/features/settings/pages/settlement/settlement.page.ts
// 정산 관리 페이지 - Settlement management page
import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
  IonLabel, IonBadge, IonButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { lockClosedOutline, lockOpenOutline, refreshOutline } from 'ionicons/icons';
import { SettlementService, SettlementPeriod } from '../../../../core/services/settlement.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settlement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, TranslateModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
    IonLabel, IonBadge, IonButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/settings"></ion-back-button></ion-buttons>
        <!-- 정산 관리 타이틀 -->
        <ion-title>{{ 'SETTINGS.SETTLEMENT.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Current Period - 현재 정산 기간 -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ 'SETTINGS.SETTLEMENT.CURRENT_PERIOD' | translate }}</ion-card-title></ion-card-header>
        <ion-card-content>
          @if (isLoading()) {
            <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
          } @else if (currentPeriod()) {
            <p><strong>{{ 'SETTINGS.SETTLEMENT.DATE_RANGE' | translate }}:</strong> {{ formatDate(currentPeriod()!.periodStart) }} ~ {{ formatDate(currentPeriod()!.periodEnd) }}</p>
            <p><strong>{{ 'SETTINGS.SETTLEMENT.STATUS.LABEL' | translate }}:</strong> <ion-badge [color]="currentPeriod()!.status === 'OPEN' ? 'success' : 'danger'">{{ (currentPeriod()!.status === 'OPEN' ? 'SETTINGS.SETTLEMENT.STATUS.OPEN' : 'SETTINGS.SETTLEMENT.STATUS.LOCKED') | translate }}</ion-badge></p>
            @if (currentPeriod()!.orderCount !== undefined) { <p><strong>{{ 'SETTINGS.SETTLEMENT.ORDER_COUNT' | translate }}:</strong> {{ 'SETTINGS.SETTLEMENT.ORDER_COUNT_VALUE' | translate:{ count: currentPeriod()!.orderCount } }}</p> }
            @if (currentPeriod()!.lockedAt) { <p class="sub"><ion-icon name="lock-closed-outline"></ion-icon> {{ formatDateTime(currentPeriod()!.lockedAt!) }} {{ 'SETTINGS.SETTLEMENT.LOCKED_AT' | translate }}</p> }
            @if (currentPeriod()!.status === 'OPEN' && canManage()) {
              <ion-button expand="block" color="warning" (click)="lockPeriod(currentPeriod()!)">
                <ion-icon name="lock-closed-outline" slot="start"></ion-icon>{{ 'SETTINGS.SETTLEMENT.LOCK_BUTTON' | translate }}
              </ion-button>
            }
          } @else { <p class="empty">{{ 'SETTINGS.SETTLEMENT.LOAD_ERROR' | translate }}</p> }
        </ion-card-content>
      </ion-card>

      <!-- History - 정산 이력 -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ 'SETTINGS.SETTLEMENT.HISTORY' | translate }}</ion-card-title></ion-card-header>
        <ion-card-content>
          @if (periods().length > 0) {
            <ion-list>
              @for (p of periods(); track p.id) {
                <ion-item>
                  <ion-icon [name]="p.status === 'LOCKED' ? 'lock-closed-outline' : 'lock-open-outline'" slot="start" [color]="p.status === 'LOCKED' ? 'danger' : 'success'"></ion-icon>
                  <ion-label><h3>{{ formatDate(p.periodStart) }} ~ {{ formatDate(p.periodEnd) }}</h3><p>{{ 'SETTINGS.SETTLEMENT.ORDER_COUNT_VALUE' | translate:{ count: p.orderCount || 0 } }}</p></ion-label>
                  @if (p.status === 'OPEN' && canManage()) { <ion-button slot="end" fill="outline" size="small" (click)="lockPeriod(p)">{{ 'SETTINGS.SETTLEMENT.CLOSE_BUTTON' | translate }}</ion-button> }
                  @else if (p.status === 'LOCKED' && isHqAdmin()) { <ion-button slot="end" fill="outline" size="small" color="warning" (click)="unlockPeriod(p)">{{ 'SETTINGS.SETTLEMENT.UNLOCK_BUTTON' | translate }}</ion-button> }
                </ion-item>
              }
            </ion-list>
            @if (hasMore()) { <ion-button expand="block" fill="clear" (click)="loadMore()">{{ 'COMMON.LOAD_MORE' | translate }}</ion-button> }
          } @else if (!isLoading()) { <p class="empty">{{ 'SETTINGS.SETTLEMENT.NO_HISTORY' | translate }}</p> }
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: [`.center{display:flex;justify-content:center;padding:24px} .sub{display:flex;align-items:center;gap:4px;color:var(--ion-color-medium);font-size:13px} .empty{text-align:center;color:var(--ion-color-medium);padding:24px} ion-card-title{font-size:16px}`],
})
export class SettlementPage implements OnInit {
  private readonly svc = inject(SettlementService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly currentPeriod = signal<SettlementPeriod | null>(null);
  protected readonly periods = signal<SettlementPeriod[]>([]);
  protected readonly hasMore = signal(false);
  private cursor?: string;

  constructor() { addIcons({ lockClosedOutline, lockOpenOutline, refreshOutline }); }

  ngOnInit() { this.loadData(); }

  async loadData() {
    this.isLoading.set(true);
    try {
      this.svc.getCurrentPeriod().subscribe({ next: p => this.currentPeriod.set(p), error: () => {} });
      this.svc.getHistory(20).subscribe({
        next: h => { this.periods.set(h.data || []); this.hasMore.set(h.data?.length === 20); this.cursor = h.data?.[h.data.length - 1]?.id; },
        error: () => {},
      });
    } finally { this.isLoading.set(false); }
  }

  async loadMore() {
    if (!this.cursor) return;
    this.svc.getHistory(20, this.cursor).subscribe({
      next: h => { this.periods.update(l => [...l, ...(h.data || [])]); this.hasMore.set(h.data?.length === 20); this.cursor = h.data?.[h.data.length - 1]?.id; },
    });
  }

  async onRefresh(e: any) { await this.loadData(); e.target.complete(); }

  canManage() { const r = this.auth.user()?.roles || []; return r.includes('BRANCH_MANAGER') || r.includes('HQ_ADMIN'); }
  isHqAdmin() { return (this.auth.user()?.roles || []).includes('HQ_ADMIN'); }

  /**
   * 정산 마감 확인
   * Confirm and lock settlement period
   */
  async lockPeriod(p: SettlementPeriod) {
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;
    const start = this.formatDate(p.periodStart);
    const end = this.formatDate(p.periodEnd);
    
    const alert = await this.alertCtrl.create({
      header: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_LOCK.TITLE'),
      message: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_LOCK.MESSAGE', { start, end }),
      buttons: [
        { text: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_LOCK.CANCEL'), role: 'cancel' },
        { text: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_LOCK.CONFIRM'), handler: async () => {
          try {
            const u = await this.svc.lockPeriod(p.id);
            if (this.currentPeriod()?.id === p.id) this.currentPeriod.set(u);
            this.periods.update(l => l.map(x => x.id === p.id ? u : x));
            (await this.toastCtrl.create({ message: translateService.instant('SETTINGS.SETTLEMENT.TOAST.LOCK_SUCCESS'), duration: 2000, color: 'success' })).present();
          } catch { (await this.toastCtrl.create({ message: translateService.instant('SETTINGS.SETTLEMENT.TOAST.ERROR'), duration: 2000, color: 'danger' })).present(); }
        }}],
    });
    await alert.present();
  }

  /**
   * 정산 해제 확인
   * Confirm and unlock settlement period
   */
  async unlockPeriod(p: SettlementPeriod) {
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;
    
    const alert = await this.alertCtrl.create({
      header: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_UNLOCK.TITLE'),
      message: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_UNLOCK.MESSAGE'),
      buttons: [
        { text: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_UNLOCK.CANCEL'), role: 'cancel' },
        { text: translateService.instant('SETTINGS.SETTLEMENT.CONFIRM_UNLOCK.CONFIRM'), handler: async () => {
          try {
            const u = await this.svc.unlockPeriod(p.id);
            if (this.currentPeriod()?.id === p.id) this.currentPeriod.set(u);
            this.periods.update(l => l.map(x => x.id === p.id ? u : x));
            (await this.toastCtrl.create({ message: translateService.instant('SETTINGS.SETTLEMENT.TOAST.UNLOCK_SUCCESS'), duration: 2000, color: 'success' })).present();
          } catch { (await this.toastCtrl.create({ message: translateService.instant('SETTINGS.SETTLEMENT.TOAST.ERROR'), duration: 2000, color: 'danger' })).present(); }
        }}],
    });
    await alert.present();
  }

  formatDate(d: string) { if (!d) return '-'; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; }
  formatDateTime(d: string) { 
    if (!d) return '-'; 
    const lang = this.translate.currentLang || 'ko';
    return new Date(d).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); 
  }
}
