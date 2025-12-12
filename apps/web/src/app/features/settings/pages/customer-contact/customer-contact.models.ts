/**
 * Customer Contact Models
 * 고객사 연락처 관리 데이터 모델
 */

export interface CustomerContact {
  id: string;
  customerCode: string;
  customerName: string;
  contactName: string;
  department: string;
  phone: string;
  email: string;
  address: string;
  businessType: 'receiver' | 'pickup' | 'both';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memo?: string;
}

export interface CustomerContactFilter {
  searchTerm?: string;
  businessType?: string;
  isActive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
