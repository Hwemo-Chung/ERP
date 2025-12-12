/**
 * Order Completion Modal
 * Captures serial numbers, waste codes, and completion photos
 * Per SDD section 5.3 - Capacitor Native Camera integration
 */

import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonLabel,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonImage,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkOutline,
  closeOutline,
  cameraOutline,
  trashOutline,
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { OrdersStore } from '../../../../store/orders/orders.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { Order, OrderLine } from '../../../../store/orders/orders.models';

interface WasteCode {
  code: string;
  name: string;
}

@Component({
  selector: 'app-order-completion-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonLabel,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonIcon,
    IonSpinner,
    IonCard,
    IonCardContent,
    IonImage,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>설치 완료</ion-title>
        <ion-button slot="end" fill="clear" (click)="dismiss()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form [formGroup]="form">
        <!-- Order Header -->
        <div class="order-header">
          <h2>{{ order?.erpOrderNumber }}</h2>
          <p>{{ order?.customerName }} - {{ order?.customerAddress }}</p>
        </div>

        <!-- Product Serial Numbers Section -->
        <div class="section">
          <h3>상품 시리얼 번호</h3>
          <div formArrayName="serials">
            @for (line of orderLines(); let i = $index; track line.id) {
              <ion-item [formGroupName]="i" class="serial-item">
                <ion-label position="stacked">
                  {{ line.productName }} (수량: {{ line.quantity }})
                </ion-label>
                <ion-input
                  formControlName="serialNumber"
                  placeholder="시리얼 번호 입력"
                  [maxlength]="20"
                ></ion-input>
                <span slot="end" class="count">
                  {{ i + 1 }}/{{ orderLines().length }}
                </span>
              </ion-item>
            }
          </div>
        </div>

        <!-- Waste Pickup Section -->
        <div class="section">
          <h3>폐기 기기 수거</h3>
          <div formArrayName="waste">
            @for (waste of wasteArray().controls; let i = $index; track i) {
              <ion-item [formGroupName]="i" class="waste-item">
                <ion-label position="stacked">폐기 기기 코드</ion-label>
                <ion-select formControlName="code" placeholder="코드 선택">
                  @for (code of wasteCodes(); track code.code) {
                    <ion-select-option [value]="code.code">
                      {{ code.code }} - {{ code.name }}
                    </ion-select-option>
                  }
                </ion-select>
                <ion-input
                  formControlName="quantity"
                  type="number"
                  min="1"
                  placeholder="수량"
                  slot="end"
                ></ion-input>
                <ion-button
                  slot="end"
                  fill="clear"
                  color="danger"
                  size="small"
                  (click)="removeWaste(i)"
                >
                  <ion-icon name="trash-outline"></ion-icon>
                </ion-button>
              </ion-item>
            }
          </div>
          <ion-button expand="block" color="light" (click)="addWaste()">
            폐기 기기 추가
          </ion-button>
        </div>

        <!-- Photos Section -->
        <div class="section">
          <h3>설치 사진</h3>
          <div class="photos">
            @for (photo of photos(); track $index) {
              <div class="photo-item">
                <ion-image [src]="photo"></ion-image>
                <ion-button
                  fill="clear"
                  color="danger"
                  (click)="removePhoto($index)"
                >
                  <ion-icon name="close-outline"></ion-icon>
                </ion-button>
              </div>
            }
          </div>
          <ion-button expand="block" (click)="capturePhoto()">
            <ion-icon name="camera-outline"></ion-icon>
            사진 촬영
          </ion-button>
        </div>

        <!-- Notes -->
        <div class="section">
          <ion-item>
            <ion-label position="stacked">특기사항 (선택)</ion-label>
            <ion-textarea
              formControlName="notes"
              placeholder="특이사항을 입력하세요"
              rows="3"
            ></ion-textarea>
          </ion-item>
        </div>

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
          취소
        </ion-button>
        <ion-button
          slot="end"
          [disabled]="!form.valid || isSubmitting()"
          (click)="onSubmit()"
        >
          <ion-icon name="checkmark-outline"></ion-icon>
          완료
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .order-header {
      background: var(--ion-color-light);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;

      h2 {
        margin: 0 0 8px 0;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--ion-color-medium);
      }
    }

    .section {
      margin-bottom: 24px;

      h3 {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 12px 0;
        color: var(--ion-color-primary);
      }
    }

    .serial-item {
      margin-bottom: 8px;
      --padding-top: 8px;
      --padding-bottom: 8px;

      .count {
        font-size: 12px;
        color: var(--ion-color-medium);
        margin-left: 8px;
      }
    }

    .waste-item {
      margin-bottom: 8px;
      --padding-top: 8px;
      --padding-bottom: 8px;
    }

    .photos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }

    .photo-item {
      position: relative;
      background: var(--ion-color-light);
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 1;

      ion-image {
        width: 100%;
        height: 100%;
      }

      ion-button {
        position: absolute;
        top: 0;
        right: 0;
        --padding-start: 2px;
        --padding-end: 2px;
      }
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
export class OrderCompletionModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  readonly ordersStore = inject(OrdersStore);
  readonly uiStore = inject(UIStore);

  order: Order | null = null;
  form!: FormGroup;
  isSubmitting = signal(false);
  photos = signal<string[]>([]);

  readonly orderLines = computed(() => this.order?.orderLines || []);
  readonly wasteCodes = signal<WasteCode[]>([
    { code: 'P01', name: '냉장고' },
    { code: 'P02', name: '세탁기' },
    { code: 'P03', name: '에어컨' },
    { code: 'P04', name: '텔레비전' },
    { code: 'P05', name: '전자레인지' },
  ]);

  constructor() {
    addIcons({
      checkmarkOutline,
      closeOutline,
      cameraOutline,
      trashOutline,
    });

    this.form = this.fb.group({
      serials: this.fb.array([]),
      waste: this.fb.array([]),
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.order = this.ordersStore.selectedOrder();

    if (!this.order) {
      this.dismiss();
      return;
    }

    // Build form arrays based on order lines
    const serials = this.form.get('serials') as FormArray;
    this.order.orderLines.forEach((line) => {
      serials.push(
        this.fb.group({
          lineId: [line.id],
          serialNumber: ['', Validators.required],
        })
      );
    });

    // Add one empty waste item
    this.addWaste();
  }

  wasteArray(): FormArray {
    return this.form.get('waste') as FormArray;
  }

  addWaste(): void {
    const waste = this.form.get('waste') as FormArray;
    waste.push(
      this.fb.group({
        code: ['', Validators.required],
        quantity: [1, [Validators.required, Validators.min(1)]],
      })
    );
  }

  removeWaste(index: number): void {
    const waste = this.form.get('waste') as FormArray;
    waste.removeAt(index);
  }

  async capturePhoto(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 70, // Compress to 70% (SDD 10.2 - low-end optimization)
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });

      if (image.dataUrl) {
        this.photos.update((current) => [...current, image.dataUrl!]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      this.uiStore.showToast('카메라 접근 실패', 'danger');
    }
  }

  removePhoto(index: number): void {
    this.photos.update((current) => current.filter((_, i) => i !== index));
  }

  async onSubmit(): Promise<void> {
    if (!this.form.valid || !this.order) return;

    this.isSubmitting.set(true);

    try {
      const { serials, waste, notes } = this.form.value;

      // Filter out empty waste entries
      const wasteEntries = waste.filter((w: any) => w.code);

      await this.ordersStore.completeOrder(this.order.id, {
        lines: serials,
        waste: wasteEntries,
        notes,
      });

      this.uiStore.showToast('설치가 완료되었습니다', 'success');
      await this.modalCtrl.dismiss(null, 'confirm');
    } catch (error) {
      this.uiStore.showToast('완료 저장 실패', 'danger');
      console.error('Completion error:', error);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
