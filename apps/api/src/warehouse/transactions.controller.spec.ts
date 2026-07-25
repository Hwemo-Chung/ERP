import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionImportService } from './transaction-import.service';
import { StatementExportService } from '../settlement-fees/statement-export.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: { findAll: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    service = { findAll: jest.fn().mockResolvedValue({ data: [], totalCount: 0 }), create: jest.fn() };
    controller = new TransactionsController(
      service as unknown as TransactionsService,
      {} as unknown as TransactionImportService,
      {} as unknown as StatementExportService,
    );
  });

  it('forces scope.partnerId to the coordinator own partnerId, ignoring the query param', async () => {
    const user: JwtPayload = {
      sub: 'u1',
      username: 'coord',
      roles: [Role.PARTNER_COORDINATOR],
      partnerId: 'p1',
    };

    await controller.findAll({ partnerId: 'REQUESTED-OTHER' } as any, user);

    expect(service.findAll).toHaveBeenCalledWith(
      { partnerId: 'REQUESTED-OTHER' },
      { partnerId: 'p1' },
      [Role.PARTNER_COORDINATOR],
    );
  });

  it('rejects a PARTNER_COORDINATOR with no partnerId instead of falling through to unscoped access', async () => {
    const user: JwtPayload = {
      sub: 'u1',
      username: 'coord',
      roles: [Role.PARTNER_COORDINATOR],
      partnerId: undefined,
    };

    expect(() => controller.findAll({} as any, user)).toThrow(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('leaves scope unforced for HQ_ADMIN / WAREHOUSE_STAFF', async () => {
    const user: JwtPayload = { sub: 'u1', username: 'admin', roles: [Role.HQ_ADMIN] };

    await controller.findAll({ partnerId: 'ANY' } as any, user);

    expect(service.findAll).toHaveBeenCalledWith({ partnerId: 'ANY' }, {}, [Role.HQ_ADMIN]);
  });
});
