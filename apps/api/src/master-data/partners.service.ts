import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
// ponytail: import from the `/utils` subpath, not the `@erp/shared` root barrel — the root
// re-exports Angular-only interceptors (packages/shared/src/interceptors) which pull in
// @angular/core and fail to transform under this app's plain ts-jest (CJS) config.
import { validateBusinessRegistrationNo, normalizeBrn } from '@erp/shared/utils';
import { isStaffOnly } from '../common/staff-price-visibility.util';
import { CreatePartnerDto, StorageContractDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { GetPartnersDto } from './dto/get-partners.dto';

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
          startDate: new Date(dto.storageContract.startDate),
          endDate: dto.storageContract.endDate ? new Date(dto.storageContract.endDate) : null,
        },
      });
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
    const { businessRegistrationNo, ...rest } = dto;
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
}
