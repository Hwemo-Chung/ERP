import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  partner: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
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

  it('keeps provided excel code as-is', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    prismaMock.partner.findUnique.mockResolvedValue(null);
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'KM001' });
    await service.create({ ...baseDto, code: 'KM001' });
    expect(prismaMock.partner.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'KM001' }) }),
    );
  });
});
