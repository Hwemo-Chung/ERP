/**
 * @fileoverview 주문 목록 페이지 컴포넌트
 * @description 주문 목록을 표시하고 필터링, 검색, 정렬 기능을 제공합니다.
 * 
 * 주요 기능:
 * - 주문 목록 조회 및 무한 스크롤
 * - 상태별 필터링
 * - 검색 기능
 * - 테이블/카드 뷰 모드 전환
 * - 반응형 레이아웃 (웹/모바일)
 * - 다국어(i18n) 지원
 */
import { Component, inject, OnInit, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonBadge,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  RefresherCustomEvent,
  InfiniteScrollCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  chevronForwardOutline, 
  cloudOfflineOutline, 
  listOutline, 
  calendarOutline, 
  locationOutline,
  filterOutline,
  downloadOutline,
  printOutline,
  eyeOutline,
  createOutline,
  searchOutline,
  gridOutline,
  reorderFourOutline,
  personOutline
} from 'ionicons/icons';
import { NetworkService } from '../../../../core/services/network.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { Order, OrderStatus } from '../../../../store/orders/orders.models';
import { BREAKPOINTS } from '@shared/constants';

@Component({
  selector: 'app-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonBadge,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TranslateModule,
    ScrollingModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'ORDERS.LIST.TITLE' | translate }}</ion-title>
        @if (networkService.isOffline()) {
          <ion-icon slot="end" name="cloud-offline-outline" color="warning" style="margin-right: 16px;"></ion-icon>
        }
      </ion-toolbar>
      <!-- 모바일 검색바 -->
      <ion-toolbar class="mobile-only">
        <ion-searchbar
          [debounce]="300"
          [placeholder]="'ORDERS.LIST.SEARCH_PLACEHOLDER' | translate"
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar class="mobile-only">
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)">
          <ion-segment-button value="all">
            <ion-label>{{ 'ORDERS.FILTER.ALL' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="pending">
            <ion-label>{{ 'ORDERS.FILTER.UNASSIGNED' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="assigned">
            <ion-label>{{ 'ORDERS.FILTER.ASSIGNED' | translate }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content [class.web-view]="isWebView()">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isWebView()) {
        <!-- ============================================
             웹 버전 (1080px 이상)
             ============================================ -->
        <div class="web-order-list">
          <!-- 상단 필터 바 -->
          <div class="web-filter-bar">
            <div class="filter-left">
              <div class="search-box">
                <ion-icon name="search-outline"></ion-icon>
                <input 
                  type="text" 
                  [placeholder]="'ORDERS.LIST.SEARCH_PLACEHOLDER' | translate" 
                  (input)="onSearchWeb($event)"
                />
              </div>
              <div class="filter-group">
                <label>{{ 'ORDERS.FILTER.STATUS' | translate }}</label>
                <select (change)="onStatusFilter($event)">
                  <option value="all">{{ 'ORDERS.FILTER.ALL' | translate }}</option>
                  <option value="pending">{{ 'ORDERS.FILTER.UNASSIGNED' | translate }}</option>
                  <option value="assigned">{{ 'ORDERS.FILTER.ASSIGNED' | translate }}</option>
                  <option value="dispatched">{{ 'ORDERS.STATUS.DISPATCHED' | translate }}</option>
                  <option value="completed">{{ 'ORDERS.FILTER.COMPLETED' | translate }}</option>
                </select>
              </div>
              <div class="filter-group">
                <label>{{ 'ORDERS.FILTER.DATE' | translate }}</label>
                <input type="date" [value]="today" (change)="onDateFilter($event)" />
              </div>
            </div>
            <div class="filter-right">
              <button class="web-btn secondary" (click)="toggleViewMode()">
                <ion-icon [name]="viewMode() === 'table' ? 'grid-outline' : 'reorder-four-outline'"></ion-icon>
              </button>
              <button class="web-btn secondary">
                <ion-icon name="download-outline"></ion-icon>
                {{ 'COMMON.EXPORT' | translate }}
              </button>
            </div>
          </div>

          <!-- 통계 요약 -->
          <div class="web-stats-row">
            <div class="stat-item">
              <span class="stat-value">{{ ordersStore.kpiMetrics().total }}</span>
              <span class="stat-label">{{ 'COMMON.ALL' | translate }}</span>
            </div>
            <div class="stat-item danger">
              <span class="stat-value">{{ ordersStore.kpiMetrics().pending }}</span>
              <span class="stat-label">{{ 'ORDERS.FILTER.UNASSIGNED' | translate }}</span>
            </div>
            <div class="stat-item warning">
              <span class="stat-value">{{ ordersStore.kpiMetrics().dispatched }}</span>
              <span class="stat-label">{{ 'ORDERS.FILTER.IN_PROGRESS' | translate }}</span>
            </div>
            <div class="stat-item success">
              <span class="stat-value">{{ ordersStore.kpiMetrics().completed }}</span>
              <span class="stat-label">{{ 'ORDERS.FILTER.COMPLETED' | translate }}</span>
            </div>
          </div>

          @if (ordersStore.isLoading() && ordersStore.orders().length === 0) {
            <div class="loading-container">
              <ion-spinner name="crescent"></ion-spinner>
              <p>{{ 'ORDERS.LIST.LOADING' | translate }}</p>
            </div>
          } @else if (ordersStore.filteredOrders().length === 0) {
            <div class="empty-state">
              <ion-icon name="list-outline"></ion-icon>
              <h3>{{ 'ORDERS.LIST.NO_ORDERS' | translate }}</h3>
              <p>{{ 'ORDERS.LIST.NO_ORDERS_DESC' | translate }}</p>
            </div>
          } @else {
            <!-- 테이블 뷰 (Virtual Scrolling 적용) -->
            @if (viewMode() === 'table') {
              <div class="web-data-table">
                <div class="table-header">
                  <div class="table-title">{{ 'ORDERS.LIST.COUNT' | translate:{ count: ordersStore.filteredOrders().length } }}</div>
                  <div class="table-actions">
                    <button class="web-btn ghost sm" (click)="selectAll()">
                      {{ 'COMMON.SELECT_ALL' | translate }}
                    </button>
                  </div>
                </div>
                <!-- CSS Grid 기반 가상 테이블 -->
                <div class="virtual-table">
                  <!-- 고정 헤더 -->
                  <div class="virtual-table-header">
                    <div class="vt-cell col-checkbox">
                      <input type="checkbox" (change)="selectAll()" />
                    </div>
                    <div class="vt-cell col-order">{{ 'ORDERS.TABLE.ORDER_NUMBER' | translate }}</div>
                    <div class="vt-cell col-status">{{ 'COMMON.STATUS' | translate }}</div>
                    <div class="vt-cell col-customer">{{ 'ORDERS.TABLE.CUSTOMER' | translate }}</div>
                    <div class="vt-cell col-address">{{ 'ORDERS.TABLE.ADDRESS' | translate }}</div>
                    <div class="vt-cell col-date">{{ 'ORDERS.TABLE.SCHEDULED_DATE' | translate }}</div>
                    <div class="vt-cell col-installer">{{ 'ORDERS.TABLE.INSTALLER' | translate }}</div>
                    <div class="vt-cell col-actions">{{ 'COMMON.ACTIONS' | translate }}</div>
                  </div>
                  <!-- Virtual Scroll 본문 -->
                  <cdk-virtual-scroll-viewport
                    itemSize="56"
                    class="virtual-table-body"
                    minBufferPx="400"
                    maxBufferPx="800">
                    <div class="virtual-table-row"
                         *cdkVirtualFor="let order of ordersStore.filteredOrders(); trackBy: trackById"
                         (click)="viewOrder(order.id)">
                      <div class="vt-cell col-checkbox" (click)="$event.stopPropagation()">
                        <input type="checkbox" [checked]="selectedOrders().has(order.id)"
                               (change)="toggleOrderSelection(order.id)" />
                      </div>
                      <div class="vt-cell col-order">
                        <span class="order-number">{{ order.orderNo }}</span>
                      </div>
                      <div class="vt-cell col-status">
                        <span [class]="'status-badge status-' + order.status.toLowerCase()">
                          {{ getStatusLabel(order.status) }}
                        </span>
                      </div>
                      <div class="vt-cell col-customer">
                        <div class="customer-info">
                          <span class="customer-name">{{ order.customerName }}</span>
                          <span class="customer-phone">{{ order.customerPhone }}</span>
                        </div>
                      </div>
                      <div class="vt-cell col-address">
                        <span class="address-text">{{ order.customerAddress }}</span>
                      </div>
                      <div class="vt-cell col-date">
                        <div class="date-info">
                          <span class="date">{{ order.appointmentDate | date:'MM/dd (EEE)' }}</span>
                          <span class="slot">{{ order.appointmentSlot || '-' }}</span>
                        </div>
                      </div>
                      <div class="vt-cell col-installer">
                        @if (order.installerName) {
                          <div class="installer-badge">
                            <ion-icon name="person-outline"></ion-icon>
                            {{ order.installerName }}
                          </div>
                        } @else {
                          <span class="unassigned">{{ 'ORDERS.STATUS.UNASSIGNED' | translate }}</span>
                        }
                      </div>
                      <div class="vt-cell col-actions" (click)="$event.stopPropagation()">
                        <button class="action-btn" [title]="'COMMON.VIEW_DETAIL' | translate" (click)="viewOrder(order.id)">
                          <ion-icon name="eye-outline"></ion-icon>
                        </button>
                        <button class="action-btn" [title]="'COMMON.EDIT' | translate" (click)="editOrder(order.id)">
                          <ion-icon name="create-outline"></ion-icon>
                        </button>
                      </div>
                    </div>
                  </cdk-virtual-scroll-viewport>
                </div>
                @if (ordersStore.pagination().hasMore) {
                  <div class="table-footer">
                    <div class="pagination-info">
                      {{ ordersStore.filteredOrders().length }} / {{ ordersStore.pagination().total }}{{ 'COMMON.ITEMS_SUFFIX' | translate }}
                    </div>
                    <button class="web-btn secondary sm" (click)="loadMoreWeb()">
                      {{ 'COMMON.LOAD_MORE' | translate }}
                    </button>
                  </div>
                }
              </div>
            } @else {
              <!-- 카드 뷰 -->
              <div class="web-card-grid">
                @for (order of ordersStore.filteredOrders(); track order.id) {
                  <div class="order-card" (click)="viewOrder(order.id)">
                    <div class="card-header">
                      <span class="order-number">{{ order.orderNo }}</span>
                      <span [class]="'status-badge status-' + order.status.toLowerCase()">
                        {{ getStatusLabel(order.status) }}
                      </span>
                    </div>
                    <div class="card-body">
                      <h3 class="customer-name">{{ order.customerName }}</h3>
                      <p class="customer-phone">{{ order.customerPhone }}</p>
                      <div class="address">
                        <ion-icon name="location-outline"></ion-icon>
                        {{ order.customerAddress }}
                      </div>
                      <div class="appointment">
                        <ion-icon name="calendar-outline"></ion-icon>
                        {{ order.appointmentDate | date:'MM/dd (EEE)' }}
                        @if (order.appointmentSlot) {
                          · {{ order.appointmentSlot }}
                        }
                      </div>
                    </div>
                    <div class="card-footer">
                      @if (order.installerName) {
                        <div class="installer">
                          <ion-icon name="person-outline"></ion-icon>
                          {{ order.installerName }}
                        </div>
                      } @else {
                        <span class="unassigned">{{ 'ORDERS.STATUS.UNASSIGNED' | translate }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      } @else {
        <!-- ============================================
             모바일 버전 (1080px 미만)
             ============================================ -->
        <!-- Stats Summary -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ ordersStore.kpiMetrics().total }}</div>
            <div class="stat-label">{{ 'COMMON.ALL' | translate }}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-value">{{ ordersStore.kpiMetrics().pending }}</div>
            <div class="stat-label">{{ 'ORDERS.FILTER.UNASSIGNED' | translate }}</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">{{ ordersStore.kpiMetrics().dispatched }}</div>
            <div class="stat-label">{{ 'ORDERS.FILTER.IN_PROGRESS' | translate }}</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{{ ordersStore.kpiMetrics().completed }}</div>
            <div class="stat-label">{{ 'ORDERS.FILTER.COMPLETED' | translate }}</div>
          </div>
        </div>

        @if (ordersStore.isLoading() && ordersStore.orders().length === 0) {
          <div class="loading-container">
            <ion-spinner name="crescent"></ion-spinner>
            <p>{{ 'ORDERS.LIST.LOADING' | translate }}</p>
          </div>
        } @else if (ordersStore.filteredOrders().length === 0) {
          <div class="empty-state">
            <ion-icon name="list-outline"></ion-icon>
            <h3>{{ 'ORDERS.LIST.NO_ORDERS' | translate }}</h3>
            <p>{{ 'ORDERS.LIST.PULL_TO_REFRESH' | translate }}</p>
          </div>
        } @else {
          <cdk-virtual-scroll-viewport
            itemSize="88"
            class="order-list-viewport"
            minBufferPx="400"
            maxBufferPx="800">
            <ion-list>
              <ion-item
                *cdkVirtualFor="let order of ordersStore.filteredOrders(); trackBy: trackById"
                button
                (click)="viewOrder(order.id)"
                class="order-item">
                <div class="order-content">
                  <div class="order-header">
                    <span class="order-number">{{ order.orderNo }}</span>
                    <ion-badge [color]="getStatusColor(order.status)">
                      {{ getStatusLabel(order.status) }}
                    </ion-badge>
                  </div>
                  <h2 class="customer-name">{{ order.customerName }}</h2>
                  <div class="order-meta">
                    <span class="meta-item">
                      <ion-icon name="location-outline"></ion-icon>
                      {{ order.customerAddress }}
                    </span>
                  </div>
                  <div class="order-meta">
                    <span class="meta-item appointment">
                      <ion-icon name="calendar-outline"></ion-icon>
                      {{ order.appointmentDate | date:'MM/dd (EEE)' }}
                      @if (order.appointmentSlot) {
                        · {{ order.appointmentSlot }}
                      }
                    </span>
                  </div>
                </div>
                <ion-icon slot="end" name="chevron-forward-outline" class="chevron-icon"></ion-icon>
              </ion-item>
            </ion-list>
          </cdk-virtual-scroll-viewport>


          @if (ordersStore.pagination().hasMore) {
            <ion-infinite-scroll (ionInfinite)="loadMore($event)">
              <ion-infinite-scroll-content></ion-infinite-scroll-content>
            </ion-infinite-scroll>
          }
        }
      }
    </ion-content>
  `,
  styles: [`
    /* ============================================
       공통 스타일
       ============================================ */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      gap: 16px;

      p {
        color: #64748b;
        font-size: 14px;
        margin: 0;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;

      ion-icon {
        font-size: 56px;
        color: #cbd5e1;
        margin-bottom: 20px;
      }

      h3 {
        font-size: 17px;
        font-weight: 600;
        color: #374151;
        margin: 0 0 8px 0;
      }

      p {
        color: #94a3b8;
        font-size: 14px;
        margin: 0;
      }
    }

    /* 모바일 전용 헤더 */
    .mobile-only {
      @media (min-width: 1080px) {
        display: none !important;
      }
    }

    /* ============================================
       모바일 버전 스타일 (1080px 미만)
       ============================================ */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 12px 16px;
      background: #f8fafc;
    }

    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 12px 8px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .stat-card .stat-value { font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1; margin-bottom: 4px; }
    .stat-card .stat-label { font-size: 11px; color: #64748b; font-weight: 500; }
    .stat-card.danger { border-left: 3px solid #ef4444; }
    .stat-card.danger .stat-value { color: #ef4444; }
    .stat-card.warning { border-left: 3px solid #f59e0b; }
    .stat-card.warning .stat-value { color: #f59e0b; }
    .stat-card.success { border-left: 3px solid #10b981; }
    .stat-card.success .stat-value { color: #10b981; }

    .order-item {
      --padding-start: 16px;
      --padding-end: 12px;
      --inner-padding-end: 0;
      --padding-top: 12px;
      --padding-bottom: 12px;
      --border-color: #f1f5f9;
    }

    .order-content {
      flex: 1;
      min-width: 0;
    }

    .order-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .order-number {
      font-size: 12px;
      font-weight: 600;
      color: #3b82f6;
      letter-spacing: 0.3px;
    }

    ion-badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .customer-name {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 6px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .order-meta { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
    .meta-item { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #64748b; }
    .meta-item ion-icon { font-size: 14px; color: #94a3b8; }
    .meta-item.appointment { color: #3b82f6; font-weight: 500; }
    .meta-item.appointment ion-icon { color: #3b82f6; }


    /* Virtual Scroll */
    .order-list-viewport { height: calc(100vh - 248px); width: 100%; }
    cdk-virtual-scroll-viewport { contain: strict; }
    cdk-virtual-scroll-viewport .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; }
    .chevron-icon { color: #cbd5e1; font-size: 18px; }

    /* ============================================
       웹 버전 스타일 (1080px 이상)
       ============================================ */
    .web-view {
      --background: #f8fafc;
    }

    .web-order-list {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;

      @media (min-width: 1920px) {
        padding: 32px 48px;
        max-width: 1800px;
      }
    }

    /* Filter bar */
    .web-filter-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-left { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .filter-right { display: flex; align-items: center; gap: 8px; }
    .search-box { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; min-width: 280px; }
    .search-box ion-icon { font-size: 18px; color: #94a3b8; }
    .search-box input { border: none; background: transparent; font-size: 14px; width: 100%; outline: none; }
    .search-box input::placeholder { color: #94a3b8; }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-group label { font-size: 13px; font-weight: 500; color: #64748b; }
    .filter-group select, .filter-group input { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #374151; background: #fff; min-width: 120px; }
    .filter-group select:focus, .filter-group input:focus { outline: none; border-color: #3b82f6; }

    /* Stats row */
    .web-stats-row { display: flex; gap: 16px; margin-bottom: 20px; }
    .web-stats-row .stat-item { display: flex; align-items: center; gap: 8px; padding: 12px 20px; background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; }
    .web-stats-row .stat-value { font-size: 24px; font-weight: 700; color: #0f172a; }
    .web-stats-row .stat-label { font-size: 13px; color: #64748b; }
    .web-stats-row .danger .stat-value { color: #ef4444; }
    .web-stats-row .warning .stat-value { color: #f59e0b; }
    .web-stats-row .success .stat-value { color: #10b981; }

    /* Web buttons */
    .web-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
    .web-btn ion-icon { font-size: 18px; }
    .web-btn.secondary { background: #f1f5f9; color: #374151; }
    .web-btn.secondary:hover { background: #e2e8f0; }
    .web-btn.ghost { background: transparent; color: #64748b; }
    .web-btn.ghost:hover { background: #f1f5f9; }
    .web-btn.sm { padding: 6px 12px; font-size: 13px; }

    /* 데이터 테이블 */
    .web-data-table {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;

      .table-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;

        .table-title {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
        }
      }

      .table-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;

        .pagination-info {
          font-size: 13px;
          color: #64748b;
        }
      }

      /* CSS Grid 기반 가상 테이블 (Virtual Scrolling 지원) */
      .virtual-table {
        display: flex;
        flex-direction: column;
        border: 1px solid #e2e8f0;
        border-radius: 0 0 12px 12px;
        overflow: hidden;
      }

      .virtual-table-header,
      .virtual-table-row {
        display: grid;
        grid-template-columns: 50px 160px 100px 140px minmax(200px, 1fr) 130px 120px 100px;
        align-items: center;
      }

      .virtual-table-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 1;

        .vt-cell {
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      }

      .virtual-table-body {
        height: calc(100vh - 400px); /* Adjust based on header/filter heights */
        min-height: 300px;
        contain: strict;

        .cdk-virtual-scroll-content-wrapper {
          display: flex;
          flex-direction: column;
        }
      }

      .virtual-table-row {
        cursor: pointer;
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.15s;

        &:hover {
          background: #f8fafc;
        }

        .vt-cell {
          padding: 14px 16px;
          font-size: 14px;
          color: #374151;
          overflow: hidden;
          text-overflow: ellipsis;

          &.col-checkbox {
            text-align: center;
          }

          &.col-order .order-number {
            font-weight: 600;
            font-size: 13px;
            color: #3b82f6;
            white-space: nowrap;
          }

          .customer-info {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .customer-name {
              font-weight: 600;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .customer-phone {
              font-size: 12px;
              color: #64748b;
            }
          }

          .address-text {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 13px;
            color: #64748b;
          }

          .date-info {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .date {
              font-weight: 500;
              color: #0f172a;
            }

            .slot {
              font-size: 12px;
              color: #3b82f6;
            }
          }

          .installer-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: #f1f5f9;
            border-radius: 6px;
            font-size: 13px;

            ion-icon {
              font-size: 14px;
              color: #64748b;
            }
          }

          .unassigned {
            color: #ef4444;
            font-size: 13px;
          }

          &.col-actions {
            text-align: center;

            .action-btn {
              width: 32px;
              height: 32px;
              border: none;
              background: transparent;
              border-radius: 6px;
              cursor: pointer;
              transition: background 0.2s;

              ion-icon {
                font-size: 18px;
                color: #64748b;
              }

              &:hover {
                background: #f1f5f9;
              }
            }
          }
        }
      }
    }

    /* Status badges - using color vars for size reduction */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-unassigned { background: #9e9e9e26; color: #757575; }
    .status-assigned { background: #2196f326; color: #1976d2; }
    .status-confirmed { background: #03a9f426; color: #0288d1; }
    .status-released { background: #00bcd426; color: #0097a7; }
    .status-dispatched { background: #00968826; color: #00796b; }
    .status-completed, .status-collected, .status-partial { background: #4caf5026; color: #388e3c; }
    .status-postponed { background: #ff980026; color: #f57c00; }
    .status-absent { background: #ff572226; color: #e64a19; }
    .status-request_cancel { background: #f4433626; color: #d32f2f; }
    .status-cancelled { background: #79554826; color: #5d4037; }

    /* Card grid */
    .web-card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (min-width: 1600px) { .web-card-grid { grid-template-columns: repeat(4, 1fr); } }
    .order-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; cursor: pointer; }
    .order-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
    .order-card .card-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
    .order-card .card-header .order-number { font-size: 13px; font-weight: 600; color: #3b82f6; }
    .order-card .card-body { padding: 16px; }
    .order-card .card-body .customer-name { font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0; }
    .order-card .card-body .customer-phone { font-size: 13px; color: #64748b; margin: 0 0 12px 0; }
    .order-card .address, .order-card .appointment { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; color: #64748b; margin-bottom: 6px; }
    .order-card .address ion-icon, .order-card .appointment ion-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .order-card .appointment { color: #3b82f6; font-weight: 500; }
    .order-card .card-footer { padding: 12px 16px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
    .order-card .installer { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; }
    .order-card .installer ion-icon { font-size: 16px; color: #64748b; }
    .order-card .unassigned { color: #ef4444; font-size: 13px; }
  `],
})
export class OrderListPage implements OnInit {
  /** 주문 데이터 상태 관리 스토어 */
  readonly ordersStore = inject(OrdersStore);
  /** 설치기사 데이터 상태 관리 스토어 */
  readonly installersStore = inject(InstallersStore);
  /** UI 상태 관리 스토어 */
  readonly uiStore = inject(UIStore);
  /** 네트워크 연결 상태 서비스 */
  protected readonly networkService = inject(NetworkService);
  /** Angular 라우터 서비스 */
  private readonly router = inject(Router);
  /** 다국어 번역 서비스 */
  private readonly translateService = inject(TranslateService);

  /** 현재 적용된 필터 상태 (all, pending, assigned) */
  protected readonly currentFilter = signal<'all' | 'pending' | 'assigned'>('all');
  /** 웹 뷰 여부 (1080px 이상) */
  protected readonly isWebView = signal(window.innerWidth >= BREAKPOINTS.WEB_VIEW);
  /** 현재 뷰 모드 (table 또는 card) */
  protected readonly viewMode = signal<'table' | 'card'>('table');
  /** 선택된 주문 ID 집합 */
  protected readonly selectedOrders = signal<Set<string>>(new Set());
  /** 오늘 날짜 (YYYY-MM-DD 형식) */
  protected readonly today = new Date().toISOString().split('T')[0];
  /**
   * TrackBy function for virtual scrolling optimization
   * Returns unique identifier to help Angular track DOM reuse
   * Complexity: O(1) - Single property access
   */
  public trackById = (_index: number, order: Order): string => order.id;


  constructor() {
    addIcons({ 
      chevronForwardOutline, 
      cloudOfflineOutline, 
      listOutline, 
      calendarOutline, 
      locationOutline,
      filterOutline,
      downloadOutline,
      printOutline,
      eyeOutline,
      createOutline,
      searchOutline,
      gridOutline,
      reorderFourOutline,
      personOutline
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.isWebView.set(window.innerWidth >= BREAKPOINTS.WEB_VIEW);
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadOrders();
    event.target.complete();
  }

  protected onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    this.ordersStore.setFilters({ customerName: query || undefined });
  }

  protected onSearchWeb(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value || '';
    this.ordersStore.setFilters({ customerName: query || undefined });
  }

  protected onFilterChange(event: CustomEvent): void {
    const filter = event.detail.value as 'all' | 'pending' | 'assigned';
    this.applyFilter(filter);
  }

  protected onStatusFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const filter = select.value;

    if (filter === 'dispatched') {
      this.ordersStore.setFilters({ status: [OrderStatus.DISPATCHED] });
    } else if (filter === 'completed') {
      this.ordersStore.setFilters({ status: [OrderStatus.COMPLETED] });
    } else if (filter === 'all' || filter === 'pending' || filter === 'assigned') {
      this.applyFilter(filter);
    }
  }

  protected onDateFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    // 날짜 필터 구현
    console.log('Date filter:', input.value);
  }

  private applyFilter(filter: 'all' | 'pending' | 'assigned'): void {
    this.currentFilter.set(filter);

    if (filter === 'all') {
      this.ordersStore.clearFilters();
    } else if (filter === 'pending') {
      this.ordersStore.setFilters({ status: [OrderStatus.UNASSIGNED] });
    } else if (filter === 'assigned') {
      this.ordersStore.setFilters({ status: [OrderStatus.ASSIGNED, OrderStatus.CONFIRMED] });
    }
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.ordersStore.loadMoreOrders();
    event.target.complete();
  }

  protected async loadMoreWeb(): Promise<void> {
    await this.ordersStore.loadMoreOrders();
  }

  protected viewOrder(id: string): void {
    this.ordersStore.selectOrder(id);
    this.router.navigate(['/tabs/orders', id]);
  }

  protected editOrder(id: string): void {
    this.router.navigate(['/tabs/orders', id, 'edit']);
  }

  protected toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'table' ? 'card' : 'table');
  }

  protected selectAll(): void {
    const orders = this.ordersStore.filteredOrders();
    const currentSelected = this.selectedOrders();
    
    if (currentSelected.size === orders.length) {
      this.selectedOrders.set(new Set());
    } else {
      this.selectedOrders.set(new Set(orders.map(o => o.id)));
    }
  }

  protected toggleOrderSelection(id: string): void {
    const current = this.selectedOrders();
    const newSet = new Set(current);
    
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    
    this.selectedOrders.set(newSet);
  }

  protected getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: 'danger',
      [OrderStatus.ASSIGNED]: 'warning',
      [OrderStatus.CONFIRMED]: 'warning',
      [OrderStatus.RELEASED]: 'primary',
      [OrderStatus.DISPATCHED]: 'primary',
      [OrderStatus.POSTPONED]: 'secondary',
      [OrderStatus.ABSENT]: 'tertiary',
      [OrderStatus.COMPLETED]: 'success',
      [OrderStatus.PARTIAL]: 'success',
      [OrderStatus.COLLECTED]: 'success',
      [OrderStatus.CANCELLED]: 'medium',
      [OrderStatus.REQUEST_CANCEL]: 'danger',
    };
    return colorMap[status] || 'medium';
  }

  /**
   * 주문 상태 코드를 i18n 기반 라벨로 변환
   * @param status - 주문 상태 코드 (OrderStatus enum 값)
   * @returns 번역된 상태 라벨 문자열
   */
  protected getStatusLabel(status: string): string {
    // 상태 코드와 i18n 키 매핑
    const statusI18nKeys: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: 'ORDERS.STATUS.UNASSIGNED',
      [OrderStatus.ASSIGNED]: 'ORDERS.STATUS.ASSIGNED',
      [OrderStatus.CONFIRMED]: 'ORDERS.STATUS.CONFIRMED',
      [OrderStatus.RELEASED]: 'ORDERS.STATUS.RELEASED',
      [OrderStatus.DISPATCHED]: 'ORDERS.STATUS.DISPATCHED',
      [OrderStatus.POSTPONED]: 'ORDERS.STATUS.POSTPONED',
      [OrderStatus.ABSENT]: 'ORDERS.STATUS.ABSENT',
      [OrderStatus.COMPLETED]: 'ORDERS.STATUS.COMPLETED',
      [OrderStatus.PARTIAL]: 'ORDERS.STATUS.PARTIAL',
      [OrderStatus.COLLECTED]: 'ORDERS.STATUS.COLLECTED',
      [OrderStatus.CANCELLED]: 'ORDERS.STATUS.CANCELLED',
      [OrderStatus.REQUEST_CANCEL]: 'ORDERS.STATUS.REQUEST_CANCEL',
    };
    const key = statusI18nKeys[status];
    return key ? this.translateService.instant(key) : status;
  }

  private async loadOrders(): Promise<void> {
    try {
      const branchCode = 'ALL';
      // Load stats first (real totals), then orders (paginated)
      await Promise.all([
        this.ordersStore.loadStats(branchCode),
        this.ordersStore.loadOrders(branchCode, 1, 20),
        this.installersStore.loadInstallers(branchCode),
      ]);
    } catch (error) {
      const msg = this.translateService.instant('ORDERS.ERROR.LOAD_FAILED');
      this.uiStore.showToast(msg, 'danger');
    }
  }
}
