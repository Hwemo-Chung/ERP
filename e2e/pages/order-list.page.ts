/**
 * Order List Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class OrderListPage extends BasePage {
  // Locators
  private readonly orderCards = this.page.locator('app-order-card, .order-card, .order-item');
  private readonly searchInput = this.page.locator('ion-searchbar input, input[type="search"]');
  private readonly statusFilter = this.page.locator('ion-select[name="status"], select[name="status"]');
  private readonly dateFilter = this.page.locator('ion-datetime-button, input[type="date"]');
  private readonly refreshButton = this.page.locator('ion-refresher, ion-button[aria-label="refresh"]');
  private readonly emptyState = this.page.locator('.empty-state, ion-text:has-text("No orders")');

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/orders');
    await this.waitForLoad();
  }

  /**
   * Get all order cards
   */
  async getOrders(): Promise<Locator> {
    return this.orderCards;
  }

  /**
   * Get order count
   */
  async getOrderCount(): Promise<number> {
    return this.orderCards.count();
  }

  /**
   * Search for orders
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingComplete();
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.click();
    await this.page.locator(`ion-select-option:has-text("${status}")`).click();
    await this.waitForLoadingComplete();
  }

  /**
   * Click on order by order number
   */
  async clickOrder(orderNumber: string): Promise<void> {
    await this.page.locator(`[data-order-number="${orderNumber}"], :has-text("${orderNumber}")`).first().click();
  }

  /**
   * Check if order exists in list
   */
  async orderExists(orderNumber: string): Promise<boolean> {
    const order = this.page.locator(`:has-text("${orderNumber}")`).first();
    return order.isVisible();
  }

  /**
   * Pull to refresh
   */
  async pullToRefresh(): Promise<void> {
    // Simulate pull-to-refresh gesture
    await this.page.locator('ion-content').evaluate((el) => {
      el.dispatchEvent(new CustomEvent('ionRefresh'));
    });
    await this.waitForLoadingComplete();
  }

  /**
   * Check if empty state is visible
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Sort orders by field
   */
  async sortBy(field: 'date' | 'status' | 'customer'): Promise<void> {
    const sortButton = this.page.locator(`[data-sort="${field}"], ion-button:has-text("${field}")`);
    await sortButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Get order status from card
   */
  async getOrderStatus(orderNumber: string): Promise<string> {
    const orderCard = this.page.locator(`:has-text("${orderNumber}")`).first();
    const statusBadge = orderCard.locator('ion-badge, .status-badge');
    return (await statusBadge.textContent()) || '';
  }

  /**
   * Wait for orders to load
   */
  async waitForOrdersLoaded(): Promise<void> {
    await this.page.waitForSelector('app-order-card, .order-card, .empty-state', { timeout: 10000 });
  }
}
