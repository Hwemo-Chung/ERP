import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isStaffOnly } from '../common/staff-price-visibility.util';
import { assertRateEffectiveFromAdvances } from '../common/rate-effective-from.util';

export const PALLET_THRESHOLD_KEY = 'pallet_threshold_default';
export const VEHICLE_RATE_MODE_KEY = 'vehicle_rate_mode';
export type VehicleRateModeSetting = 'REPLACE' | 'ADD';

// P0-1: "적용 시작일" 미입력 시 오늘 날짜(로컬, 자정 기준)를 기본값으로 쓴다. @db.Date 컬럼이라
// 시각 정보는 의미가 없으므로 UTC 자정으로 정규화해 날짜 비교가 항상 date-only로 맞아떨어지게 한다.
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  createRateCard(dto: {
    vehicleType: string;
    tonnage?: string;
    containerSize?: string;
    specialEquipment?: string;
    rate: string;
    rateEffectiveFrom?: string;
  }) {
    const { rateEffectiveFrom, ...rest } = dto;
    const effectiveFrom = rateEffectiveFrom ? new Date(rateEffectiveFrom) : todayDateOnly();
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.transportRateCard.create({ data: rest });
      await tx.vehicleRateHistory.create({
        data: { rateCardId: card.id, rate: rest.rate, effectiveFrom, effectiveTo: null },
      });
      return card;
    });
  }

  async listRateCards(callerRoles: Role[] = []) {
    const cards = await this.prisma.transportRateCard.findMany({
      where: { isActive: true },
      orderBy: [{ vehicleType: 'asc' }, { tonnage: 'asc' }],
    });
    // spec §2: WAREHOUSE_STAFF (without HQ_ADMIN) must not receive 요율 — the vehicle-select
    // dropdown only needs id/vehicleType/tonnage/containerSize/specialEquipment labels.
    if (!isStaffOnly(callerRoles)) return cards;
    return cards.map(({ rate: _rate, ...rest }) => rest);
  }

  async updateRateCard(
    id: string,
    dto: Partial<{
      vehicleType: string;
      tonnage: string;
      containerSize: string;
      specialEquipment: string;
      rate: string;
      rateEffectiveFrom: string;
    }>,
  ) {
    await this.assertExists(id);
    const { rate, rateEffectiveFrom, ...rest } = dto;
    if (rate === undefined) {
      return this.prisma.transportRateCard.update({ where: { id }, data: rest });
    }
    // 요율 변경: 히스토리의 열린 행(effectiveTo IS NULL)을 새 적용시작일로 닫고 새 행을 열면서,
    // 캐시 컬럼(TransportRateCard.rate)도 같은 트랜잭션에서 갱신 — 둘이 어긋나면 안 된다.
    const effectiveFrom = rateEffectiveFrom ? new Date(rateEffectiveFrom) : todayDateOnly();
    return this.prisma.$transaction(async (tx) => {
      const openRow = await tx.vehicleRateHistory.findFirst({ where: { rateCardId: id, effectiveTo: null } });
      assertRateEffectiveFromAdvances(openRow?.effectiveFrom, effectiveFrom);
      await tx.vehicleRateHistory.updateMany({
        where: { rateCardId: id, effectiveTo: null },
        data: { effectiveTo: effectiveFrom },
      });
      await tx.vehicleRateHistory.create({
        data: { rateCardId: id, rate, effectiveFrom, effectiveTo: null },
      });
      return tx.transportRateCard.update({ where: { id }, data: { ...rest, rate } });
    });
  }

  async deactivateRateCard(id: string) {
    await this.assertExists(id);
    return this.prisma.transportRateCard.update({ where: { id }, data: { isActive: false } });
  }

  async getRateHistory(id: string) {
    await this.assertExists(id);
    return this.prisma.vehicleRateHistory.findMany({
      where: { rateCardId: id },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async assertExists(id: string) {
    const existing = await this.prisma.transportRateCard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'E4104', message: 'rate card not found' });
  }

  async getPalletThreshold(): Promise<number> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key: PALLET_THRESHOLD_KEY } });
    return s ? Number(s.value) : 70;
  }

  async setPalletThreshold(pct: number): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: PALLET_THRESHOLD_KEY },
      create: { key: PALLET_THRESHOLD_KEY, value: String(pct) },
      update: { value: String(pct) },
    });
  }

  async getVehicleRateMode(): Promise<VehicleRateModeSetting> {
    const s = await this.prisma.systemSetting.findUnique({ where: { key: VEHICLE_RATE_MODE_KEY } });
    return (s?.value as VehicleRateModeSetting) ?? 'REPLACE';
  }

  async setVehicleRateMode(mode: VehicleRateModeSetting): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: VEHICLE_RATE_MODE_KEY },
      create: { key: VEHICLE_RATE_MODE_KEY, value: mode },
      update: { value: mode },
    });
  }
}
