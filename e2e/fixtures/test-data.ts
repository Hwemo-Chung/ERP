/**
 * E2E Test Fixtures and Test Data
 */

export const TEST_USERS = {
  admin: {
    username: 'admin@test.com',
    password: 'TestAdmin123!',
    role: 'HQ_ADMIN',
  },
  centerManager: {
    username: 'center@test.com',
    password: 'TestCenter123!',
    role: 'CENTER_MANAGER',
  },
  installer: {
    username: 'installer@test.com',
    password: 'TestInstaller123!',
    role: 'INSTALLER',
  },
} as const;

export const TEST_ORDERS = {
  pending: {
    id: 'order-pending-001',
    orderNumber: 'ORD-2024-001',
    status: 'PENDING',
    customerName: 'Test Customer 1',
    customerPhone: '010-1234-5678',
    customerAddress: 'Seoul, Gangnam-gu, Test Street 123',
  },
  assigned: {
    id: 'order-assigned-001',
    orderNumber: 'ORD-2024-002',
    status: 'ASSIGNED',
    customerName: 'Test Customer 2',
    customerPhone: '010-2345-6789',
    customerAddress: 'Seoul, Seocho-gu, Test Avenue 456',
  },
  dispatched: {
    id: 'order-dispatched-001',
    orderNumber: 'ORD-2024-003',
    status: 'DISPATCHED',
    customerName: 'Test Customer 3',
    customerPhone: '010-3456-7890',
    customerAddress: 'Seoul, Mapo-gu, Test Road 789',
  },
  completed: {
    id: 'order-completed-001',
    orderNumber: 'ORD-2024-004',
    status: 'COMPLETED',
    customerName: 'Test Customer 4',
    customerPhone: '010-4567-8901',
    customerAddress: 'Seoul, Yongsan-gu, Test Lane 012',
  },
} as const;

export const WASTE_CODES = {
  refrigerator: { code: 'WC001', name: 'Refrigerator', fee: 15000 },
  washingMachine: { code: 'WC002', name: 'Washing Machine', fee: 12000 },
  airConditioner: { code: 'WC003', name: 'Air Conditioner', fee: 18000 },
  television: { code: 'WC004', name: 'Television', fee: 8000 },
} as const;

export const API_ENDPOINTS = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  orders: '/api/orders',
  assignments: '/api/assignments',
  completions: '/api/completions',
  reports: '/api/reports',
} as const;
