import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isStaffOnly } from '../common/staff-price-visibility.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsDto } from './dto/get-products.dto';

// P0-1: "적용 시작일" 미입력 시 오늘 날짜(로컬, 자정 기준)를 기본값으로 쓴다. rates.service.ts와
// 동일한 헬퍼 — 세 스코프(rate card/product/partner) 각각에서 중복 정의(작고 독립적이라 공유
// 모듈로 뽑아내는 비용이 더 큼).
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    let code = dto.code;
    if (code) {
      const dup = await this.prisma.product.findUnique({ where: { code } });
      if (dup) throw new ConflictException({ code: 'E4102', message: 'duplicate product code' });
    } else {
      code = await this.nextProductCode();
    }
    const { rateEffectiveFrom, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { ...rest, code } });
      if (product.transportRate != null) {
        const effectiveFrom = rateEffectiveFrom ? new Date(rateEffectiveFrom) : todayDateOnly();
        await tx.productTransportRateHistory.create({
          data: { productId: product.id, rate: product.transportRate, effectiveFrom, effectiveTo: null },
        });
      }
      return product;
    });
  }

  private async nextProductCode(): Promise<string> {
    const last = await this.prisma.product.findFirst({
      where: { code: { startsWith: 'I-' } },
      orderBy: { code: 'desc' },
    });
    const n = last ? parseInt(last.code.slice(2), 10) + 1 : 1;
    return `I-${String(n).padStart(5, '0')}`;
  }

  async findAll(query: GetProductsDto, callerRoles: Role[] = []) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = {
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] } : {}),
    };
    const [rows, totalCount] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: 'asc' },
        include: { category: true, partner: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    // spec §2: WAREHOUSE_STAFF (without HQ_ADMIN) must not receive 단가/원가/요율 — the
    // entry-screen dropdown this feeds only needs id/code/name.
    const data = isStaffOnly(callerRoles)
      ? rows.map(({ unitPrice: _unitPrice, costPrice: _costPrice, transportRate: _transportRate, ...rest }) => rest)
      : rows;
    return { data, totalCount };
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'E4104', message: 'product not found' });
    const { rateEffectiveFrom, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: rest });
      if (rest.transportRate !== undefined) {
        // 요율 변경: 히스토리의 열린 행을 새 적용시작일로 닫고 새 행을 연다 (캐시 컬럼은 위
        // product.update가 이미 같은 트랜잭션에서 갱신했다).
        const effectiveFrom = rateEffectiveFrom ? new Date(rateEffectiveFrom) : todayDateOnly();
        await tx.productTransportRateHistory.updateMany({
          where: { productId: id, effectiveTo: null },
          data: { effectiveTo: effectiveFrom },
        });
        await tx.productTransportRateHistory.create({
          data: { productId: id, rate: rest.transportRate, effectiveFrom, effectiveTo: null },
        });
      }
      await tx.auditLog.create({
        data: {
          tableName: 'products',
          recordId: updated.id,
          action: 'UPDATE',
          // matches partners.service.ts update()'s logUpdateAudit shape exactly
          diff: JSON.parse(JSON.stringify({ previous: existing, current: updated, changes: dto })),
          actor: actorId,
        },
      });
      return updated;
    });
  }

  async getRateHistory(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'E4104', message: 'product not found' });
    return this.prisma.productTransportRateHistory.findMany({
      where: { productId: id },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
