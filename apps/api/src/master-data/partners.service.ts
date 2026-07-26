import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
// ponytail: import from the `/utils` subpath, not the `@erp/shared` root barrel — the root
// re-exports Angular-only interceptors (packages/shared/src/interceptors) which pull in
// @angular/core and fail to transform under this app's plain ts-jest (CJS) config.
import { validateBusinessRegistrationNo, normalizeBrn } from '../common/business-registration';
import { isStaffOnly } from '../common/staff-price-visibility.util';
import { CreatePartnerDto, StorageContractDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { GetPartnersDto } from './dto/get-partners.dto';
import { assertRateEffectiveFromAdvances } from '../common/rate-effective-from.util';

// P0-1: "적용 시작일" 미입력 시 오늘 날짜(로컬, 자정 기준)를 기본값으로 쓴다 — rates.service.ts /
// products.service.ts와 동일한 헬퍼, 세 스코프에 독립적으로 둔다(공유 모듈 비용이 더 큼).
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartnerDto) {
    const brn = dto.businessRegistrationNo ? normalizeBrn(dto.businessRegistrationNo) : null;
    if (brn) {
      if (!validateBusinessRegistrationNo(brn)) {
        throw new BadRequestException({ code: 'E4101', message: 'invalid business registration number' });
      }
      const dup = await this.prisma.partner.findFirst({ where: { businessRegistrationNo: brn } });
      if (dup) throw new ConflictException({ code: 'E4102', message: 'duplicate business registration number' });
    }
    this.assertContractComplete(dto.storageContract);

    const code = dto.code ?? (await this.nextPartnerCode());
    if (dto.code) {
      const codeDup = await this.prisma.partner.findUnique({ where: { code: dto.code } });
      if (codeDup) throw new ConflictException({ code: 'E4102', message: 'duplicate partner code' });
    }

    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: {
          code,
          name: dto.name,
          businessRegistrationNo: brn,
          representativeName: dto.representativeName,
          businessType: dto.businessType,
          businessCategory: dto.businessCategory,
          address: dto.address,
          contactName: dto.contactName,
          phone: dto.phone,
          email: dto.email,
          defaultTransportRate: dto.defaultTransportRate,
        },
      });
      await tx.storageContract.create({
        data: {
          partnerId: partner.id,
          contractType: dto.storageContract.contractType,
          palletDailyRate: dto.storageContract.palletDailyRate,
          areaPyeong: dto.storageContract.areaPyeong,
          areaRate: dto.storageContract.areaRate,
          areaBillingMode: dto.storageContract.areaBillingMode,
          startDate: new Date(dto.storageContract.startDate),
          endDate: dto.storageContract.endDate ? new Date(dto.storageContract.endDate) : null,
        },
      });
      if (dto.defaultTransportRate != null) {
        const effectiveFrom = dto.rateEffectiveFrom ? new Date(dto.rateEffectiveFrom) : todayDateOnly();
        await tx.partnerTransportRateHistory.create({
          data: { partnerId: partner.id, rate: dto.defaultTransportRate, effectiveFrom, effectiveTo: null },
        });
      }
      return partner;
    });
  }

  private assertContractComplete(c: StorageContractDto) {
    if (c.contractType === 'PALLET_DAILY' && !c.palletDailyRate) {
      throw new BadRequestException({
        code: 'E4103',
        message: 'palletDailyRate required for PALLET_DAILY contract',
      });
    }
    if ((c.contractType === 'AREA_MONTHLY' || c.contractType === 'AREA_YEARLY') && (!c.areaPyeong || !c.areaRate)) {
      throw new BadRequestException({
        code: 'E4103',
        message: 'areaPyeong and areaRate required for AREA contract',
      });
    }
  }

  private async nextPartnerCode(): Promise<string> {
    const last = await this.prisma.partner.findFirst({
      where: { code: { startsWith: 'P-' } },
      orderBy: { code: 'desc' },
    });
    const n = last ? parseInt(last.code.slice(2), 10) + 1 : 1;
    return `P-${String(n).padStart(4, '0')}`;
  }

  async findAll(query: GetPartnersDto, callerRoles: Role[] = []) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = query.search
      ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] }
      : {};
    const [rows, totalCount] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: 'asc' },
        include: { storageContracts: { where: { isActive: true } } },
      }),
      this.prisma.partner.count({ where }),
    ]);
    // spec §2: WAREHOUSE_STAFF (without HQ_ADMIN) must not receive 요율 fields — the dropdown
    // this feeds only needs id/code/name. storageContracts (palletDailyRate/areaRate/areaPyeong)
    // is dropped entirely, not just trimmed — the entry screen never reads it.
    const data = isStaffOnly(callerRoles)
      ? rows.map(({ defaultTransportRate: _defaultTransportRate, storageContracts: _storageContracts, ...rest }) => rest)
      : rows;
    return { data, totalCount };
  }

  async update(id: string, dto: UpdatePartnerDto, actorId: string) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'E4104', message: 'partner not found' });
    // areaBillingMode is a StorageContract column, not a Partner column — validated on the DTO
    // (see update-partner.dto.ts) but there's no contract-update endpoint yet, so strip it here
    // rather than forwarding it into partner.update (which would throw on an unknown field).
    // rateEffectiveFrom likewise isn't a Partner column — it only drives the history write below.
    const { businessRegistrationNo, areaBillingMode: _areaBillingMode, rateEffectiveFrom, ...rest } = dto;
    const brn = businessRegistrationNo ? normalizeBrn(businessRegistrationNo) : undefined;
    if (brn) {
      if (!validateBusinessRegistrationNo(brn)) {
        throw new BadRequestException({ code: 'E4101', message: 'invalid business registration number' });
      }
      const dup = await this.prisma.partner.findFirst({
        where: { businessRegistrationNo: brn, NOT: { id } },
      });
      if (dup) throw new ConflictException({ code: 'E4102', message: 'duplicate business registration number' });
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partner.update({
        where: { id },
        data: { ...rest, ...(brn ? { businessRegistrationNo: brn } : {}) },
      });
      if (rest.defaultTransportRate !== undefined) {
        // 요율 변경: 히스토리의 열린 행을 새 적용시작일로 닫고 새 행을 연다 (캐시 컬럼은 위
        // partner.update가 이미 같은 트랜잭션에서 갱신했다).
        const effectiveFrom = rateEffectiveFrom ? new Date(rateEffectiveFrom) : todayDateOnly();
        const openRow = await tx.partnerTransportRateHistory.findFirst({ where: { partnerId: id, effectiveTo: null } });
        assertRateEffectiveFromAdvances(openRow?.effectiveFrom, effectiveFrom);
        await tx.partnerTransportRateHistory.updateMany({
          where: { partnerId: id, effectiveTo: null },
          data: { effectiveTo: effectiveFrom },
        });
        await tx.partnerTransportRateHistory.create({
          data: { partnerId: id, rate: rest.defaultTransportRate, effectiveFrom, effectiveTo: null },
        });
      }
      await tx.auditLog.create({
        data: {
          tableName: 'partners',
          recordId: updated.id,
          action: 'UPDATE',
          // matches order-mutation.service.ts's logUpdateAudit shape exactly
          diff: JSON.parse(JSON.stringify({ previous: existing, current: updated, changes: dto })),
          actor: actorId,
        },
      });
      return updated;
    });
  }

  async getRateHistory(id: string) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'E4104', message: 'partner not found' });
    return this.prisma.partnerTransportRateHistory.findMany({
      where: { partnerId: id },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
