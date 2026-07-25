import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PALLET_THRESHOLD_KEY = 'pallet_threshold_default';

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

  listRateCards() {
    return this.prisma.transportRateCard.findMany({
      where: { isActive: true },
      orderBy: [{ vehicleType: 'asc' }, { tonnage: 'asc' }],
    });
  }

  updateRateCard(
    id: string,
    dto: Partial<{ vehicleType: string; tonnage: string; containerSize: string; specialEquipment: string; rate: string }>,
  ) {
    return this.prisma.transportRateCard.update({ where: { id }, data: dto });
  }

  deactivateRateCard(id: string) {
    return this.prisma.transportRateCard.update({ where: { id }, data: { isActive: false } });
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
}
