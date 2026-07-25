import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// ponytail: import from the `/utils` subpath, not the `@erp/shared` root barrel — the root
// re-exports Angular-only interceptors (packages/shared/src/interceptors) which pull in
// @angular/core and fail to transform under this app's plain ts-jest (CJS) config.
import { validateBusinessRegistrationNo, normalizeBrn } from '@erp/shared/utils';
import { CreatePartnerDto, StorageContractDto } from './dto/create-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartnerDto) {
    const brn = dto.businessRegistrationNo ? normalizeBrn(dto.businessRegistrationNo) : null;
    if (brn) {
      if (!validateBusinessRegistrationNo(brn)) {
        throw new BadRequestException('E4101: invalid business registration number');
      }
      const dup = await this.prisma.partner.findFirst({ where: { businessRegistrationNo: brn } });
      if (dup) throw new ConflictException('E4102: duplicate business registration number');
    }
    this.assertContractComplete(dto.storageContract);

    const code = dto.code ?? (await this.nextPartnerCode());
    if (dto.code) {
      const codeDup = await this.prisma.partner.findUnique({ where: { code: dto.code } });
      if (codeDup) throw new ConflictException('E4102: duplicate partner code');
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
      throw new BadRequestException('E4103: palletDailyRate required for PALLET_DAILY contract');
    }
    if ((c.contractType === 'AREA_MONTHLY' || c.contractType === 'AREA_YEARLY') && (!c.areaPyeong || !c.areaRate)) {
      throw new BadRequestException('E4103: areaPyeong and areaRate required for AREA contract');
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

  async findAll(query: { search?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = query.search
      ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] }
      : {};
    const [data, totalCount] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: 'asc' },
        include: { storageContracts: { where: { isActive: true } } },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return { data, totalCount };
  }

  async update(id: string, dto: Partial<CreatePartnerDto>, actorId: string) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('E4104: partner not found');
    const { storageContract: _storageContract, code: _code, businessRegistrationNo, ...rest } = dto;
    const brn = businessRegistrationNo ? normalizeBrn(businessRegistrationNo) : undefined;
    if (brn && !validateBusinessRegistrationNo(brn)) {
      throw new BadRequestException('E4101: invalid business registration number');
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
          diff: { before: existing, after: updated },
          actor: actorId,
        },
      });
      return updated;
    });
  }
}
