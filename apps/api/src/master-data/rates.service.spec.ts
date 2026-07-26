import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RatesService } from './rates.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock: any = {
  transportRateCard: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  systemSetting: { findUnique: jest.fn(), upsert: jest.fn() },
  vehicleRateHistory: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
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

  describe('P0-1 요율 히스토리 쓰기 경로', () => {
    it('createRateCard opens an initial history row alongside the cache row, in one transaction', async () => {
      prismaMock.transportRateCard.create.mockResolvedValue({ id: 'r1', rate: '50000' });
      await service.createRateCard({ vehicleType: '트럭', rate: '50000', rateEffectiveFrom: '2026-07-01' });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.transportRateCard.create).toHaveBeenCalledWith({
        data: { vehicleType: '트럭', rate: '50000' },
      });
      expect(prismaMock.vehicleRateHistory.create).toHaveBeenCalledWith({
        data: { rateCardId: 'r1', rate: '50000', effectiveFrom: new Date('2026-07-01'), effectiveTo: null },
      });
    });

    it('updateRateCard closes the previously-open history row and opens a new one when rate changes', async () => {
      prismaMock.transportRateCard.findUnique.mockResolvedValue({ id: 'r1', rate: '50000' });
      prismaMock.transportRateCard.update.mockResolvedValue({ id: 'r1', rate: '60000' });
      await service.updateRateCard('r1', { rate: '60000', rateEffectiveFrom: '2026-07-15' });

      expect(prismaMock.vehicleRateHistory.updateMany).toHaveBeenCalledWith({
        where: { rateCardId: 'r1', effectiveTo: null },
        data: { effectiveTo: new Date('2026-07-15') },
      });
      expect(prismaMock.vehicleRateHistory.create).toHaveBeenCalledWith({
        data: { rateCardId: 'r1', rate: '60000', effectiveFrom: new Date('2026-07-15'), effectiveTo: null },
      });
      expect(prismaMock.transportRateCard.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { rate: '60000' },
      });
    });

    it('updateRateCard skips history writes entirely when rate is not part of the patch', async () => {
      prismaMock.transportRateCard.findUnique.mockResolvedValue({ id: 'r1', rate: '50000' });
      prismaMock.transportRateCard.update.mockResolvedValue({ id: 'r1', vehicleType: '중형트럭' });
      await service.updateRateCard('r1', { vehicleType: '중형트럭' });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.vehicleRateHistory.create).not.toHaveBeenCalled();
      expect(prismaMock.transportRateCard.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { vehicleType: '중형트럭' },
      });
    });

    it('getRateHistory returns history ordered by effectiveFrom desc, 404s on unknown card', async () => {
      prismaMock.transportRateCard.findUnique.mockResolvedValue({ id: 'r1' });
      prismaMock.vehicleRateHistory.findMany.mockResolvedValue([{ rate: '60000' }]);
      const history = await service.getRateHistory('r1');
      expect(prismaMock.vehicleRateHistory.findMany).toHaveBeenCalledWith({
        where: { rateCardId: 'r1' },
        orderBy: { effectiveFrom: 'desc' },
      });
      expect(history).toEqual([{ rate: '60000' }]);

      prismaMock.transportRateCard.findUnique.mockResolvedValue(null);
      await expect(service.getRateHistory('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
