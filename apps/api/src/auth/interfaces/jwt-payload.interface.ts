import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;           // User ID
  username: string;
  roles: Role[];
  branchId?: string;     // Branch UUID for direct DB queries
  branchCode?: string;   // Branch code for display
  iat?: number;          // Issued at
  exp?: number;          // Expiration
}
