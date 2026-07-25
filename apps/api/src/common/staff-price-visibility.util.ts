import { Role } from '@prisma/client';

/**
 * spec §2: WAREHOUSE_STAFF must not receive 단가/원가/요율 fields. HQ_ADMIN always sees
 * everything (including when a user also happens to carry WAREHOUSE_STAFF), so this is only
 * true for a caller whose roles are staff-only.
 */
export function isStaffOnly(roles: Role[] = []): boolean {
  return roles.includes(Role.WAREHOUSE_STAFF) && !roles.includes(Role.HQ_ADMIN);
}
