import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isStaffOnly } from '../common/staff-price-visibility.util';

export const PALLET_THRESHOLD_KEY = 'pallet_threshold_default';
export const VEHICLE_RATE_MODE_KEY = 'vehicle_rate_mode';
export type VehicleRateModeSetting = 'REPLACE' | 'ADD';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  createRateCard(dto: {
    vehicleType: string;
    tonnage?: string;
    containerSize?: string;
    specialEquipment?: string;
    rate: string;
  }) {
    return this.prisma.transportRateCard.create({ data: dto });
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
    dto: Partial<{ vehicleType: string; tonnage: string; containerSize: string; specialEquipment: string; rate: string }>,
  ) {
    await this.assertExists(id);
    return this.prisma.transportRateCard.update({ where: { id }, data: dto });
  }

  async deactivateRateCard(id: string) {
    await this.assertExists(id);
    return this.prisma.transportRateCard.update({ where: { id }, data: { isActive: false } });
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
