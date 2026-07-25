import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PartnersService } from './partners.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  partner: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  storageContract: { create: jest.fn() },
  $transaction: jest.fn(),
};
// ponytail: split from object-literal initializer — TS strict mode (noImplicitAny) can't
// infer a self-referencing property type inline; assigning after declaration is the
// smallest fix that keeps behavior identical (fn receives the same prismaMock as tx).
prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));

const baseDto = {
  name: '테스트상사',
  businessRegistrationNo: '120-81-47521',
  storageContract: {
    contractType: 'PALLET_DAILY' as const,
    palletDailyRate: '1500',
    startDate: '2026-07-01',
  },
};

describe('PartnersService', () => {
  let service: PartnersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [PartnersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(PartnersService);
  });

  it('rejects invalid BRN checksum with E4101', async () => {
    await expect(
      service.create({ ...baseDto, businessRegistrationNo: '111-11-11111' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate BRN with E4102', async () => {
    prismaMock.partner.findFirst.mockResolvedValueOnce({ id: 'x' });
    await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
  });

  it('rejects PALLET_DAILY contract without palletDailyRate (E4103)', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    await expect(
      service.create({
        ...baseDto,
        storageContract: { contractType: 'PALLET_DAILY' as const, startDate: '2026-07-01' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('auto-generates code P-0001 when code absent', async () => {
    prismaMock.partner.findFirst
      .mockResolvedValueOnce(null) // BRN dup check
      .mockResolvedValueOnce(null); // last auto code
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'P-0001' });
    await service.create(baseDto);
    expect(prismaMock.partner.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'P-0001' }) }),
    );
  });

  it('persists areaBillingMode on the storage contract when provided', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'P-0001' });
    await service.create({
      ...baseDto,
      storageContract: {
        contractType: 'AREA_MONTHLY',
        areaPyeong: '100',
        areaRate: '10000',
        areaBillingMode: 'DAILY_PRORATED',
        startDate: '2026-07-01',
      },
    });
    expect(prismaMock.storageContract.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ areaBillingMode: 'DAILY_PRORATED' }) }),
    );
  });

  it('leaves areaBillingMode undefined (DB default FULL_MONTH applies) when not provided', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'P-0001' });
    await service.create(baseDto);
    expect(prismaMock.storageContract.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ areaBillingMode: undefined }) }),
    );
  });

  it('keeps provided excel code as-is', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    prismaMock.partner.findUnique.mockResolvedValue(null);
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'KM001' });
    await service.create({ ...baseDto, code: 'KM001' });
    expect(prismaMock.partner.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'KM001' }) }),
    );
  });

  describe('findAll — F1 role-aware projection (spec §2: no 요율 for staff)', () => {
    const rows = [{
      id: 'p1', code: 'P-0001', name: 'A', defaultTransportRate: '3000',
      storageContracts: [{ id: 'c1', contractType: 'PALLET_DAILY', palletDailyRate: '1500', areaPyeong: null, areaRate: null }],
    }];

    beforeEach(() => {
      prismaMock.partner.findMany.mockResolvedValue(rows);
      prismaMock.partner.count.mockResolvedValue(1);
    });

    it('strips defaultTransportRate for a WAREHOUSE_STAFF-only caller', async () => {
      const r = await service.findAll({}, [Role.WAREHOUSE_STAFF]);
      expect(r.data[0]).not.toHaveProperty('defaultTransportRate');
    });

    it('strips storageContracts (palletDailyRate/areaRate/areaPyeong) for a WAREHOUSE_STAFF-only caller', async () => {
      const r = await service.findAll({}, [Role.WAREHOUSE_STAFF]);
      expect(r.data[0]).not.toHaveProperty('storageContracts');
    });

    it('keeps defaultTransportRate for HQ_ADMIN', async () => {
      const r = await service.findAll({}, [Role.HQ_ADMIN]);
      expect(r.data[0]).toHaveProperty('defaultTransportRate', '3000');
    });

    it('keeps storageContracts for HQ_ADMIN', async () => {
      const r = await service.findAll({}, [Role.HQ_ADMIN]);
      expect(r.data[0]).toHaveProperty('storageContracts', rows[0].storageContracts);
    });

    it('keeps defaultTransportRate when the caller carries both roles', async () => {
      const r = await service.findAll({}, [Role.HQ_ADMIN, Role.WAREHOUSE_STAFF]);
      expect(r.data[0]).toHaveProperty('defaultTransportRate', '3000');
    });

    it('defaults to unfiltered when no roles are passed', async () => {
      const r = await service.findAll({});
      expect(r.data[0]).toHaveProperty('defaultTransportRate', '3000');
    });
  });
});
