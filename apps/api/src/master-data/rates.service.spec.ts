import { Test } from '@nestjs/testing';
import { RatesService } from './rates.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  transportRateCard: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  systemSetting: { findUnique: jest.fn(), upsert: jest.fn() },
};

describe('RatesService', () => {
  let service: RatesService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [RatesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(RatesService);
  });

  it('returns default 70 when threshold unset', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null);
    expect(await service.getPalletThreshold()).toBe(70);
  });

  it('returns stored threshold', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'pallet_threshold_default', value: '80' });
    expect(await service.getPalletThreshold()).toBe(80);
  });

  it('upserts threshold on set', async () => {
    await service.setPalletThreshold(65);
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'pallet_threshold_default' },
      create: { key: 'pallet_threshold_default', value: '65' },
      update: { value: '65' },
    });
  });
});
