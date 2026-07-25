import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RatesService } from './rates.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  transportRateCard: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
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

  it('returns default REPLACE when vehicle rate mode unset', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue(null);
    expect(await service.getVehicleRateMode()).toBe('REPLACE');
  });

  it('returns stored vehicle rate mode', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'vehicle_rate_mode', value: 'ADD' });
    expect(await service.getVehicleRateMode()).toBe('ADD');
  });

  it('upserts vehicle rate mode on set', async () => {
    await service.setVehicleRateMode('ADD');
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'vehicle_rate_mode' },
      create: { key: 'vehicle_rate_mode', value: 'ADD' },
      update: { value: 'ADD' },
    });
  });

  it('rejects deactivate of unknown rate card with E4104', async () => {
    prismaMock.transportRateCard.findUnique.mockResolvedValue(null);
    await expect(service.deactivateRateCard('missing-id')).rejects.toThrow(NotFoundException);
    expect(prismaMock.transportRateCard.update).not.toHaveBeenCalled();
  });

  describe('listRateCards — F1 role-aware projection (spec §2: no 요율 for staff)', () => {
    const cards = [{ id: 'r1', vehicleType: '트럭', tonnage: '5', containerSize: null, specialEquipment: null, rate: '50000' }];

    beforeEach(() => {
      prismaMock.transportRateCard.findMany.mockResolvedValue(cards);
    });

    it('strips rate for a WAREHOUSE_STAFF-only caller, keeping dropdown labels', async () => {
      const r = await service.listRateCards([Role.WAREHOUSE_STAFF]);
      expect(r[0]).not.toHaveProperty('rate');
      expect(r[0]).toMatchObject({ id: 'r1', vehicleType: '트럭', tonnage: '5' });
    });

    it('keeps rate for HQ_ADMIN', async () => {
      const r = await service.listRateCards([Role.HQ_ADMIN]);
      expect(r[0]).toHaveProperty('rate', '50000');
    });

    it('keeps rate when the caller carries both roles', async () => {
      const r = await service.listRateCards([Role.HQ_ADMIN, Role.WAREHOUSE_STAFF]);
      expect(r[0]).toHaveProperty('rate', '50000');
    });
  });
});
