// apps/api/src/master-data/master-data-read-roles.spec.ts
// Guards the WAREHOUSE_STAFF read-access override added for Task 15's warehouse feature:
// PartnersController/ProductsController/RatesController are @Roles(HQ_ADMIN)-only at the
// class level, but their read-only GET handlers must additionally allow WAREHOUSE_STAFF
// (RolesGuard's reflector.getAllAndOverride means the method-level @Roles here wins).
// Writes (create/update) are untouched and stay HQ_ADMIN-only.
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PartnersController } from './partners.controller';
import { ProductsController } from './products.controller';
import { RatesController } from './rates.controller';

function methodRoles(ctor: { prototype: object }, method: string): Role[] | undefined {
  return Reflect.getMetadata(ROLES_KEY, (ctor.prototype as any)[method]);
}

describe('master-data read endpoints allow WAREHOUSE_STAFF', () => {
  it('PartnersController.findAll (GET) allows HQ_ADMIN + WAREHOUSE_STAFF', () => {
    expect(methodRoles(PartnersController, 'findAll')).toEqual([Role.HQ_ADMIN, Role.WAREHOUSE_STAFF]);
  });
  it('PartnersController.create/update carry no method-level override (class-level HQ_ADMIN-only stands)', () => {
    expect(methodRoles(PartnersController, 'create')).toBeUndefined();
    expect(methodRoles(PartnersController, 'update')).toBeUndefined();
  });

  it('ProductsController.findAll (GET) allows HQ_ADMIN + WAREHOUSE_STAFF', () => {
    expect(methodRoles(ProductsController, 'findAll')).toEqual([Role.HQ_ADMIN, Role.WAREHOUSE_STAFF]);
  });
  it('ProductsController.create/update carry no method-level override', () => {
    expect(methodRoles(ProductsController, 'create')).toBeUndefined();
    expect(methodRoles(ProductsController, 'update')).toBeUndefined();
  });

  it('RatesController.findAll (GET rate-cards) allows HQ_ADMIN + WAREHOUSE_STAFF', () => {
    expect(methodRoles(RatesController, 'findAll')).toEqual([Role.HQ_ADMIN, Role.WAREHOUSE_STAFF]);
  });
  it('RatesController write/other handlers carry no method-level override', () => {
    expect(methodRoles(RatesController, 'create')).toBeUndefined();
    expect(methodRoles(RatesController, 'update')).toBeUndefined();
    expect(methodRoles(RatesController, 'deactivate')).toBeUndefined();
    expect(methodRoles(RatesController, 'getPalletThreshold')).toBeUndefined();
    expect(methodRoles(RatesController, 'setPalletThreshold')).toBeUndefined();
  });
});
