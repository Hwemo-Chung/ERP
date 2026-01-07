/**
 * Order Assignment Modal
 * Allows assigning an order to an installer with appointment date
 */

import { Component, inject, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonLabel,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonDatetimeButton,
  IonDatetime,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';

import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { Order } from '../../../../store/orders/orders.models';
import { Installer } from '../../../../store/installers/installers.models';

@Component({
  selector: 'app-order-assign-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonLabel,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonDatetimeButton,
    IonDatetime,
    IonIcon,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'ORDERS.ASSIGN_MODAL.TITLE' | translate }}</ion-title>
        <ion-button slot="end" fill="clear" (click)="dismiss()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Order Info (Read-only) -->
        <div class="order-info">
          <h2>{{ order?.orderNo }}</h2>
          <p>{{ order?.customerName }}</p>
          <p class="address">{{ order?.customerAddress }}</p>
        </div>

        <!-- Installer Selection -->
        <ion-item>
          <ion-label position="stacked">{{ 'ORDERS.ASSIGN_MODAL.INSTALLER_LABEL' | translate }}</ion-label>
          <ion-select formControlName="installerId" [placeholder]="'ORDERS.ASSIGN_MODAL.INSTALLER_PLACEHOLDER' | translate">
            @for (installer of installersStore.filteredInstallers(); track installer.id) {
              <ion-select-option [value]="installer.id">
                {{ installer.name }} ({{ installer.assignedOrderCount || 0 }}{{ 'COMMON.COUNT_SUFFIX' | translate }})
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <!-- Appointment Date -->
        <ion-item>
          <ion-label position="stacked">{{ 'ORDERS.ASSIGN_MODAL.DATE_LABEL' | translate }}</ion-label>
          <ion-datetime-button datetime="appointmentDate"></ion-datetime-button>
          <ion-datetime
            id="appointmentDate"
            formControlName="appointmentDate"
            presentation="date"
            [min]="today()"
          ></ion-datetime>
        </ion-item>

        <!-- Appointment Slot (Optional) -->
        <ion-item>
          <ion-label position="stacked">{{ 'ORDERS.ASSIGN_MODAL.SLOT_LABEL' | translate }}</ion-label>
          <ion-select formControlName="appointmentSlot" [placeholder]="'ORDERS.ASSIGN_MODAL.SLOT_PLACEHOLDER' | translate">
            <ion-select-option value="09:00">09:00 - 12:00</ion-select-option>
            <ion-select-option value="12:00">12:00 - 15:00</ion-select-option>
            <ion-select-option value="15:00">15:00 - 18:00</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Error message -->
        @if (form.get('installerId')?.hasError('required') && form.get('installerId')?.touched) {
          <div class="error-message">{{ 'ORDERS.ASSIGN_MODAL.ERROR.INSTALLER_REQUIRED' | translate }}</div>
        }

        @if (isSubmitting()) {
          <div class="loading-overlay">
            <ion-spinner></ion-spinner>
          </div>
        }
      </form>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button slot="start" fill="outline" (click)="dismiss()">
          {{ 'COMMON.BUTTON.CANCEL' | translate }}
        </ion-button>
        <ion-button slot="end" [disabled]="!form.valid || isSubmitting()" (click)="onSubmit()">
          <ion-icon name="checkmark-outline"></ion-icon>
          {{ 'ORDERS.ASSIGN_MODAL.ASSIGN_BUTTON' | translate }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .order-info {
      background: var(--ion-color-light);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;

      h2 {
        margin: 0 0 8px 0;
        font-weight: 600;
      }

      p {
        margin: 4px 0;
        font-size: 14px;
        color: var(--ion-color-medium);

        &.address {
          font-size: 13px;
        }
      }
    }

    .error-message {
      color: var(--ion-color-danger);
      font-size: 12px;
      padding: 8px 0;
    }

    .loading-overlay {
      display: flex;
      justify-content: center;
      align-items: center;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 1000;
    }
  `],
})
export class OrderAssignModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  private readonly translate = inject(TranslateService);
  readonly ordersStore = inject(OrdersStore);
  readonly installersStore = inject(InstallersStore);
  readonly uiStore = inject(UIStore);

  order: Order | null = null;
  form!: FormGroup;
  isSubmitting = signal(false);

  constructor() {
    addIcons({ checkmarkOutline, closeOutline });
    this.form = this.fb.group({
      installerId: ['', Validators.required],
      appointmentDate: ['', Validators.required],
      appointmentSlot: [''],
    });
  }

  ngOnInit(): void {
    // Get selected order from store
    this.order = this.ordersStore.selectedOrder();

    if (!this.order) {
      this.dismiss();
      return;
    }

    // Pre-fill form if already assigned
    if (this.order.installerId) {
      this.form.patchValue({
        installerId: this.order.installerId,
        appointmentDate: this.order.appointmentDate,
        appointmentSlot: this.order.appointmentSlot || '',
      });
    }

    // Load installers for this branch
    const branchCode = this.order.branchCode;
    this.installersStore.loadInstallers(branchCode);
  }

  today(): string {
    return new Date().toISOString().split('T')[0];
  }

  async onSubmit(): Promise<void> {
    if (!this.form.valid || !this.order) return;

    this.isSubmitting.set(true);
    const successMsg = this.translate.instant('ORDERS.ASSIGN_MODAL.SUCCESS.ASSIGNED');
    const errorMsg = this.translate.instant('ORDERS.ASSIGN_MODAL.ERROR.ASSIGN_FAILED');

    try {
      const { installerId, appointmentDate } = this.form.value;

      await this.ordersStore.assignOrder(this.order.id, installerId, appointmentDate);

      this.uiStore.showToast(successMsg, 'success');
      await this.modalCtrl.dismiss(null, 'confirm');
    } catch (error) {
      this.uiStore.showToast(errorMsg, 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
