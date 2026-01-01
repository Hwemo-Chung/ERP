/**
 * Unreturned Items Page (미환입 현황) - Web HQ Dashboard
 * Modern web dashboard for tracking cancelled orders with pending item returns
 * HQ_ADMIN can view all branches, filter by branch, date range, status
 */
import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastController, AlertController } from '@ionic/angular/standalone';
import {
  ReportsService,
  UnreturnedItem,
  UnreturnedItemsResponse,
  BranchOption,
} from '../../../../core/services/reports.service';
import { AuthService } from '../../../../core/services/auth.service';

type ReturnStatusFilter = 'all' | 'unreturned' | 'returned';

interface BranchSummary {
  branchCode: string;
  branchName: string;
  unreturnedCount: number;
  returnedCount: number;
}

@Component({
  selector: 'app-unreturned-items',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-left">
          <a routerLink="/tabs/reports" class="back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </a>
          <div class="header-title">
            <h1>{{ 'REPORTS.UNRETURNED_ITEMS.TITLE' | translate }}</h1>
            <p class="header-subtitle">{{ 'REPORTS.UNRETURNED_ITEMS.SUBTITLE' | translate }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="exportCsv()" [disabled]="isLoading()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {{ 'COMMON.BUTTONS.EXPORT' | translate }}
          </button>
          <button class="btn btn-secondary" (click)="printReport()" [disabled]="isLoading()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 6,2 18,2 18,9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            {{ 'COMMON.BUTTONS.PRINT' | translate }}
          </button>
        </div>
      </header>

      <!-- Filter Bar -->
      <section class="filter-bar">
        <div class="filter-row">
          <!-- Branch Filter (HQ_ADMIN only) -->
          @if (isHqAdmin()) {
            <div class="filter-group">
              <label class="filter-label">{{ 'REPORTS.UNRETURNED_ITEMS.BRANCH' | translate }}</label>
              <select
                class="filter-select"
                [value]="selectedBranch()"
                (change)="onBranchChange($event)"
              >
                <option value="">{{ 'REPORTS.UNRETURNED_ITEMS.ALL_BRANCHES' | translate }}</option>
                @for (branch of branches(); track branch.code) {
                  <option [value]="branch.code">{{ branch.name }}</option>
                }
              </select>
            </div>
          }

          <!-- Date From -->
          <div class="filter-group">
            <label class="filter-label">{{ 'REPORTS.UNRETURNED_ITEMS.DATE_FROM' | translate }}</label>
            <input
              type="date"
              class="filter-input"
              [value]="dateFrom()"
              [max]="today"
              (change)="onDateFromChange($event)"
            />
          </div>

          <!-- Date To -->
          <div class="filter-group">
            <label class="filter-label">{{ 'REPORTS.UNRETURNED_ITEMS.DATE_TO' | translate }}</label>
            <input
              type="date"
              class="filter-input"
              [value]="dateTo()"
              [max]="today"
              (change)="onDateToChange($event)"
            />
          </div>

          <!-- Status Filter -->
          <div class="filter-group">
            <label class="filter-label">{{ 'REPORTS.UNRETURNED_ITEMS.STATUS_FILTER' | translate }}</label>
            <div class="filter-tabs">
              <button
                class="filter-tab"
                [class.active]="statusFilter() === 'all'"
                (click)="setStatusFilter('all')"
              >
                {{ 'REPORTS.UNRETURNED_ITEMS.FILTER.ALL' | translate }}
              </button>
              <button
                class="filter-tab"
                [class.active]="statusFilter() === 'unreturned'"
                (click)="setStatusFilter('unreturned')"
              >
                {{ 'REPORTS.UNRETURNED_ITEMS.FILTER.UNRETURNED' | translate }}
              </button>
              <button
                class="filter-tab"
                [class.active]="statusFilter() === 'returned'"
                (click)="setStatusFilter('returned')"
              >
                {{ 'REPORTS.UNRETURNED_ITEMS.FILTER.RETURNED' | translate }}
              </button>
            </div>
          </div>

          <!-- Search -->
          <div class="filter-group filter-group-search">
            <label class="filter-label">{{ 'COMMON.SEARCH' | translate }}</label>
            <div class="search-input-wrapper">
              <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                class="filter-input search-input"
                [placeholder]="'REPORTS.UNRETURNED_ITEMS.SEARCH_PLACEHOLDER' | translate"
                [value]="searchTerm()"
                (input)="onSearch($event)"
              />
            </div>
          </div>

          <!-- Refresh Button -->
          <div class="filter-group filter-group-action">
            <button class="btn btn-primary" (click)="loadData()" [disabled]="isLoading()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [class.spin]="isLoading()">
                <polyline points="23,4 23,10 17,10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {{ 'COMMON.BUTTONS.REFRESH' | translate }}
            </button>
          </div>
        </div>
      </section>

      <!-- Statistics Cards -->
      <section class="stats-grid">
        <div class="stat-card stat-danger">
          <div class="stat-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ summary().unreturnedCount }}</span>
            <span class="stat-label">{{ 'REPORTS.UNRETURNED_ITEMS.SUMMARY.UNRETURNED' | translate }}</span>
          </div>
        </div>

        <div class="stat-card stat-success">
          <div class="stat-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ summary().returnedCount }}</span>
            <span class="stat-label">{{ 'REPORTS.UNRETURNED_ITEMS.SUMMARY.RETURNED' | translate }}</span>
          </div>
        </div>

        <div class="stat-card stat-primary">
          <div class="stat-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ summary().totalCount }}</span>
            <span class="stat-label">{{ 'REPORTS.UNRETURNED_ITEMS.SUMMARY.TOTAL' | translate }}</span>
          </div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ overdueCount() }}</span>
            <span class="stat-label">{{ 'REPORTS.UNRETURNED_ITEMS.OVERDUE' | translate }}</span>
          </div>
        </div>
      </section>

      <!-- Main Content Grid -->
      <div class="content-grid" [class.has-sidebar]="branchSummary().length > 1">
        <!-- Data Table -->
        <section class="table-section">
          <div class="section-header">
            <h2 class="section-title">
              {{ 'REPORTS.UNRETURNED_ITEMS.LIST_TITLE' | translate }}
              <span class="record-count">({{ filteredItems().length }})</span>
            </h2>
          </div>

          @if (isLoading()) {
            <div class="loading-state">
              <div class="spinner"></div>
              <p>{{ 'REPORTS.UNRETURNED_ITEMS.LOADING' | translate }}</p>
            </div>
          } @else if (filteredItems().length === 0) {
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <p>{{ 'REPORTS.UNRETURNED_ITEMS.NO_DATA' | translate }}</p>
            </div>
          } @else {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="th-status">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.STATUS' | translate }}</th>
                    <th class="th-branch">{{ 'REPORTS.UNRETURNED_ITEMS.BRANCH' | translate }}</th>
                    <th class="th-order">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.ORDER_NO' | translate }}</th>
                    <th class="th-customer">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.CUSTOMER' | translate }}</th>
                    <th class="th-product">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.PRODUCT' | translate }}</th>
                    <th class="th-date">{{ 'REPORTS.UNRETURNED_ITEMS.CANCEL_DATE' | translate }}</th>
                    <th class="th-reason">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.CANCEL_REASON' | translate }}</th>
                    <th class="th-overdue">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.DAYS_OVERDUE' | translate }}</th>
                    @if (canMarkReturn()) {
                      <th class="th-action">{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.ACTION' | translate }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (item of filteredItems(); track item.orderId) {
                    <tr [class.row-returned]="item.isReturned" [class.row-overdue]="isOverdue(item)">
                      <td class="td-status">
                        <span class="status-badge" [class.status-returned]="item.isReturned" [class.status-unreturned]="!item.isReturned">
                          {{ item.isReturned ? ('REPORTS.UNRETURNED_ITEMS.RETURNED' | translate) : ('REPORTS.UNRETURNED_ITEMS.NOT_RETURNED' | translate) }}
                        </span>
                      </td>
                      <td class="td-branch">{{ item.branchName || '-' }}</td>
                      <td class="td-order">
                        <code class="order-code">{{ item.orderNo }}</code>
                      </td>
                      <td class="td-customer">
                        <div class="customer-cell">
                          <span class="customer-name">{{ item.customerName }}</span>
                          @if (item.customerPhone) {
                            <span class="customer-phone">{{ item.customerPhone }}</span>
                          }
                        </div>
                      </td>
                      <td class="td-product">{{ item.productName || '-' }}</td>
                      <td class="td-date">{{ item.cancelledAt | date:'yyyy-MM-dd' }}</td>
                      <td class="td-reason">{{ getTranslatedCancelReason(item.cancelReason) }}</td>
                      <td class="td-overdue">
                        @if (item.isReturned && item.returnedAt) {
                          <span class="return-date">{{ item.returnedAt | date:'MM-dd' }}</span>
                        } @else {
                          <span class="overdue-days" [class.critical]="getDaysOverdue(item) > 7">
                            D+{{ getDaysOverdue(item) }}
                          </span>
                        }
                      </td>
                      @if (canMarkReturn()) {
                        <td class="td-action">
                          @if (!item.isReturned) {
                            <button class="btn-action btn-action-success" (click)="markAsReturned(item)">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20,6 9,17 4,12"/>
                              </svg>
                              {{ 'COMMON.BUTTONS.MARK_RETURN' | translate }}
                            </button>
                          } @else {
                            <span class="action-completed">-</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Branch Summary Sidebar -->
        @if (branchSummary().length > 1) {
          <aside class="sidebar-section">
            <div class="section-header">
              <h2 class="section-title">{{ 'REPORTS.UNRETURNED_ITEMS.BRANCH_TITLE' | translate }}</h2>
            </div>
            <div class="branch-list">
              @for (branch of branchSummary(); track branch.branchCode) {
                <div class="branch-card" (click)="onBranchCardClick(branch.branchCode)">
                  <div class="branch-header">
                    <span class="branch-name">{{ branch.branchName }}</span>
                    <span class="branch-total">{{ branch.unreturnedCount + branch.returnedCount }}</span>
                  </div>
                  <div class="branch-stats">
                    <span class="branch-stat unreturned">
                      <span class="dot"></span>
                      {{ branch.unreturnedCount }}
                    </span>
                    <span class="branch-stat returned">
                      <span class="dot"></span>
                      {{ branch.returnedCount }}
                    </span>
                  </div>
                  <div class="branch-progress">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="getReturnRate(branch)"></div>
                    </div>
                    <span class="progress-label">{{ getReturnRate(branch) | number:'1.0-0' }}%</span>
                  </div>
                </div>
              }
            </div>
          </aside>
        }
      </div>

      <!-- Print Area (Hidden) -->
      <div class="print-area" id="print-area">
        <div class="print-header">
          <h1>{{ 'REPORTS.UNRETURNED_ITEMS.TITLE' | translate }}</h1>
          <p>{{ 'REPORTS.UNRETURNED_ITEMS.PERIOD' | translate }}: {{ dateFrom() }} ~ {{ dateTo() }}</p>
          <p>{{ 'REPORTS.UNRETURNED_ITEMS.PRINT_DATE' | translate }}: {{ printDateTime }}</p>
        </div>
        <div class="print-summary">
          <span>{{ 'REPORTS.UNRETURNED_ITEMS.SUMMARY.UNRETURNED' | translate }}: {{ summary().unreturnedCount }}</span>
          <span>{{ 'REPORTS.UNRETURNED_ITEMS.SUMMARY.RETURNED' | translate }}: {{ summary().returnedCount }}</span>
          <span>{{ 'REPORTS.UNRETURNED_ITEMS.SUMMARY.TOTAL' | translate }}: {{ summary().totalCount }}</span>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.STATUS' | translate }}</th>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.BRANCH' | translate }}</th>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.ORDER_NO' | translate }}</th>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.CUSTOMER' | translate }}</th>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.PRODUCT' | translate }}</th>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.CANCEL_DATE' | translate }}</th>
              <th>{{ 'REPORTS.UNRETURNED_ITEMS.TABLE.CANCEL_REASON' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of filteredItems(); track item.orderId) {
              <tr>
                <td>{{ item.isReturned ? ('REPORTS.UNRETURNED_ITEMS.RETURNED' | translate) : ('REPORTS.UNRETURNED_ITEMS.NOT_RETURNED' | translate) }}</td>
                <td>{{ item.branchName || '-' }}</td>
                <td>{{ item.orderNo }}</td>
                <td>{{ item.customerName }}</td>
                <td>{{ item.productName || '-' }}</td>
                <td>{{ item.cancelledAt | date:'yyyy-MM-dd' }}</td>
                <td>{{ getTranslatedCancelReason(item.cancelReason) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    /* ===== CSS Variables ===== */
    :host {
      --color-primary: #3b82f6;
      --color-primary-dark: #2563eb;
      --color-success: #10b981;
      --color-success-light: #d1fae5;
      --color-danger: #ef4444;
      --color-danger-light: #fee2e2;
      --color-warning: #f59e0b;
      --color-warning-light: #fef3c7;
      --color-gray-50: #f9fafb;
      --color-gray-100: #f3f4f6;
      --color-gray-200: #e5e7eb;
      --color-gray-300: #d1d5db;
      --color-gray-400: #9ca3af;
      --color-gray-500: #6b7280;
      --color-gray-600: #4b5563;
      --color-gray-700: #374151;
      --color-gray-800: #1f2937;
      --color-gray-900: #111827;
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --transition: all 0.2s ease;

      display: block;
      height: 100%;
      overflow-y: auto;
      background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
    }

    /* ===== Page Container ===== */
    .page-container {
      max-width: 1800px;
      margin: 0 auto;
      padding: 24px 32px 48px;
      min-height: 100%;
    }

    /* ===== Page Header ===== */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 20px 24px;
      background: white;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .back-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      color: var(--color-gray-600);
      background: var(--color-gray-100);
      transition: var(--transition);

      &:hover {
        background: var(--color-gray-200);
        color: var(--color-gray-800);
      }
    }

    .header-title h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-gray-900);
      margin: 0;
    }

    .header-subtitle {
      font-size: 14px;
      color: var(--color-gray-500);
      margin: 4px 0 0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    /* ===== Buttons ===== */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: var(--transition);

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      svg {
        flex-shrink: 0;
      }
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;

      &:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }
    }

    .btn-secondary {
      background: var(--color-gray-100);
      color: var(--color-gray-700);

      &:hover:not(:disabled) {
        background: var(--color-gray-200);
      }
    }

    /* ===== Filter Bar ===== */
    .filter-bar {
      background: white;
      border-radius: var(--radius-xl);
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-md);
    }

    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: flex-end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .filter-group-search {
      flex: 1;
      min-width: 200px;
    }

    .filter-group-action {
      margin-left: auto;
    }

    .filter-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-gray-600);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filter-select,
    .filter-input {
      height: 40px;
      padding: 0 12px;
      font-size: 14px;
      border: 1px solid var(--color-gray-200);
      border-radius: var(--radius-md);
      background: white;
      color: var(--color-gray-800);
      transition: var(--transition);
      min-width: 160px;

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
    }

    .filter-tabs {
      display: flex;
      background: var(--color-gray-100);
      border-radius: var(--radius-md);
      padding: 4px;
    }

    .filter-tab {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-gray-600);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition);

      &:hover {
        color: var(--color-gray-800);
      }

      &.active {
        background: white;
        color: var(--color-primary);
        box-shadow: var(--shadow-sm);
      }
    }

    .search-input-wrapper {
      position: relative;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-gray-400);
    }

    .search-input {
      width: 100%;
      padding-left: 40px;
    }

    /* ===== Statistics Grid ===== */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      transition: var(--transition);

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
    }

    .stat-danger .stat-icon {
      background: var(--color-danger-light);
      color: var(--color-danger);
    }

    .stat-success .stat-icon {
      background: var(--color-success-light);
      color: var(--color-success);
    }

    .stat-primary .stat-icon {
      background: #dbeafe;
      color: var(--color-primary);
    }

    .stat-warning .stat-icon {
      background: var(--color-warning-light);
      color: var(--color-warning);
    }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--color-gray-900);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 13px;
      color: var(--color-gray-500);
      margin-top: 4px;
    }

    /* ===== Content Grid ===== */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;

      &.has-sidebar {
        grid-template-columns: 1fr 320px;
      }
    }

    /* ===== Table Section ===== */
    .table-section {
      background: white;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--color-gray-100);
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-gray-800);
      margin: 0;
    }

    .record-count {
      font-weight: 400;
      color: var(--color-gray-500);
      margin-left: 8px;
    }

    .table-container {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .data-table th {
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: var(--color-gray-500);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--color-gray-50);
      border-bottom: 1px solid var(--color-gray-200);
      white-space: nowrap;
    }

    .data-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-gray-100);
      color: var(--color-gray-700);
    }

    .data-table tbody tr {
      transition: var(--transition);

      &:hover {
        background: var(--color-gray-50);
      }

      &.row-returned {
        background: #f0fdf4;

        &:hover {
          background: #dcfce7;
        }
      }

      &.row-overdue:not(.row-returned) {
        background: #fff7ed;
      }
    }

    .status-badge {
      display: inline-flex;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 20px;

      &.status-returned {
        background: var(--color-success-light);
        color: #059669;
      }

      &.status-unreturned {
        background: var(--color-danger-light);
        color: #dc2626;
      }
    }

    .order-code {
      font-family: 'SF Mono', Monaco, 'Fira Code', monospace;
      font-size: 13px;
      color: var(--color-primary);
      background: #eff6ff;
      padding: 2px 8px;
      border-radius: var(--radius-sm);
    }

    .customer-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .customer-name {
      font-weight: 500;
      color: var(--color-gray-800);
    }

    .customer-phone {
      font-size: 12px;
      color: var(--color-gray-400);
    }

    .overdue-days {
      font-weight: 600;
      color: var(--color-warning);

      &.critical {
        color: var(--color-danger);
      }
    }

    .return-date {
      font-size: 13px;
      color: var(--color-success);
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition);
    }

    .btn-action-success {
      background: var(--color-success);
      color: white;

      &:hover {
        background: #059669;
      }
    }

    .action-completed {
      color: var(--color-gray-300);
    }

    /* ===== Sidebar Section ===== */
    .sidebar-section {
      background: white;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
      height: fit-content;
      position: sticky;
      top: 24px;
    }

    .branch-list {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 600px;
      overflow-y: auto;
    }

    .branch-card {
      padding: 14px 16px;
      background: var(--color-gray-50);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: var(--transition);

      &:hover {
        background: var(--color-gray-100);
      }
    }

    .branch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .branch-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--color-gray-800);
    }

    .branch-total {
      font-size: 13px;
      color: var(--color-gray-500);
    }

    .branch-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 10px;
    }

    .branch-stat {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      &.unreturned {
        color: var(--color-danger);
        .dot { background: var(--color-danger); }
      }

      &.returned {
        color: var(--color-success);
        .dot { background: var(--color-success); }
      }
    }

    .branch-progress {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-bar {
      flex: 1;
      height: 6px;
      background: var(--color-gray-200);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-success);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-gray-600);
      min-width: 36px;
    }

    /* ===== Loading & Empty States ===== */
    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--color-gray-500);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-gray-200);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    .loading-state p,
    .empty-state p {
      margin-top: 16px;
      font-size: 14px;
    }

    .empty-state svg {
      color: var(--color-gray-300);
    }

    /* ===== Print Area ===== */
    .print-area {
      display: none;
    }

    /* ===== Responsive ===== */
    @media (max-width: 1400px) {
      .content-grid.has-sidebar {
        grid-template-columns: 1fr;
      }

      .sidebar-section {
        position: static;
      }

      .branch-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        max-height: none;
      }
    }

    @media (max-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .filter-row {
        gap: 12px;
      }

      .filter-group-action {
        margin-left: 0;
        width: 100%;
      }

      .filter-group-action .btn {
        width: 100%;
        justify-content: center;
      }
    }

    @media (max-width: 768px) {
      .page-container {
        padding: 16px;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;
      }

      .header-actions {
        width: 100%;
      }

      .header-actions .btn {
        flex: 1;
        justify-content: center;
      }

      .stats-grid {
        grid-template-columns: 1fr 1fr;
      }

      .stat-card {
        padding: 16px;
      }

      .stat-value {
        font-size: 22px;
      }
    }

    /* ===== Print Styles ===== */
    @media print {
      :host {
        background: white !important;
      }

      .page-header,
      .filter-bar,
      .stats-grid,
      .content-grid {
        display: none !important;
      }

      .print-area {
        display: block !important;
        padding: 20px;
      }

      .print-header {
        text-align: center;
        margin-bottom: 24px;
        border-bottom: 2px solid #000;
        padding-bottom: 16px;
      }

      .print-header h1 {
        font-size: 22px;
        margin: 0 0 8px;
      }

      .print-header p {
        font-size: 12px;
        color: #666;
        margin: 4px 0;
      }

      .print-summary {
        display: flex;
        justify-content: space-around;
        margin-bottom: 20px;
        padding: 12px;
        background: #f5f5f5;
      }

      .print-summary span {
        font-size: 14px;
        font-weight: 600;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }

      .print-table th {
        background: #f0f0f0;
        font-weight: 600;
      }

      @page {
        size: A4 landscape;
        margin: 15mm;
      }
    }
  `],
})
export class UnreturnedItemsPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  // Date range
  today = new Date().toISOString().split('T')[0];
  readonly dateFrom = signal(this.getDefaultDateFrom());
  readonly dateTo = signal(this.today);

  // Filters
  readonly selectedBranch = signal<string>('');
  readonly statusFilter = signal<ReturnStatusFilter>('all');
  readonly searchTerm = signal('');

  // Data
  readonly isLoading = signal(false);
  readonly branches = signal<BranchOption[]>([]);
  readonly items = signal<UnreturnedItem[]>([]);
  readonly summary = signal({ totalCount: 0, unreturnedCount: 0, returnedCount: 0 });
  readonly branchSummary = signal<BranchSummary[]>([]);

  // Computed
  readonly isHqAdmin = computed(() =>
    this.authService.hasAnyRole(['HQ_ADMIN'])
  );

  readonly canMarkReturn = computed(() =>
    this.authService.hasAnyRole(['HQ_ADMIN', 'BRANCH_MANAGER'])
  );

  readonly overdueCount = computed(() =>
    this.items().filter(item => !item.isReturned && this.getDaysOverdue(item) > 7).length
  );

  readonly filteredItems = computed(() => {
    let result = this.items();
    const filter = this.statusFilter();
    const search = this.searchTerm().toLowerCase().trim();

    if (filter === 'unreturned') {
      result = result.filter(item => !item.isReturned);
    } else if (filter === 'returned') {
      result = result.filter(item => item.isReturned);
    }

    if (search) {
      result = result.filter(item =>
        item.orderNo.toLowerCase().includes(search) ||
        item.customerName.toLowerCase().includes(search) ||
        (item.productName?.toLowerCase().includes(search) ?? false) ||
        (item.branchName?.toLowerCase().includes(search) ?? false)
      );
    }

    return result;
  });

  printDateTime = new Date().toLocaleString('ko-KR');

  ngOnInit(): void {
    this.loadBranches();
    this.loadData();
  }

  private getDefaultDateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  loadBranches(): void {
    if (this.isHqAdmin()) {
      this.reportsService.getBranches().subscribe({
        next: (data) => this.branches.set(data || []),
        error: (err) => console.error('Failed to load branches:', err),
      });
    }
  }

  loadData(): void {
    this.isLoading.set(true);

    // HQ_ADMIN: use selected branch (empty = all)
    // Others: use their own branch
    const branchCode = this.isHqAdmin()
      ? this.selectedBranch() || undefined
      : this.authService.user()?.branchCode;

    this.reportsService.getUnreturnedItems({
      branchCode,
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
    }).subscribe({
      next: (data) => {
        this.items.set(data.items || []);
        this.summary.set({
          totalCount: data.totalCount || 0,
          unreturnedCount: data.unreturnedCount || 0,
          returnedCount: data.returnedCount || 0,
        });
        this.branchSummary.set(data.byBranch || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load unreturned items:', err);
        this.items.set([]);
        this.summary.set({ totalCount: 0, unreturnedCount: 0, returnedCount: 0 });
        this.branchSummary.set([]);
        this.isLoading.set(false);
      },
    });
  }

  onBranchChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedBranch.set(value);
    this.loadData();
  }

  onBranchCardClick(branchCode: string): void {
    if (this.isHqAdmin()) {
      this.selectedBranch.set(branchCode);
      this.loadData();
    }
  }

  onDateFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.dateFrom.set(value);
      this.loadData();
    }
  }

  onDateToChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.dateTo.set(value);
      this.loadData();
    }
  }

  setStatusFilter(status: ReturnStatusFilter): void {
    this.statusFilter.set(status);
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  getDaysOverdue(item: UnreturnedItem): number {
    const cancelDate = new Date(item.cancelledAt);
    const today = new Date();
    const diffTime = today.getTime() - cancelDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  isOverdue(item: UnreturnedItem): boolean {
    return !item.isReturned && this.getDaysOverdue(item) > 7;
  }

  getReturnRate(branch: BranchSummary): number {
    const total = branch.unreturnedCount + branch.returnedCount;
    if (total === 0) return 0;
    return (branch.returnedCount / total) * 100;
  }

  getTranslatedCancelReason(reason?: string): string {
    if (!reason) return '-';
    const key = `COMMON.CANCEL_REASONS.${reason}`;
    const translated = this.translate.instant(key);
    return translated === key ? reason : translated;
  }

  async markAsReturned(item: UnreturnedItem): Promise<void> {
    const header = this.translate.instant('REPORTS.UNRETURNED_ITEMS.MARK_RETURN_TITLE');
    const message = this.translate.instant('REPORTS.UNRETURNED_ITEMS.MARK_RETURN_CONFIRM', { orderNo: item.orderNo });
    const cancelBtn = this.translate.instant('COMMON.BUTTONS.CANCEL');
    const okBtn = this.translate.instant('COMMON.BUTTONS.OK');

    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        { text: cancelBtn, role: 'cancel' },
        {
          text: okBtn,
          handler: async () => {
            try {
              await this.reportsService.markItemAsReturned(item.orderId).toPromise();
              const toast = await this.toastCtrl.create({
                message: this.translate.instant('REPORTS.UNRETURNED_ITEMS.MARK_RETURN_SUCCESS'),
                duration: 2000,
                color: 'success',
              });
              await toast.present();
              this.loadData();
            } catch (error: any) {
              const is403 = error?.status === 403;
              const errorMsg = is403
                ? this.translate.instant('REPORTS.UNRETURNED_ITEMS.PERMISSION_DENIED')
                : this.translate.instant('REPORTS.UNRETURNED_ITEMS.MARK_RETURN_FAILED');
              const toast = await this.toastCtrl.create({
                message: errorMsg,
                duration: 3000,
                color: 'danger',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  printReport(): void {
    this.printDateTime = new Date().toLocaleString('ko-KR');
    setTimeout(() => window.print(), 100);
  }

  async exportCsv(): Promise<void> {
    try {
      const headers = [
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.TABLE.STATUS'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.BRANCH'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.TABLE.ORDER_NO'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.TABLE.CUSTOMER'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.TABLE.PRODUCT'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.CANCEL_DATE'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.TABLE.CANCEL_REASON'),
        this.translate.instant('REPORTS.UNRETURNED_ITEMS.TABLE.RETURN_DATE'),
      ];

      const rows = this.filteredItems().map(item => [
        item.isReturned
          ? this.translate.instant('REPORTS.UNRETURNED_ITEMS.RETURNED')
          : this.translate.instant('REPORTS.UNRETURNED_ITEMS.NOT_RETURNED'),
        item.branchName || '',
        item.orderNo,
        item.customerName,
        item.productName || '',
        new Date(item.cancelledAt).toLocaleDateString('ko-KR'),
        this.getTranslatedCancelReason(item.cancelReason),
        item.returnedAt ? new Date(item.returnedAt).toLocaleDateString('ko-KR') : '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `unreturned_items_${this.dateFrom()}_${this.dateTo()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      const toast = await this.toastCtrl.create({
        message: this.translate.instant('REPORTS.UNRETURNED_ITEMS.EXPORT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: this.translate.instant('REPORTS.UNRETURNED_ITEMS.EXPORT_FAILED'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
