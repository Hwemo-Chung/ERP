// apps/web/src/app/features/master-data/pages/category-tree/category-tree.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonNote, IonButton, IonIcon, IonBackButton, IonButtons, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, createOutline, closeCircleOutline } from 'ionicons/icons';
import { MasterDataService, CategoryNode } from '../../services/master-data.service';

interface FlatNode { id: string; name: string; depth: number; }

function flatten(nodes: CategoryNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flatten(n.children ?? [], depth + 1),
  ]);
}

@Component({
  selector: 'app-category-tree',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
    IonNote, IonButton, IonIcon, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>카테고리 관리</ion-title>
      <ion-buttons slot="end">
        <ion-button (click)="addCategory()"><ion-icon slot="icon-only" name="add-outline" /></ion-button>
      </ion-buttons>
    </ion-toolbar></ion-header>
    <ion-content>
      <ion-list>
        @for (n of nodes(); track n.id) {
          <ion-item [style.paddingInlineStart.px]="n.depth * 24">
            <ion-label>{{ n.name }} <ion-note>depth {{ n.depth + 1 }}</ion-note></ion-label>
            <ion-button fill="clear" size="small" (click)="addCategory(n.id)">
              <ion-icon slot="icon-only" name="add-outline" />
            </ion-button>
            <ion-button fill="clear" size="small" (click)="renameCategory(n.id, n.name)">
              <ion-icon slot="icon-only" name="create-outline" />
            </ion-button>
            <ion-button fill="clear" size="small" color="danger" (click)="deactivateCategory(n.id)">
              <ion-icon slot="icon-only" name="close-circle-outline" />
            </ion-button>
          </ion-item>
        } @empty {
          <ion-item><ion-label>등록된 카테고리가 없습니다.</ion-label></ion-item>
        }
      </ion-list>
    </ion-content>
  `,
})
export class CategoryTreePage implements OnInit {
  private api = inject(MasterDataService);
  private alertCtrl = inject(AlertController);

  nodes = signal<FlatNode[]>([]);

  constructor() {
    addIcons({ addOutline, createOutline, closeCircleOutline });
  }

  ngOnInit() {
    this.load();
  }

  async load() {
    const tree = await this.api.getCategoryTree();
    this.nodes.set(flatten(tree));
  }

  async addCategory(parentId?: string) {
    const alert = await this.alertCtrl.create({
      header: '카테고리 추가',
      inputs: [{ name: 'name', type: 'text', placeholder: '카테고리명' }],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '추가',
          handler: async (data) => {
            if (!data.name) return false;
            await this.api.createCategory({ name: data.name, parentId });
            await this.load();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async renameCategory(id: string, currentName: string) {
    const alert = await this.alertCtrl.create({
      header: '이름 변경',
      inputs: [{ name: 'name', type: 'text', value: currentName }],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '변경',
          handler: async (data) => {
            if (!data.name) return false;
            await this.api.renameCategory(id, data.name);
            await this.load();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async deactivateCategory(id: string) {
    const alert = await this.alertCtrl.create({
      header: '비활성화',
      message: '이 카테고리를 비활성화하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '비활성화',
          role: 'destructive',
          handler: async () => {
            await this.api.deactivateCategory(id);
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }
}
