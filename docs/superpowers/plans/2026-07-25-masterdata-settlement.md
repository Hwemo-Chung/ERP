# 마스터데이터 코드화 · 운송료/보관료 정산 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엑셀 마스터데이터를 DB로 코드화하고 운송료·보관료를 건별 근거와 함께 계산·정산하는 PWA 모듈을 기존 ERP에 추가한다.

**Architecture:** `apps/api`에 NestJS 모듈 3개(`master-data`, `warehouse`, `settlement-fees`)를 추가하고 Prisma 스키마에 신규 모델 7종을 마이그레이션한다. 계산 엔진은 순수 함수로 분리해 jest 단위 테스트로 검증하고, 계산 결과는 `SettlementRecord` 스냅샷으로 저장한다. `apps/web`에 feature 4개(master-data, warehouse, settlement, partner-portal)를 추가한다.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL 15 | Angular 19 standalone + Ionic 8 + Signals | exceljs (신규 의존성, 엑셀 파싱/생성)

**Spec:** `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`

## Global Constraints

- API 응답은 이중 중첩 `response.data.data` 규약 유지 (기존 인터셉터가 감싼다 — 서비스는 payload만 반환).
- 에러 코드 체계 E1xxx~E5xxx 유지. 정산 잠금 위반은 E2002 패턴.
- inject()는 클래스 필드 초기화에서만 사용 (Angular).
- 금액은 Prisma `Decimal` — JS number 산술 금지, `Prisma.Decimal` 또는 문자열 유지.
- 소프트 삭제 컨벤션: 물리 삭제 대신 `isActive=false`.
- 커밋 메시지는 conventional commits (`feat:`, `test:` 등). 각 태스크 완료 시 커밋.
- 파렛트 환산 임계값 전역 기본 70%, 품목별 override.
- 채번: 기존 엑셀 코드 유지, 신규만 자동채번 (거래처 `P-0001`, 품목 `I-00001`, 카테고리 `A-01-003`).
- **[미확정 §10 기본값]** 차량 지정 건 운송료 = 차량 단가로 **대체** (건당 요율 무시). 확정 전까지 이 기본값으로 구현하고 계산 detail에 `vehicleRateMode: 'REPLACE'`를 기록해 추후 합산 모드 전환 가능하게 한다.

---

### Task 1: Prisma 스키마 — 신규 모델 7종 + Partner 확장 + Role 추가

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `prisma/migrations/*_masterdata_settlement/`

**Interfaces:**
- Produces: Prisma Client 타입 `Category`, `Product`, `TransportRate`, `StorageContract`, `WarehouseTransaction`, `SettlementRecord`, `SystemSetting`, enum `StorageContractType`, `TransactionType`, `TransactionSource`, `FeeType`, `Role.WAREHOUSE_STAFF`, Partner 신규 필드.

- [ ] **Step 1: schema.prisma에 enum·모델 추가**

`enum Role`에 `WAREHOUSE_STAFF` 추가. 파일 말미에 신규 섹션 추가:

```prisma
enum StorageContractType {
  PALLET_DAILY
  AREA_MONTHLY
  AREA_YEARLY
}

enum TransactionType {
  INBOUND
  OUTBOUND
}

enum TransactionSource {
  PWA
  EXCEL
}

enum FeeType {
  TRANSPORT
  STORAGE
}

model Category {
  id       String  @id @default(uuid())
  code     String  @unique @db.VarChar(20) // A, A-01, A-01-003
  name     String  @db.VarChar(120)
  parentId String? @map("parent_id")
  depth    Int // 1~3
  isActive Boolean @default(true) @map("is_active")

  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]

  @@index([parentId])
  @@map("categories")
}

model Product {
  id                String   @id @default(uuid())
  code              String   @unique @db.VarChar(30)
  name              String   @db.VarChar(200)
  categoryId        String   @map("category_id")
  partnerId         String   @map("partner_id")
  unitPrice         Decimal  @map("unit_price") @db.Decimal(14, 2)
  costPrice         Decimal  @map("cost_price") @db.Decimal(14, 2)
  transportRate     Decimal? @map("transport_rate") @db.Decimal(14, 2)
  palletThreshold   Decimal? @map("pallet_threshold") @db.Decimal(5, 2) // % override
  maxUnitsPerPallet Int?     @map("max_units_per_pallet")
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  category     Category               @relation(fields: [categoryId], references: [id])
  partner      Partner                @relation(fields: [partnerId], references: [id])
  transactions WarehouseTransaction[]

  @@index([partnerId])
  @@map("products")
}

model TransportRateCard {
  id               String   @id @default(uuid())
  vehicleType      String   @map("vehicle_type") @db.VarChar(60)
  tonnage          Decimal? @db.Decimal(5, 1) // 1.0 ~ 25.0
  containerSize    String?  @map("container_size") @db.VarChar(40)
  specialEquipment String?  @map("special_equipment") @db.VarChar(60)
  rate             Decimal  @db.Decimal(14, 2)
  isActive         Boolean  @default(true) @map("is_active")

  transactions WarehouseTransaction[]

  @@map("transport_rate_cards")
}

model StorageContract {
  id              String              @id @default(uuid())
  partnerId       String              @map("partner_id")
  contractType    StorageContractType @map("contract_type")
  palletDailyRate Decimal?            @map("pallet_daily_rate") @db.Decimal(14, 2)
  areaPyeong      Decimal?            @map("area_pyeong") @db.Decimal(10, 2)
  areaRate        Decimal?            @map("area_rate") @db.Decimal(14, 2)
  startDate       DateTime            @map("start_date") @db.Date
  endDate         DateTime?           @map("end_date") @db.Date
  isActive        Boolean             @default(true) @map("is_active")

  partner Partner @relation(fields: [partnerId], references: [id])

  @@index([partnerId, isActive])
  @@map("storage_contracts")
}

model WarehouseTransaction {
  id              String            @id @default(uuid())
  type            TransactionType
  partnerId       String            @map("partner_id")
  productId       String            @map("product_id")
  quantity        Int
  transactionDate DateTime          @map("transaction_date")
  vehicleRateId   String?           @map("vehicle_rate_id")
  source          TransactionSource @default(PWA)
  createdBy       String            @map("created_by")
  createdAt       DateTime          @default(now()) @map("created_at")

  partner     Partner            @relation(fields: [partnerId], references: [id])
  product     Product            @relation(fields: [productId], references: [id])
  vehicleRate TransportRateCard? @relation(fields: [vehicleRateId], references: [id])
  settlementRecords SettlementRecord[]

  @@index([partnerId, transactionDate])
  @@index([productId, transactionDate])
  @@map("warehouse_transactions")
}

model SettlementRecord {
  id                String   @id @default(uuid())
  transactionId     String?  @map("transaction_id")
  partnerId         String   @map("partner_id")
  periodYearMonth   String   @map("period_year_month") @db.VarChar(7) // "2026-07"
  feeType           FeeType  @map("fee_type")
  amount            Decimal  @db.Decimal(14, 2)
  calculationDetail Json     @map("calculation_detail")
  createdAt         DateTime @default(now()) @map("created_at")

  transaction WarehouseTransaction? @relation(fields: [transactionId], references: [id])
  partner     Partner               @relation(fields: [partnerId], references: [id])

  @@index([partnerId, periodYearMonth])
  @@map("settlement_records")
}

model SystemSetting {
  key       String   @id @db.VarChar(60)
  value     String   @db.VarChar(200)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}
```

`model Partner`에 필드·relation 추가:

```prisma
  businessRegistrationNo String?  @unique @map("business_registration_no") @db.VarChar(10)
  representativeName     String?  @map("representative_name") @db.VarChar(80)
  businessType           String?  @map("business_type") @db.VarChar(80)
  businessCategory       String?  @map("business_category") @db.VarChar(80)
  address                String?  @db.VarChar(300)
  defaultTransportRate   Decimal? @map("default_transport_rate") @db.Decimal(14, 2)
  createdAt              DateTime @default(now()) @map("created_at")

  products         Product[]
  storageContracts StorageContract[]
  transactions     WarehouseTransaction[]
  settlementRecords SettlementRecord[]
```

- [ ] **Step 2: 마이그레이션 생성·적용**

Run: `docker compose up -d && pnpm db:generate && pnpm db:migrate -- --name masterdata_settlement`
Expected: 마이그레이션 성공, Prisma Client 재생성.

- [ ] **Step 3: 기존 테스트 회귀 확인**

Run: `pnpm --filter api test`
Expected: 기존 스위트 통과 (스키마 추가는 기존 모델 비파괴).

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(db): add master-data and settlement models"
```

---

### Task 2: 사업자등록번호 검증 유틸 (packages/shared)

**Files:**
- Create: `packages/shared/src/utils/business-registration.ts`
- Test: `packages/shared/src/utils/business-registration.spec.ts`
- Modify: `packages/shared/src/index.ts` (export 추가)

**Interfaces:**
- Produces: `validateBusinessRegistrationNo(brn: string): boolean` — 하이픈 허용 입력, 10자리 체크섬 검증. `normalizeBrn(brn: string): string` — 숫자만 10자리로 정규화.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// packages/shared/src/utils/business-registration.spec.ts
import { validateBusinessRegistrationNo, normalizeBrn } from './business-registration';

describe('validateBusinessRegistrationNo', () => {
  it('accepts valid checksum BRN', () => {
    expect(validateBusinessRegistrationNo('1208147521')).toBe(true); // valid checksum sample
  });
  it('accepts hyphenated input', () => {
    expect(validateBusinessRegistrationNo('120-81-47521')).toBe(true);
  });
  it('rejects wrong checksum', () => {
    expect(validateBusinessRegistrationNo('1208147522')).toBe(false);
  });
  it('rejects non-10-digit', () => {
    expect(validateBusinessRegistrationNo('12081475')).toBe(false);
    expect(validateBusinessRegistrationNo('abcdefghij')).toBe(false);
  });
});

describe('normalizeBrn', () => {
  it('strips hyphens', () => {
    expect(normalizeBrn('120-81-47521')).toBe('1208147521');
  });
});
```

주의: `1208147521`이 실제 체크섬 통과하는지 구현 후 확인하고, 실패 시 체크섬 계산으로 유효 샘플을 만들어 테스트 값을 교체할 것 (알고리즘이 정답, 샘플은 수단).

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter shared test -- business-registration`
Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```typescript
// packages/shared/src/utils/business-registration.ts
const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5];

export function normalizeBrn(brn: string): string {
  return brn.replace(/-/g, '');
}

export function validateBusinessRegistrationNo(brn: string): boolean {
  const digits = normalizeBrn(brn);
  if (!/^\d{10}$/.test(digits)) return false;
  const nums = digits.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * WEIGHTS[i];
  sum += Math.floor((nums[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === nums[9];
}
```

`packages/shared/src/index.ts`에 `export * from './utils/business-registration';` 추가.

- [ ] **Step 4: 통과 확인 후 Commit**

Run: `pnpm --filter shared test -- business-registration` → PASS

```bash
git add packages/shared/src
git commit -m "feat(shared): add business registration number validator"
```

---

### Task 3: master-data 모듈 — Partner 확장 CRUD + StorageContract 필수 등록

**Files:**
- Create: `apps/api/src/master-data/master-data.module.ts`
- Create: `apps/api/src/master-data/partners.service.ts`
- Create: `apps/api/src/master-data/partners.controller.ts`
- Create: `apps/api/src/master-data/dto/create-partner.dto.ts`
- Test: `apps/api/src/master-data/partners.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (MasterDataModule import)

**Interfaces:**
- Consumes: `validateBusinessRegistrationNo`, `normalizeBrn` (Task 2), Prisma Client (Task 1).
- Produces: REST `POST/GET/PATCH /master-data/partners`, `PartnersService.create(dto): Promise<Partner>` — BRN 검증 실패 시 `BadRequestException('E4101: invalid business registration number')`, 중복 시 `ConflictException('E4102')`, 보관계약 누락 시 `BadRequestException('E4103')`. 자동채번 `nextPartnerCode(): 'P-0001'` 형식.

- [ ] **Step 1: DTO 작성**

```typescript
// apps/api/src/master-data/dto/create-partner.dto.ts
import { Type } from 'class-transformer';
import {
  IsString, IsOptional, IsEnum, IsNumberString, IsDateString,
  ValidateNested, IsDefined, MaxLength,
} from 'class-validator';
import { StorageContractType } from '@prisma/client';

export class StorageContractDto {
  @IsEnum(StorageContractType) contractType: StorageContractType;
  @IsOptional() @IsNumberString() palletDailyRate?: string;
  @IsOptional() @IsNumberString() areaPyeong?: string;
  @IsOptional() @IsNumberString() areaRate?: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class CreatePartnerDto {
  @IsOptional() @IsString() @MaxLength(20) code?: string; // 엑셀 기존 코드, 없으면 자동채번
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() businessRegistrationNo?: string;
  @IsOptional() @IsString() representativeName?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() businessCategory?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsNumberString() defaultTransportRate?: string;
  @IsDefined() @ValidateNested() @Type(() => StorageContractDto)
  storageContract: StorageContractDto;
}
```

- [ ] **Step 2: 실패 테스트 작성**

```typescript
// apps/api/src/master-data/partners.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  partner: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  storageContract: { create: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
};

const baseDto = {
  name: '테스트상사',
  businessRegistrationNo: '120-81-47521',
  storageContract: {
    contractType: 'PALLET_DAILY' as const,
    palletDailyRate: '1500',
    startDate: '2026-07-01',
  },
};

describe('PartnersService', () => {
  let service: PartnersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [PartnersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(PartnersService);
  });

  it('rejects invalid BRN checksum with E4101', async () => {
    await expect(
      service.create({ ...baseDto, businessRegistrationNo: '111-11-11111' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate BRN with E4102', async () => {
    prismaMock.partner.findFirst.mockResolvedValueOnce({ id: 'x' });
    await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
  });

  it('rejects PALLET_DAILY contract without palletDailyRate (E4103)', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    await expect(
      service.create({
        ...baseDto,
        storageContract: { contractType: 'PALLET_DAILY' as const, startDate: '2026-07-01' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('auto-generates code P-0001 when code absent', async () => {
    prismaMock.partner.findFirst
      .mockResolvedValueOnce(null) // BRN dup check
      .mockResolvedValueOnce(null); // last auto code
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'P-0001' });
    await service.create(baseDto);
    expect(prismaMock.partner.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'P-0001' }) }),
    );
  });

  it('keeps provided excel code as-is', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);
    prismaMock.partner.findUnique.mockResolvedValue(null);
    prismaMock.partner.create.mockResolvedValue({ id: 'p1', code: 'KM001' });
    await service.create({ ...baseDto, code: 'KM001' });
    expect(prismaMock.partner.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'KM001' }) }),
    );
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter api test -- partners.service`
Expected: FAIL (PartnersService not found)

- [ ] **Step 4: 서비스 구현**

```typescript
// apps/api/src/master-data/partners.service.ts
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateBusinessRegistrationNo, normalizeBrn } from '@erp/shared';
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

    return this.prisma.$transaction(async tx => {
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
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { code: 'asc' },
        include: { storageContracts: { where: { isActive: true } } },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return { data, totalCount };
  }

  async update(id: string, dto: Partial<CreatePartnerDto>) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('E4104: partner not found');
    const { storageContract, code: _code, businessRegistrationNo, ...rest } = dto;
    const brn = businessRegistrationNo ? normalizeBrn(businessRegistrationNo) : undefined;
    if (brn && !validateBusinessRegistrationNo(brn)) {
      throw new BadRequestException('E4101: invalid business registration number');
    }
    return this.prisma.partner.update({
      where: { id },
      data: { ...rest, ...(brn ? { businessRegistrationNo: brn } : {}) },
    });
  }
}
```

- [ ] **Step 5: 컨트롤러 + 모듈**

```typescript
// apps/api/src/master-data/partners.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';

@ApiTags('MasterData')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HQ_ADMIN)
@Controller('master-data/partners')
export class PartnersController {
  constructor(private readonly service: PartnersService) {}

  @Post() create(@Body() dto: CreatePartnerDto) { return this.service.create(dto); }
  @Get() findAll(@Query() q: { search?: string; page?: number; pageSize?: number }) { return this.service.findAll(q); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreatePartnerDto>) {
    return this.service.update(id, dto);
  }
}
```

```typescript
// apps/api/src/master-data/master-data.module.ts
import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';

@Module({
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class MasterDataModule {}
```

`app.module.ts` imports 배열에 `MasterDataModule` 추가.

- [ ] **Step 6: 수정 이력 기록 (AuditLog 재사용)**

기존 `AuditLog` 기록 방식을 확인(`grep -rn "auditLog" apps/api/src --include="*.ts"` — 인터셉터인지 서비스 수동 호출인지)하고, 동일 방식으로 `PartnersService.update`·`ProductsService.update`(Task 5)에 변경 전/후 기록을 추가한다. 인터셉터가 전역 적용이면 이 스텝은 확인만 하고 종료.

- [ ] **Step 7: 통과 확인 후 Commit**

Run: `pnpm --filter api test -- partners.service` → PASS

```bash
git add apps/api/src/master-data apps/api/src/app.module.ts
git commit -m "feat(api): partner master CRUD with BRN validation and storage contract"
```

---

### Task 4: Category 서비스 — 트리 CRUD + 계층 코드 자동 부여

**Files:**
- Create: `apps/api/src/master-data/categories.service.ts`
- Create: `apps/api/src/master-data/categories.controller.ts`
- Test: `apps/api/src/master-data/categories.service.spec.ts`
- Modify: `apps/api/src/master-data/master-data.module.ts`

**Interfaces:**
- Produces: `CategoriesService.create({name, parentId?})` — depth 자동(부모+1, 최대 3 초과 시 `BadRequestException('E4105')`), 코드 자동: depth1=`A`,`B`,…, depth2=`{부모코드}-01`, depth3=`{부모코드}-001`. `findTree(): Category[]` (children 중첩). `rename(id, name)`, `deactivate(id)`. REST `GET/POST/PATCH /master-data/categories`.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// apps/api/src/master-data/categories.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  category: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(CategoriesService);
  });

  it('assigns code A to first root category', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '가전' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'A', depth: 1 }) }),
    );
  });

  it('assigns code B when A exists', async () => {
    prismaMock.category.findFirst.mockResolvedValue({ code: 'A' });
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '가구' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'B' }) }),
    );
  });

  it('assigns A-01 to first child of A', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: 'a', code: 'A', depth: 1 });
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '대형가전', parentId: 'a' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'A-01', depth: 2 }) }),
    );
  });

  it('assigns A-01-003 style at depth 3, increments sibling', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: 'a01', code: 'A-01', depth: 2 });
    prismaMock.category.findFirst.mockResolvedValue({ code: 'A-01-002' });
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '냉장고', parentId: 'a01' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'A-01-003', depth: 3 }) }),
    );
  });

  it('rejects depth 4 with E4105', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: 'x', code: 'A-01-003', depth: 3 });
    await expect(service.create({ name: '깊음', parentId: 'x' })).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- categories.service` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/master-data/categories.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { name: string; parentId?: string }) {
    let depth = 1;
    let parentCode: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('E4104: parent category not found');
      if (parent.depth >= 3) throw new BadRequestException('E4105: max category depth is 3');
      depth = parent.depth + 1;
      parentCode = parent.code;
    }
    const code = await this.nextCode(depth, parentCode, dto.parentId ?? null);
    return this.prisma.category.create({
      data: { name: dto.name, parentId: dto.parentId ?? null, depth, code },
    });
  }

  private async nextCode(depth: number, parentCode: string | null, parentId: string | null): Promise<string> {
    const lastSibling = await this.prisma.category.findFirst({
      where: { parentId },
      orderBy: { code: 'desc' },
    });
    if (depth === 1) {
      const next = lastSibling ? String.fromCharCode(lastSibling.code.charCodeAt(0) + 1) : 'A';
      return next;
    }
    const width = depth === 2 ? 2 : 3;
    const lastSeq = lastSibling ? parseInt(lastSibling.code.split('-').pop()!, 10) : 0;
    return `${parentCode}-${String(lastSeq + 1).padStart(width, '0')}`;
  }

  async findTree() {
    const all = await this.prisma.category.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const byParent = new Map<string | null, any[]>();
    for (const c of all) {
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const build = (parentId: string | null): any[] =>
      (byParent.get(parentId) ?? []).map(c => ({ ...c, children: build(c.id) }));
    return build(null);
  }

  rename(id: string, name: string) {
    return this.prisma.category.update({ where: { id }, data: { name } });
  }

  deactivate(id: string) {
    return this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }
}
```

컨트롤러 (`categories.controller.ts`): Task 3의 `PartnersController`와 동일 가드/데코레이터 구성, `@Controller('master-data/categories')`, 엔드포인트 `POST /`(create), `GET /tree`(findTree), `PATCH /:id/rename`(body `{name}`), `PATCH /:id/deactivate`. 모듈 providers/controllers에 등록.

- [ ] **Step 4: 통과 확인 후 Commit**

Run: `pnpm --filter api test -- categories.service` → PASS

```bash
git add apps/api/src/master-data
git commit -m "feat(api): category tree with hierarchical auto codes"
```

---

### Task 5: Product 서비스 — 자동채번 + override 필드

**Files:**
- Create: `apps/api/src/master-data/products.service.ts`
- Create: `apps/api/src/master-data/products.controller.ts`
- Create: `apps/api/src/master-data/dto/create-product.dto.ts`
- Test: `apps/api/src/master-data/products.service.spec.ts`
- Modify: `apps/api/src/master-data/master-data.module.ts`

**Interfaces:**
- Produces: `ProductsService.create(dto)` — code 미지정 시 `I-00001` 자동채번, 지정 시 중복 검사(`ConflictException('E4102')`). `findAll({partnerId?, categoryId?, search?, page, pageSize})`. `update(id, dto)`. REST `POST/GET/PATCH /master-data/products`.

- [ ] **Step 1: DTO**

```typescript
// apps/api/src/master-data/dto/create-product.dto.ts
import { IsInt, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsOptional() @IsString() @MaxLength(30) code?: string;
  @IsString() @MaxLength(200) name: string;
  @IsUUID() categoryId: string;
  @IsUUID() partnerId: string;
  @IsNumberString() unitPrice: string;
  @IsNumberString() costPrice: string;
  @IsOptional() @IsNumberString() transportRate?: string;
  @IsOptional() @IsNumberString() palletThreshold?: string; // %
  @IsOptional() @IsInt() @Min(1) maxUnitsPerPallet?: number;
}
```

- [ ] **Step 2: 실패 테스트**

```typescript
// apps/api/src/master-data/products.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  product: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
};

const dto = { name: '냉장고 RF85', categoryId: 'c1', partnerId: 'p1', unitPrice: '1200000', costPrice: '900000' };

describe('ProductsService', () => {
  let service: ProductsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(ProductsService);
  });

  it('auto-generates I-00001 for first product without code', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({});
    await service.create(dto);
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'I-00001' }) }),
    );
  });

  it('increments from last auto code', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ code: 'I-00042' });
    prismaMock.product.create.mockResolvedValue({});
    await service.create(dto);
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'I-00043' }) }),
    );
  });

  it('rejects duplicate explicit code with E4102', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ ...dto, code: 'EX-001' })).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `pnpm --filter api test -- products.service` → FAIL

- [ ] **Step 4: 구현**

```typescript
// apps/api/src/master-data/products.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    let code = dto.code;
    if (code) {
      const dup = await this.prisma.product.findUnique({ where: { code } });
      if (dup) throw new ConflictException('E4102: duplicate product code');
    } else {
      code = await this.nextProductCode();
    }
    return this.prisma.product.create({ data: { ...dto, code } });
  }

  private async nextProductCode(): Promise<string> {
    const last = await this.prisma.product.findFirst({
      where: { code: { startsWith: 'I-' } },
      orderBy: { code: 'desc' },
    });
    const n = last ? parseInt(last.code.slice(2), 10) + 1 : 1;
    return `I-${String(n).padStart(5, '0')}`;
  }

  async findAll(q: { partnerId?: string; categoryId?: string; search?: string; page?: number; pageSize?: number }) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.pageSize ?? 20, 100);
    const where = {
      ...(q.partnerId ? { partnerId: q.partnerId } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search } }, { code: { contains: q.search } }] } : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.product.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { code: 'asc' },
        include: { category: true, partner: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, totalCount };
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('E4104: product not found');
    const { code: _code, ...rest } = dto;
    return this.prisma.product.update({ where: { id }, data: rest });
  }
}
```

컨트롤러: `@Controller('master-data/products')`, Task 3과 동일 가드, `POST /`, `GET /`, `PATCH /:id`. 모듈 등록.

- [ ] **Step 5: 통과 확인 후 Commit**

```bash
git add apps/api/src/master-data
git commit -m "feat(api): product master with auto-numbering and rate overrides"
```

---

### Task 6: TransportRateCard + SystemSetting CRUD

**Files:**
- Create: `apps/api/src/master-data/rates.service.ts`
- Create: `apps/api/src/master-data/rates.controller.ts`
- Test: `apps/api/src/master-data/rates.service.spec.ts`
- Modify: `apps/api/src/master-data/master-data.module.ts`

**Interfaces:**
- Produces: `RatesService` — `createRateCard({vehicleType, tonnage?, containerSize?, specialEquipment?, rate})`, `listRateCards()`, `updateRateCard(id, dto)`, `deactivateRateCard(id)`, `getPalletThreshold(): Promise<number>` (기본 70), `setPalletThreshold(pct: number)`. REST `GET/POST/PATCH /master-data/rate-cards`, `GET/PUT /master-data/settings/pallet-threshold`.

- [ ] **Step 1: 실패 테스트**

```typescript
// apps/api/src/master-data/rates.service.spec.ts
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
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- rates.service` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/master-data/rates.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PALLET_THRESHOLD_KEY = 'pallet_threshold_default';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  createRateCard(dto: { vehicleType: string; tonnage?: string; containerSize?: string; specialEquipment?: string; rate: string }) {
    return this.prisma.transportRateCard.create({ data: dto });
  }

  listRateCards() {
    return this.prisma.transportRateCard.findMany({ where: { isActive: true }, orderBy: [{ vehicleType: 'asc' }, { tonnage: 'asc' }] });
  }

  updateRateCard(id: string, dto: Partial<{ vehicleType: string; tonnage: string; containerSize: string; specialEquipment: string; rate: string }>) {
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
```

컨트롤러: `@Controller('master-data')`, HQ_ADMIN 가드. `POST /rate-cards`, `GET /rate-cards`, `PATCH /rate-cards/:id`, `PATCH /rate-cards/:id/deactivate`, `GET /settings/pallet-threshold` → `{ value }`, `PUT /settings/pallet-threshold` body `{ value: number }`. 모듈 등록.

- [ ] **Step 4: 통과 확인 후 Commit**

```bash
git add apps/api/src/master-data
git commit -m "feat(api): transport rate cards and pallet threshold setting"
```

---

### Task 7: warehouse 모듈 — 입출고 실적 CRUD + 거래처 데이터 격리

**Files:**
- Create: `apps/api/src/warehouse/warehouse.module.ts`
- Create: `apps/api/src/warehouse/transactions.service.ts`
- Create: `apps/api/src/warehouse/transactions.controller.ts`
- Create: `apps/api/src/warehouse/dto/create-transaction.dto.ts`
- Test: `apps/api/src/warehouse/transactions.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: JwtPayload(`sub`, `role`, `partnerId?`) — 기존 auth 모듈.
- Produces: `TransactionsService.create(dto, userId)`, `findAll(query, scope)` — `scope = { partnerId?: string }`. **PARTNER_COORDINATOR는 컨트롤러에서 `scope.partnerId = user.partnerId` 강제** (타사 데이터 접근 시 결과 자체가 필터됨, partnerId 쿼리 파라미터 무시). `WAREHOUSE_STAFF`/`HQ_ADMIN`은 전체 조회. REST `POST/GET /warehouse/transactions`.

- [ ] **Step 1: DTO**

```typescript
// apps/api/src/warehouse/dto/create-transaction.dto.ts
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType) type: TransactionType;
  @IsUUID() partnerId: string;
  @IsUUID() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsDateString() transactionDate: string;
  @IsOptional() @IsUUID() vehicleRateId?: string;
}
```

- [ ] **Step 2: 실패 테스트**

```typescript
// apps/api/src/warehouse/transactions.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  warehouseTransaction: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  product: { findUnique: jest.fn() },
  settlementPeriod: { findFirst: jest.fn() },
};

const dto = {
  type: 'OUTBOUND' as const, partnerId: 'p1', productId: 'prod1',
  quantity: 10, transactionDate: '2026-07-20T09:00:00Z',
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [TransactionsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(TransactionsService);
  });

  it('rejects product not belonging to partner (E4106)', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'OTHER' });
    await expect(service.create(dto, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('rejects transaction in LOCKED period (E2002)', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'p1' });
    prismaMock.settlementPeriod.findFirst.mockResolvedValue({ status: 'LOCKED' });
    await expect(service.create(dto, 'u1')).rejects.toThrow(/E2002/);
  });

  it('creates transaction with source PWA and creator', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'p1' });
    prismaMock.settlementPeriod.findFirst.mockResolvedValue(null);
    prismaMock.warehouseTransaction.create.mockResolvedValue({ id: 't1' });
    await service.create(dto, 'u1');
    expect(prismaMock.warehouseTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'PWA', createdBy: 'u1' }) }),
    );
  });

  it('scopes findAll to forced partnerId', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([]);
    prismaMock.warehouseTransaction.count.mockResolvedValue(0);
    await service.findAll({ partnerId: 'REQUESTED-OTHER' }, { partnerId: 'p1' });
    expect(prismaMock.warehouseTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ partnerId: 'p1' }) }),
    );
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `pnpm --filter api test -- transactions.service` → FAIL

- [ ] **Step 4: 구현**

```typescript
// apps/api/src/warehouse/transactions.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionSource } from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';

export interface TransactionScope { partnerId?: string }

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto, userId: string, source: TransactionSource = 'PWA') {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.partnerId !== dto.partnerId) {
      throw new BadRequestException('E4106: product does not belong to partner');
    }
    const txDate = new Date(dto.transactionDate);
    const locked = await this.prisma.settlementPeriod.findFirst({
      where: { status: 'LOCKED', periodStart: { lte: txDate }, periodEnd: { gte: txDate } },
    });
    if (locked) throw new ForbiddenException('E2002: settlement period is locked');

    return this.prisma.warehouseTransaction.create({
      data: {
        type: dto.type,
        partnerId: dto.partnerId,
        productId: dto.productId,
        quantity: dto.quantity,
        transactionDate: txDate,
        vehicleRateId: dto.vehicleRateId,
        source,
        createdBy: userId,
      },
    });
  }

  async findAll(
    q: { partnerId?: string; productId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number },
    scope: TransactionScope,
  ) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.pageSize ?? 50, 200);
    const partnerId = scope.partnerId ?? q.partnerId; // 강제 스코프 우선
    const where = {
      ...(partnerId ? { partnerId } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.dateFrom || q.dateTo
        ? { transactionDate: { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) } }
        : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.warehouseTransaction.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { transactionDate: 'desc' },
        include: { product: { select: { code: true, name: true } }, vehicleRate: true },
      }),
      this.prisma.warehouseTransaction.count({ where }),
    ]);
    return { data, totalCount };
  }
}
```

```typescript
// apps/api/src/warehouse/transactions.controller.ts
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@ApiTags('Warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse/transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF)
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles(Role.HQ_ADMIN, Role.WAREHOUSE_STAFF, Role.PARTNER_COORDINATOR)
  findAll(@Query() q: Record<string, string>, @CurrentUser() user: JwtPayload) {
    const scope = user.role === Role.PARTNER_COORDINATOR ? { partnerId: user.partnerId } : {};
    return this.service.findAll(q as any, scope);
  }
}
```

주의: `JwtPayload`에 `partnerId`가 없으면 기존 auth 모듈에서 JWT 발급 시 `User.partnerId`를 payload에 포함하도록 확장한다 (`apps/api/src/auth` — 토큰 서명 위치 확인 후 필드 1개 추가, 기존 테스트 유지).

warehouse.module.ts 생성 후 `app.module.ts`에 등록.

- [ ] **Step 5: 통과 확인 후 Commit**

Run: `pnpm --filter api test -- transactions.service` → PASS

```bash
git add apps/api/src/warehouse apps/api/src/app.module.ts apps/api/src/auth
git commit -m "feat(api): warehouse transactions with partner data isolation"
```

---

### Task 8: 파렛트 환산 순수 함수

**Files:**
- Create: `apps/api/src/settlement-fees/pallet.ts`
- Test: `apps/api/src/settlement-fees/pallet.spec.ts`

**Interfaces:**
- Produces: `calcPallets(quantity: number, maxUnitsPerPallet: number, thresholdPct: number): { pallets: number; fullPallets: number; remainderRatio: number; serviced: boolean }` — 만재 + 잔여분 임계값 판정. `maxUnitsPerPallet <= 0`이면 `Error('E4107: maxUnitsPerPallet must be positive')`.

- [ ] **Step 1: 실패 테스트**

```typescript
// apps/api/src/settlement-fees/pallet.spec.ts
import { calcPallets } from './pallet';

describe('calcPallets', () => {
  // maxUnitsPerPallet=100, threshold=70%
  it.each([
    [0, 0, 0],     // 수량 0 → 0파렛트
    [69, 0, 0],    // 잔여 69% < 70% → 서비스 처리
    [70, 1, 0],    // 잔여 70% = 임계 → 1파렛트
    [100, 1, 1],   // 만재 1
    [150, 1, 1],   // 만재1 + 잔여50% → 1
    [170, 2, 1],   // 만재1 + 잔여70% → 2
    [370, 4, 3],   // 만재3 + 잔여70% → 4
  ])('quantity=%i → pallets=%i (full=%i)', (qty, expectedPallets, expectedFull) => {
    const r = calcPallets(qty, 100, 70);
    expect(r.pallets).toBe(expectedPallets);
    expect(r.fullPallets).toBe(expectedFull);
  });

  it('marks serviced=true when remainder below threshold and no full pallet', () => {
    expect(calcPallets(50, 100, 70).serviced).toBe(true);
    expect(calcPallets(150, 100, 70).serviced).toBe(false); // 만재 있으면 서비스 아님
  });

  it('respects per-product threshold override', () => {
    expect(calcPallets(50, 100, 50).pallets).toBe(1); // 임계 50%면 50개도 1파렛트
  });

  it('throws E4107 on non-positive maxUnitsPerPallet', () => {
    expect(() => calcPallets(10, 0, 70)).toThrow('E4107');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- pallet.spec` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/settlement-fees/pallet.ts
export interface PalletResult {
  pallets: number;
  fullPallets: number;
  remainderRatio: number; // 0~1
  serviced: boolean; // 잔여분이 임계 미만으로 0 처리됐고 만재도 없는 경우
}

export function calcPallets(quantity: number, maxUnitsPerPallet: number, thresholdPct: number): PalletResult {
  if (maxUnitsPerPallet <= 0) throw new Error('E4107: maxUnitsPerPallet must be positive');
  const fullPallets = Math.floor(quantity / maxUnitsPerPallet);
  const remainder = quantity % maxUnitsPerPallet;
  const remainderRatio = remainder / maxUnitsPerPallet;
  const extra = remainderRatio >= thresholdPct / 100 ? 1 : 0;
  const pallets = fullPallets + extra;
  return {
    pallets,
    fullPallets,
    remainderRatio,
    serviced: pallets === 0 && quantity > 0,
  };
}
```

- [ ] **Step 4: 통과 확인 후 Commit**

```bash
git add apps/api/src/settlement-fees
git commit -m "feat(api): pallet conversion with threshold rule"
```

---

### Task 9: 운송료 계산 순수 함수

**Files:**
- Create: `apps/api/src/settlement-fees/transport-fee.ts`
- Test: `apps/api/src/settlement-fees/transport-fee.spec.ts`

**Interfaces:**
- Produces: `calcTransportFee(input: { productRate: string | null; partnerDefaultRate: string | null; vehicleRate: string | null }): { amount: string; detail: TransportFeeDetail }`. `TransportFeeDetail = { rateSource: 'VEHICLE' | 'PRODUCT' | 'PARTNER_DEFAULT'; appliedRate: string; vehicleRateMode: 'REPLACE'; formula: string }`. 적용 우선순위: 차량 지정 시 차량 단가로 **대체**(Global Constraints 참조), 아니면 품목 요율 → 거래처 기본. 셋 다 없으면 `Error('E4108: no transport rate configured')`.

- [ ] **Step 1: 실패 테스트**

```typescript
// apps/api/src/settlement-fees/transport-fee.spec.ts
import { calcTransportFee } from './transport-fee';

describe('calcTransportFee', () => {
  it('vehicle rate replaces per-case rate when vehicle designated', () => {
    const r = calcTransportFee({ productRate: '5000', partnerDefaultRate: '3000', vehicleRate: '120000' });
    expect(r.amount).toBe('120000');
    expect(r.detail.rateSource).toBe('VEHICLE');
  });

  it('product rate overrides partner default', () => {
    const r = calcTransportFee({ productRate: '5000', partnerDefaultRate: '3000', vehicleRate: null });
    expect(r.amount).toBe('5000');
    expect(r.detail.rateSource).toBe('PRODUCT');
  });

  it('falls back to partner default', () => {
    const r = calcTransportFee({ productRate: null, partnerDefaultRate: '3000', vehicleRate: null });
    expect(r.amount).toBe('3000');
    expect(r.detail.rateSource).toBe('PARTNER_DEFAULT');
  });

  it('throws E4108 when no rate configured', () => {
    expect(() => calcTransportFee({ productRate: null, partnerDefaultRate: null, vehicleRate: null })).toThrow('E4108');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- transport-fee` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/settlement-fees/transport-fee.ts
export interface TransportFeeDetail {
  rateSource: 'VEHICLE' | 'PRODUCT' | 'PARTNER_DEFAULT';
  appliedRate: string;
  vehicleRateMode: 'REPLACE'; // ponytail: §10 미확정 — 합산 모드 필요해지면 'ADD' 분기 추가
  formula: string;
}

export function calcTransportFee(input: {
  productRate: string | null;
  partnerDefaultRate: string | null;
  vehicleRate: string | null;
}): { amount: string; detail: TransportFeeDetail } {
  const pick = input.vehicleRate
    ? { rateSource: 'VEHICLE' as const, rate: input.vehicleRate }
    : input.productRate
      ? { rateSource: 'PRODUCT' as const, rate: input.productRate }
      : input.partnerDefaultRate
        ? { rateSource: 'PARTNER_DEFAULT' as const, rate: input.partnerDefaultRate }
        : null;
  if (!pick) throw new Error('E4108: no transport rate configured');
  return {
    amount: pick.rate,
    detail: {
      rateSource: pick.rateSource,
      appliedRate: pick.rate,
      vehicleRateMode: 'REPLACE',
      formula: `건당 고정 요율 ${pick.rate} (${pick.rateSource})`,
    },
  };
}
```

- [ ] **Step 4: 통과 확인 후 Commit**

```bash
git add apps/api/src/settlement-fees
git commit -m "feat(api): transport fee calculation with rate precedence"
```

---

### Task 10: 보관료 계산 — 일별 재고 재구성 + 계약 유형 분기

**Files:**
- Create: `apps/api/src/settlement-fees/storage-fee.ts`
- Test: `apps/api/src/settlement-fees/storage-fee.spec.ts`

**Interfaces:**
- Consumes: `calcPallets` (Task 8).
- Produces:
  - `buildDailyStock(transactions: { productId: string; type: 'INBOUND' | 'OUTBOUND'; quantity: number; transactionDate: Date }[], openingStock: Map<string, number>, year: number, month: number): Map<string, number[]>` — productId → 해당 월 일별(1일~말일) 재고 수량 배열.
  - `calcStorageFeePalletDaily(dailyStock: Map<string, number[]>, products: Map<string, { maxUnitsPerPallet: number | null; palletThreshold: number | null }>, globalThresholdPct: number, palletDailyRate: string): { amount: string; detail: object }` — Σ(일별 파렛트 × 단가). `maxUnitsPerPallet` 없는 품목은 detail.skippedProducts에 기록하고 0 처리.
  - `calcStorageFeeArea(areaPyeong: string, areaRate: string, contractType: 'AREA_MONTHLY' | 'AREA_YEARLY', year: number, month: number): { amount: string; detail: object }` — 월 계약은 면적×단가, 년 계약은 (면적×단가)/12 월할.

- [ ] **Step 1: 실패 테스트**

```typescript
// apps/api/src/settlement-fees/storage-fee.spec.ts
import { buildDailyStock, calcStorageFeePalletDaily, calcStorageFeeArea } from './storage-fee';

describe('buildDailyStock', () => {
  it('accumulates inbound minus outbound per day', () => {
    const txs = [
      { productId: 'p1', type: 'INBOUND' as const, quantity: 100, transactionDate: new Date('2026-07-05') },
      { productId: 'p1', type: 'OUTBOUND' as const, quantity: 30, transactionDate: new Date('2026-07-10') },
    ];
    const stock = buildDailyStock(txs, new Map(), 2026, 7);
    const days = stock.get('p1')!;
    expect(days[3]).toBe(0);    // 7/4
    expect(days[4]).toBe(100);  // 7/5 입고 반영
    expect(days[9]).toBe(70);   // 7/10 출고 반영
    expect(days[30]).toBe(70);  // 7/31
    expect(days.length).toBe(31);
  });

  it('starts from opening stock carried from previous month', () => {
    const stock = buildDailyStock([], new Map([['p1', 50]]), 2026, 7);
    expect(stock.get('p1')![0]).toBe(50);
  });
});

describe('calcStorageFeePalletDaily', () => {
  it('sums daily pallets times rate', () => {
    // 2일간 재고 150 (만재1+잔여50%<70% → 1파렛트), 단가 1000 → 2000
    const dailyStock = new Map([['p1', [150, 150]]]);
    const products = new Map([['p1', { maxUnitsPerPallet: 100, palletThreshold: null }]]);
    const r = calcStorageFeePalletDaily(dailyStock, products, 70, '1000');
    expect(r.amount).toBe('2000');
  });

  it('uses product threshold override', () => {
    const dailyStock = new Map([['p1', [50]]]); // 50% ≥ override 50% → 1파렛트
    const products = new Map([['p1', { maxUnitsPerPallet: 100, palletThreshold: 50 }]]);
    expect(calcStorageFeePalletDaily(dailyStock, products, 70, '1000').amount).toBe('1000');
  });

  it('skips products without maxUnitsPerPallet and records them', () => {
    const dailyStock = new Map([['p1', [500]]]);
    const products = new Map([['p1', { maxUnitsPerPallet: null, palletThreshold: null }]]);
    const r = calcStorageFeePalletDaily(dailyStock, products, 70, '1000');
    expect(r.amount).toBe('0');
    expect((r.detail as any).skippedProducts).toEqual(['p1']);
  });
});

describe('calcStorageFeeArea', () => {
  it('monthly: area times rate', () => {
    expect(calcStorageFeeArea('100', '10000', 'AREA_MONTHLY', 2026, 7).amount).toBe('1000000');
  });
  it('yearly: divided by 12', () => {
    expect(calcStorageFeeArea('120', '12000', 'AREA_YEARLY', 2026, 7).amount).toBe('120000');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- storage-fee` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/settlement-fees/storage-fee.ts
import { Prisma } from '@prisma/client';
import { calcPallets } from './pallet';

type Tx = { productId: string; type: 'INBOUND' | 'OUTBOUND'; quantity: number; transactionDate: Date };

export function buildDailyStock(
  transactions: Tx[], openingStock: Map<string, number>, year: number, month: number,
): Map<string, number[]> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const productIds = new Set([...openingStock.keys(), ...transactions.map(t => t.productId)]);
  const result = new Map<string, number[]>();

  for (const pid of productIds) {
    const deltaByDay = new Array(daysInMonth).fill(0);
    for (const tx of transactions) {
      if (tx.productId !== pid) continue;
      const day = tx.transactionDate.getUTCDate() - 1;
      deltaByDay[day] += tx.type === 'INBOUND' ? tx.quantity : -tx.quantity;
    }
    const days: number[] = [];
    let running = openingStock.get(pid) ?? 0;
    for (let d = 0; d < daysInMonth; d++) {
      running += deltaByDay[d];
      days.push(running);
    }
    result.set(pid, days);
  }
  return result;
}

export function calcStorageFeePalletDaily(
  dailyStock: Map<string, number[]>,
  products: Map<string, { maxUnitsPerPallet: number | null; palletThreshold: number | null }>,
  globalThresholdPct: number,
  palletDailyRate: string,
): { amount: string; detail: object } {
  const rate = new Prisma.Decimal(palletDailyRate);
  let totalPalletDays = 0;
  const perProduct: Record<string, { palletDays: number; threshold: number }> = {};
  const skippedProducts: string[] = [];

  for (const [pid, days] of dailyStock) {
    const p = products.get(pid);
    if (!p?.maxUnitsPerPallet) { skippedProducts.push(pid); continue; }
    const threshold = p.palletThreshold ?? globalThresholdPct;
    let palletDays = 0;
    for (const qty of days) {
      if (qty > 0) palletDays += calcPallets(qty, p.maxUnitsPerPallet, threshold).pallets;
    }
    totalPalletDays += palletDays;
    perProduct[pid] = { palletDays, threshold };
  }

  return {
    amount: rate.mul(totalPalletDays).toFixed(0),
    detail: {
      contractType: 'PALLET_DAILY', palletDailyRate, totalPalletDays, perProduct, skippedProducts,
      formula: `${totalPalletDays} 파렛트일 × ${palletDailyRate}`,
    },
  };
}

export function calcStorageFeeArea(
  areaPyeong: string, areaRate: string,
  contractType: 'AREA_MONTHLY' | 'AREA_YEARLY', year: number, month: number,
): { amount: string; detail: object } {
  const gross = new Prisma.Decimal(areaPyeong).mul(new Prisma.Decimal(areaRate));
  const amount = contractType === 'AREA_YEARLY' ? gross.div(12) : gross;
  return {
    amount: amount.toFixed(0),
    detail: {
      contractType, areaPyeong, areaRate, period: `${year}-${String(month).padStart(2, '0')}`,
      formula: contractType === 'AREA_YEARLY'
        ? `${areaPyeong}평 × ${areaRate} ÷ 12 (년임대 월할)`
        : `${areaPyeong}평 × ${areaRate}`,
    },
  };
}
```

- [ ] **Step 4: 통과 확인 후 Commit**

```bash
git add apps/api/src/settlement-fees
git commit -m "feat(api): storage fee calculation for pallet-daily and area contracts"
```

---

### Task 11: 정산 마감 서비스 — SettlementRecord 스냅샷 + 잠금

**Files:**
- Create: `apps/api/src/settlement-fees/settlement-fees.module.ts`
- Create: `apps/api/src/settlement-fees/settlement-fees.service.ts`
- Create: `apps/api/src/settlement-fees/settlement-fees.controller.ts`
- Test: `apps/api/src/settlement-fees/settlement-fees.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `calcTransportFee`(Task 9), `buildDailyStock`/`calcStorageFeePalletDaily`/`calcStorageFeeArea`(Task 10), `RatesService.getPalletThreshold`(Task 6).
- Produces:
  - `SettlementFeesService.previewMonth(yearMonth: string)` — `{ partners: [{ partnerId, transportTotal, storageTotal, errors: [{transactionId, code, message}] }] }`. 요율 누락(E4108) 건은 errors에 수집.
  - `closeMonth(yearMonth: string, userId: string)` — errors 존재 시 `BadRequestException('E4109: unresolved calculation errors')`. 성공 시: 거래처×건별 TRANSPORT 레코드 + 거래처별 STORAGE 레코드 생성, 기존 `SettlementRecord` 삭제 후 재생성(멱등), 이후 해당 월 실적 수정은 Task 7의 E2002 가드가 차단.
  - `getBreakdown(transactionId: string)` — 해당 건의 SettlementRecord + calculationDetail.
  - `getStatement(partnerId: string, yearMonth: string)` — 거래처 월 정산서 집계 `{ transport: { count, total, records }, storage: { total, records }, grandTotal }`.
  - REST: `POST /settlement-fees/preview` body `{yearMonth}`, `POST /settlement-fees/close` (HQ_ADMIN), `GET /settlement-fees/breakdown/:transactionId`, `GET /settlement-fees/statement?partnerId&yearMonth`.
  - PARTNER_COORDINATOR는 breakdown/statement에서 자사 데이터만 (Task 7과 동일 스코프 패턴 — 타사 요청 시 `ForbiddenException` 403).

- [ ] **Step 1: 실패 테스트**

```typescript
// apps/api/src/settlement-fees/settlement-fees.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SettlementFeesService } from './settlement-fees.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';

const prismaMock: any = {
  warehouseTransaction: { findMany: jest.fn(), aggregate: jest.fn() },
  partner: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
  storageContract: { findMany: jest.fn() },
  settlementRecord: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  settlementPeriod: { upsert: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
};
const ratesMock = { getPalletThreshold: jest.fn().mockResolvedValue(70) };

function txFixture(over: object = {}) {
  return {
    id: 't1', type: 'OUTBOUND', partnerId: 'p1', productId: 'prod1', quantity: 1,
    transactionDate: new Date('2026-07-10'), vehicleRateId: null,
    product: { transportRate: '5000', maxUnitsPerPallet: 100, palletThreshold: null },
    partner: { defaultTransportRate: '3000' },
    vehicleRate: null,
    ...over,
  };
}

describe('SettlementFeesService', () => {
  let service: SettlementFeesService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SettlementFeesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RatesService, useValue: ratesMock },
      ],
    }).compile();
    service = module.get(SettlementFeesService);
    prismaMock.partner.findMany.mockResolvedValue([{ id: 'p1' }]);
    prismaMock.storageContract.findMany.mockResolvedValue([
      { partnerId: 'p1', contractType: 'PALLET_DAILY', palletDailyRate: '1000', areaPyeong: null, areaRate: null },
    ]);
    prismaMock.warehouseTransaction.aggregate.mockResolvedValue({ _sum: { quantity: null } });
    prismaMock.product.findMany.mockResolvedValue([{ id: 'prod1', maxUnitsPerPallet: 100, palletThreshold: null }]);
  });

  it('collects E4108 errors for transactions without any rate', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({ product: { transportRate: null, maxUnitsPerPallet: 100, palletThreshold: null }, partner: { defaultTransportRate: null } }),
    ]);
    const r = await service.previewMonth('2026-07');
    expect(r.partners[0].errors[0].code).toBe('E4108');
  });

  it('closeMonth throws E4109 when errors exist', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({ product: { transportRate: null, maxUnitsPerPallet: 100, palletThreshold: null }, partner: { defaultTransportRate: null } }),
    ]);
    await expect(service.closeMonth('2026-07', 'u1')).rejects.toThrow(/E4109/);
  });

  it('closeMonth snapshots records and locks period', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
    await service.closeMonth('2026-07', 'u1');
    expect(prismaMock.settlementRecord.deleteMany).toHaveBeenCalledWith({ where: { periodYearMonth: '2026-07' } });
    expect(prismaMock.settlementRecord.createMany).toHaveBeenCalled();
    const rows = prismaMock.settlementRecord.createMany.mock.calls[0][0].data;
    expect(rows.find((r: any) => r.feeType === 'TRANSPORT').amount).toBe('5000');
    expect(rows.find((r: any) => r.feeType === 'STORAGE')).toBeDefined();
    expect(prismaMock.settlementPeriod.upsert).toHaveBeenCalled();
  });

  it('getStatement denies other partner for scoped caller', async () => {
    await expect(
      service.getStatement('OTHER', '2026-07', { partnerId: 'p1' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- settlement-fees.service` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/settlement-fees/settlement-fees.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';
import { calcTransportFee } from './transport-fee';
import { buildDailyStock, calcStorageFeePalletDaily, calcStorageFeeArea } from './storage-fee';

interface CalcError { transactionId: string; code: string; message: string }

@Injectable()
export class SettlementFeesService {
  constructor(private readonly prisma: PrismaService, private readonly rates: RatesService) {}

  private monthRange(yearMonth: string) {
    const [y, m] = yearMonth.split('-').map(Number);
    return { y, m, start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0, 23, 59, 59)) };
  }

  /** 월 전체 계산. records는 생성하지 않고 결과만 반환 (preview/close 공용) */
  private async computeMonth(yearMonth: string) {
    const { y, m, start, end } = this.monthRange(yearMonth);
    const globalThreshold = await this.rates.getPalletThreshold();
    const partners = await this.prisma.partner.findMany({ where: { isActive: true } });
    const contracts = await this.prisma.storageContract.findMany({ where: { isActive: true } });
    const contractByPartner = new Map(contracts.map(c => [c.partnerId, c]));

    const txs = await this.prisma.warehouseTransaction.findMany({
      where: { transactionDate: { gte: start, lte: end } },
      include: {
        product: { select: { id: true, transportRate: true, maxUnitsPerPallet: true, palletThreshold: true } },
        partner: { select: { defaultTransportRate: true } },
        vehicleRate: { select: { rate: true } },
      },
    });

    const records: Prisma.SettlementRecordCreateManyInput[] = [];
    const results = [];

    for (const partner of partners) {
      const partnerTxs = txs.filter(t => t.partnerId === partner.id);
      const errors: CalcError[] = [];
      let transportTotal = new Prisma.Decimal(0);

      // 운송료: 출고 건당
      for (const tx of partnerTxs.filter(t => t.type === 'OUTBOUND')) {
        try {
          const fee = calcTransportFee({
            productRate: tx.product.transportRate?.toString() ?? null,
            partnerDefaultRate: tx.partner.defaultTransportRate?.toString() ?? null,
            vehicleRate: tx.vehicleRate?.rate?.toString() ?? null,
          });
          transportTotal = transportTotal.add(fee.amount);
          records.push({
            transactionId: tx.id, partnerId: partner.id, periodYearMonth: yearMonth,
            feeType: 'TRANSPORT', amount: fee.amount, calculationDetail: fee.detail as unknown as Prisma.InputJsonValue,
          });
        } catch (e: any) {
          errors.push({ transactionId: tx.id, code: e.message.slice(0, 5), message: e.message });
        }
      }

      // 보관료: 계약 유형 분기
      const contract = contractByPartner.get(partner.id);
      let storageTotal = new Prisma.Decimal(0);
      if (contract) {
        let storage: { amount: string; detail: object };
        if (contract.contractType === 'PALLET_DAILY') {
          const opening = await this.openingStock(partner.id, start);
          const dailyStock = buildDailyStock(
            partnerTxs.map(t => ({ productId: t.productId, type: t.type, quantity: t.quantity, transactionDate: t.transactionDate })),
            opening, y, m,
          );
          const productIds = [...dailyStock.keys()];
          const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
          storage = calcStorageFeePalletDaily(
            dailyStock,
            new Map(products.map(p => [p.id, {
              maxUnitsPerPallet: p.maxUnitsPerPallet,
              palletThreshold: p.palletThreshold ? Number(p.palletThreshold) : null,
            }])),
            globalThreshold,
            contract.palletDailyRate!.toString(),
          );
        } else {
          storage = calcStorageFeeArea(
            contract.areaPyeong!.toString(), contract.areaRate!.toString(),
            contract.contractType as 'AREA_MONTHLY' | 'AREA_YEARLY', y, m,
          );
        }
        storageTotal = new Prisma.Decimal(storage.amount);
        records.push({
          transactionId: null, partnerId: partner.id, periodYearMonth: yearMonth,
          feeType: 'STORAGE', amount: storage.amount, calculationDetail: storage.detail as unknown as Prisma.InputJsonValue,
        });
      }

      results.push({
        partnerId: partner.id,
        transportTotal: transportTotal.toFixed(0),
        storageTotal: storageTotal.toFixed(0),
        errors,
      });
    }
    return { results, records, start, end };
  }

  /** 전월 이월 재고: 해당 월 이전 입고합 − 출고합 (품목별) */
  private async openingStock(partnerId: string, before: Date): Promise<Map<string, number>> {
    const grouped = await this.prisma.warehouseTransaction.groupBy({
      by: ['productId', 'type'],
      where: { partnerId, transactionDate: { lt: before } },
      _sum: { quantity: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) {
      const delta = (g._sum.quantity ?? 0) * (g.type === 'INBOUND' ? 1 : -1);
      map.set(g.productId, (map.get(g.productId) ?? 0) + delta);
    }
    return map;
  }

  async previewMonth(yearMonth: string) {
    const { results } = await this.computeMonth(yearMonth);
    return { partners: results };
  }

  async closeMonth(yearMonth: string, userId: string) {
    const { results, records, start, end } = await this.computeMonth(yearMonth);
    const allErrors = results.flatMap(r => r.errors);
    if (allErrors.length > 0) {
      throw new BadRequestException({ message: 'E4109: unresolved calculation errors', errors: allErrors });
    }
    await this.prisma.$transaction(async tx => {
      await tx.settlementRecord.deleteMany({ where: { periodYearMonth: yearMonth } });
      await tx.settlementRecord.createMany({ data: records });
      await tx.settlementPeriod.upsert({
        where: { branchId_periodStart: { branchId: 'WAREHOUSE', periodStart: start } } as any,
        create: { branchId: 'WAREHOUSE', periodStart: start, periodEnd: end, status: 'LOCKED', lockedBy: userId, lockedAt: new Date() },
        update: { status: 'LOCKED', lockedBy: userId, lockedAt: new Date() },
      });
    });
    return { yearMonth, partners: results };
  }

  async getBreakdown(transactionId: string, scope: { partnerId?: string }) {
    const record = await this.prisma.settlementRecord.findFirst({
      where: { transactionId }, include: { transaction: { include: { product: true } } },
    });
    if (record && scope.partnerId && record.partnerId !== scope.partnerId) {
      throw new ForbiddenException('E4110: access denied to other partner data');
    }
    return record;
  }

  async getStatement(partnerId: string, yearMonth: string, scope: { partnerId?: string } = {}) {
    if (scope.partnerId && scope.partnerId !== partnerId) {
      throw new ForbiddenException('E4110: access denied to other partner data');
    }
    const records = await this.prisma.settlementRecord.findMany({
      where: { partnerId, periodYearMonth: yearMonth },
      include: { transaction: { include: { product: { select: { code: true, name: true } } } } },
    });
    const transport = records.filter(r => r.feeType === 'TRANSPORT');
    const storage = records.filter(r => r.feeType === 'STORAGE');
    const sum = (rs: typeof records) => rs.reduce((a, r) => a.add(r.amount), new Prisma.Decimal(0));
    return {
      partnerId, yearMonth,
      transport: { count: transport.length, total: sum(transport).toFixed(0), records: transport },
      storage: { total: sum(storage).toFixed(0), records: storage },
      grandTotal: sum(records).toFixed(0),
    };
  }
}
```

주의: `settlementPeriod.upsert`의 복합 unique 키는 실제 스키마의 `@@unique` 구성을 확인해 맞출 것. `SettlementPeriod`에 `@@unique([branchId, periodStart])`가 없으면 Task 1 마이그레이션에 추가하고, `branchId: 'WAREHOUSE'` 대신 창고 전용 sentinel Branch 레코드를 시드하거나 `findFirst`+`create/update` 2단계로 구현해도 된다 — 구현 시 판단, 테스트가 잠금 동작을 검증하면 충분.

컨트롤러 (`settlement-fees.controller.ts`): `@Controller('settlement-fees')`.
- `POST /preview` body `{yearMonth}` — HQ_ADMIN
- `POST /close` body `{yearMonth}` — HQ_ADMIN
- `GET /breakdown/:transactionId` — HQ_ADMIN, PARTNER_COORDINATOR (스코프: Task 7 패턴)
- `GET /statement?partnerId=&yearMonth=` — HQ_ADMIN, PARTNER_COORDINATOR (스코프 동일)

모듈: `imports: [MasterDataModule]` (RatesService 사용), `app.module.ts` 등록.

- [ ] **Step 4: 통과 확인 후 Commit**

Run: `pnpm --filter api test -- settlement-fees.service` → PASS

```bash
git add apps/api/src/settlement-fees apps/api/src/app.module.ts
git commit -m "feat(api): monthly settlement close with fee snapshot records"
```

---

### Task 12: 엑셀 마스터 이관 — exceljs 파싱 + 검증 + 카테고리 추출

**Files:**
- Create: `apps/api/src/master-data/excel-import.service.ts`
- Create: `apps/api/src/master-data/excel-import.controller.ts`
- Test: `apps/api/src/master-data/excel-import.service.spec.ts`
- Modify: `apps/api/package.json` (exceljs 추가), `apps/api/src/master-data/master-data.module.ts`

**Interfaces:**
- Consumes: `PartnersService.create`(Task 3), `ProductsService.create`(Task 5), `CategoriesService`(Task 4), `validateBusinessRegistrationNo`(Task 2).
- Produces:
  - `ExcelImportService.parsePartners(buffer: Buffer, mapping: Record<string, string>)` / `parseProducts(buffer, mapping)` — `{ validRows: object[]; invalidRows: { rowIndex: number; errors: string[]; raw: object }[]; extractedCategories: string[] }`. mapping은 `{ 필드명: 엑셀컬럼레터 }` (예: `{ name: 'B', code: 'A' }`).
  - `commitPartners(validRows)` / `commitProducts(validRows, categoryNameToId)` — 정상 행만 반영.
  - REST: `POST /master-data/import/partners/parse` (multipart file + mapping JSON), `POST /master-data/import/partners/commit`, products 동형.

- [ ] **Step 1: exceljs 설치**

Run: `pnpm --filter api add exceljs && pnpm --filter api add -D @types/multer`
Expected: package.json에 exceljs 추가.

- [ ] **Step 2: 실패 테스트** (exceljs로 테스트 내부에서 워크북 생성 → 파싱 검증. 파일 fixture 불필요)

```typescript
// apps/api/src/master-data/excel-import.service.spec.ts
import * as ExcelJS from 'exceljs';
import { Test } from '@nestjs/testing';
import { ExcelImportService } from './excel-import.service';
import { PartnersService } from './partners.service';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';

async function buildXlsx(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  rows.forEach(r => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('ExcelImportService', () => {
  let service: ExcelImportService;
  const partnersMock = { create: jest.fn() };
  const productsMock = { create: jest.fn() };
  const categoriesMock = { create: jest.fn(), findTree: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ExcelImportService,
        { provide: PartnersService, useValue: partnersMock },
        { provide: ProductsService, useValue: productsMock },
        { provide: CategoriesService, useValue: categoriesMock },
      ],
    }).compile();
    service = module.get(ExcelImportService);
  });

  it('parses partner rows with column mapping, skipping header', async () => {
    const buf = await buildXlsx([
      ['코드', '업체명', '사업자번호'],
      ['KM001', '테스트상사', '120-81-47521'],
    ]);
    const r = await service.parsePartners(buf, { code: 'A', name: 'B', businessRegistrationNo: 'C' });
    expect(r.validRows).toHaveLength(1);
    expect(r.validRows[0]).toMatchObject({ code: 'KM001', name: '테스트상사' });
  });

  it('collects invalid rows with reasons (bad BRN, missing name)', async () => {
    const buf = await buildXlsx([
      ['코드', '업체명', '사업자번호'],
      ['KM002', '', '111-11-11111'],
    ]);
    const r = await service.parsePartners(buf, { code: 'A', name: 'B', businessRegistrationNo: 'C' });
    expect(r.validRows).toHaveLength(0);
    expect(r.invalidRows[0].rowIndex).toBe(2);
    expect(r.invalidRows[0].errors.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts unique category names from product sheet', async () => {
    const buf = await buildXlsx([
      ['품목코드', '상품명', '분류'],
      ['A1', '냉장고', '대형가전'],
      ['A2', '세탁기', '대형가전'],
      ['A3', '청소기', '소형가전'],
    ]);
    const r = await service.parseProducts(buf, { code: 'A', name: 'B', categoryName: 'C' });
    expect(r.extractedCategories).toEqual(['대형가전', '소형가전']);
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `pnpm --filter api test -- excel-import` → FAIL

- [ ] **Step 4: 구현**

```typescript
// apps/api/src/master-data/excel-import.service.ts
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { validateBusinessRegistrationNo } from '@erp/shared';
import { PartnersService } from './partners.service';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';

export interface InvalidRow { rowIndex: number; errors: string[]; raw: object }

@Injectable()
export class ExcelImportService {
  constructor(
    private readonly partners: PartnersService,
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  private async readRows(buffer: Buffer, mapping: Record<string, string>) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    const rows: { rowIndex: number; raw: Record<string, string> }[] = [];
    ws.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // header
      const raw: Record<string, string> = {};
      for (const [field, col] of Object.entries(mapping)) {
        const cell = row.getCell(col);
        raw[field] = cell.value == null ? '' : String(cell.text ?? cell.value).trim();
      }
      rows.push({ rowIndex, raw });
    });
    return rows;
  }

  async parsePartners(buffer: Buffer, mapping: Record<string, string>) {
    const rows = await this.readRows(buffer, mapping);
    const validRows: object[] = [];
    const invalidRows: InvalidRow[] = [];
    for (const { rowIndex, raw } of rows) {
      const errors: string[] = [];
      if (!raw.name) errors.push('업체명 누락');
      if (raw.businessRegistrationNo && !validateBusinessRegistrationNo(raw.businessRegistrationNo)) {
        errors.push('사업자등록번호 체크섬 오류');
      }
      if (errors.length) invalidRows.push({ rowIndex, errors, raw });
      else validRows.push(raw);
    }
    return { validRows, invalidRows, extractedCategories: [] as string[] };
  }

  async parseProducts(buffer: Buffer, mapping: Record<string, string>) {
    const rows = await this.readRows(buffer, mapping);
    const validRows: object[] = [];
    const invalidRows: InvalidRow[] = [];
    const categorySet = new Set<string>();
    for (const { rowIndex, raw } of rows) {
      const errors: string[] = [];
      if (!raw.name) errors.push('상품명 누락');
      if (raw.categoryName) categorySet.add(raw.categoryName);
      if (raw.unitPrice && isNaN(Number(raw.unitPrice))) errors.push('단가 숫자 아님');
      if (raw.costPrice && isNaN(Number(raw.costPrice))) errors.push('원가 숫자 아님');
      if (errors.length) invalidRows.push({ rowIndex, errors, raw });
      else validRows.push(raw);
    }
    return { validRows, invalidRows, extractedCategories: [...categorySet] };
  }

  /** 정상 행만 반영. 실패 행은 결과에 수집해 반환 (부분 성공 허용 — 업로드 화면에서 선택) */
  async commitPartners(validRows: any[]) {
    const results = { created: 0, failed: [] as { row: object; error: string }[] };
    for (const row of validRows) {
      try {
        await this.partners.create(row);
        results.created++;
      } catch (e: any) {
        results.failed.push({ row, error: e.message });
      }
    }
    return results;
  }

  async commitProducts(validRows: any[]) {
    // 카테고리 이름 → id 매핑 (없으면 depth1으로 생성)
    const tree = await this.categories.findTree();
    const nameToId = new Map<string, string>();
    const walk = (nodes: any[]) => nodes.forEach(n => { nameToId.set(n.name, n.id); walk(n.children ?? []); });
    walk(tree);

    const results = { created: 0, failed: [] as { row: object; error: string }[] };
    for (const row of validRows) {
      try {
        let categoryId = nameToId.get(row.categoryName);
        if (!categoryId) {
          const created = await this.categories.create({ name: row.categoryName });
          categoryId = created.id;
          nameToId.set(row.categoryName, categoryId);
        }
        const { categoryName: _c, ...productDto } = row;
        await this.products.create({ ...productDto, categoryId });
        results.created++;
      } catch (e: any) {
        results.failed.push({ row, error: e.message });
      }
    }
    return results;
  }
}
```

컨트롤러: `@Controller('master-data/import')`, HQ_ADMIN. `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile()` 로 multipart 수신, mapping은 form field JSON 파싱. 엔드포인트 4개: `POST /partners/parse`, `POST /partners/commit` (body `{rows}`), `POST /products/parse`, `POST /products/commit`.

- [ ] **Step 5: 통과 확인 후 Commit**

```bash
git add apps/api/src/master-data apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): excel master import with validation and category extraction"
```

---

### Task 13: 실적 엑셀 업로드 + 정산서/출고명세서 엑셀 다운로드

**Files:**
- Create: `apps/api/src/warehouse/transaction-import.service.ts`
- Create: `apps/api/src/settlement-fees/statement-export.service.ts`
- Test: `apps/api/src/warehouse/transaction-import.service.spec.ts`
- Modify: `apps/api/src/warehouse/warehouse.module.ts`, `apps/api/src/warehouse/transactions.controller.ts`, `apps/api/src/settlement-fees/settlement-fees.module.ts`, `apps/api/src/settlement-fees/settlement-fees.controller.ts`

**Interfaces:**
- Consumes: `TransactionsService.create`(Task 7, `source: 'EXCEL'`), `SettlementFeesService.getStatement`(Task 11), Task 12의 `readRows` 패턴, 기존 `Export` 모델 패턴 (`reports.service.ts:355` 참조).
- Produces:
  - `TransactionImportService.parse(buffer, mapping)` — 필드: `partnerCode`, `productCode`, `type`(입고/출고 한글 허용 → enum 변환), `quantity`, `transactionDate`. 코드 → id 해석 실패·수량 비정수·날짜 파싱 실패는 invalidRows.
  - `TransactionImportService.commit(validRows, userId)` — Task 7 create 재사용 (`source: 'EXCEL'`), E2002 등 실패 행 수집.
  - `StatementExportService.buildStatementXlsx(partnerId, yearMonth): Promise<Buffer>` — 정산서: 운송료 건별 시트 + 보관료 시트 + 합계. `buildShipmentListXlsx(partnerId, dateFrom, dateTo): Promise<Buffer>` — 출고명세서: 출고 건 목록.
  - REST: `POST /warehouse/transactions/import/parse`, `POST /warehouse/transactions/import/commit`, `GET /settlement-fees/statement/download?partnerId&yearMonth` (xlsx 스트림, PARTNER_COORDINATOR 스코프 적용), `GET /warehouse/transactions/shipment-list/download?partnerId&dateFrom&dateTo` (동일 스코프).

- [ ] **Step 1: 실패 테스트**

```typescript
// apps/api/src/warehouse/transaction-import.service.spec.ts
import * as ExcelJS from 'exceljs';
import { Test } from '@nestjs/testing';
import { TransactionImportService } from './transaction-import.service';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

async function buildXlsx(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('s');
  rows.forEach(r => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const prismaMock = {
  partner: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
};
const txServiceMock = { create: jest.fn() };
const mapping = { partnerCode: 'A', productCode: 'B', type: 'C', quantity: 'D', transactionDate: 'E' };

describe('TransactionImportService', () => {
  let service: TransactionImportService;
  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.partner.findMany.mockResolvedValue([{ id: 'p1', code: 'KM001' }]);
    prismaMock.product.findMany.mockResolvedValue([{ id: 'prod1', code: 'I-00001', partnerId: 'p1' }]);
    const module = await Test.createTestingModule({
      providers: [
        TransactionImportService,
        { provide: TransactionsService, useValue: txServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(TransactionImportService);
  });

  it('resolves codes and converts 한글 type', async () => {
    const buf = await buildXlsx([
      ['거래처', '품목', '구분', '수량', '일자'],
      ['KM001', 'I-00001', '출고', 5, '2026-07-20'],
    ]);
    const r = await service.parse(buf, mapping);
    expect(r.validRows[0]).toMatchObject({ partnerId: 'p1', productId: 'prod1', type: 'OUTBOUND', quantity: 5 });
  });

  it('collects unknown codes as invalid rows', async () => {
    const buf = await buildXlsx([
      ['거래처', '품목', '구분', '수량', '일자'],
      ['NOPE', 'I-00001', '입고', 5, '2026-07-20'],
    ]);
    const r = await service.parse(buf, mapping);
    expect(r.invalidRows[0].errors[0]).toContain('거래처');
  });

  it('commit passes rows to TransactionsService with EXCEL source', async () => {
    txServiceMock.create.mockResolvedValue({});
    const rows = [{ partnerId: 'p1', productId: 'prod1', type: 'OUTBOUND', quantity: 5, transactionDate: '2026-07-20' }];
    const r = await service.commit(rows as any, 'u1');
    expect(txServiceMock.create).toHaveBeenCalledWith(expect.anything(), 'u1', 'EXCEL');
    expect(r.created).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter api test -- transaction-import` → FAIL

- [ ] **Step 3: 구현**

```typescript
// apps/api/src/warehouse/transaction-import.service.ts
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

const TYPE_MAP: Record<string, 'INBOUND' | 'OUTBOUND'> = {
  입고: 'INBOUND', 출고: 'OUTBOUND', INBOUND: 'INBOUND', OUTBOUND: 'OUTBOUND',
};

@Injectable()
export class TransactionImportService {
  constructor(private readonly prisma: PrismaService, private readonly txService: TransactionsService) {}

  async parse(buffer: Buffer, mapping: Record<string, string>) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const partners = await this.prisma.partner.findMany({ select: { id: true, code: true } });
    const products = await this.prisma.product.findMany({ select: { id: true, code: true, partnerId: true } });
    const partnerByCode = new Map(partners.map(p => [p.code, p.id]));
    const productByCode = new Map(products.map(p => [p.code, p]));

    const validRows: object[] = [];
    const invalidRows: { rowIndex: number; errors: string[]; raw: object }[] = [];

    ws.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return;
      const raw: Record<string, string> = {};
      for (const [field, col] of Object.entries(mapping)) {
        const cell = row.getCell(col);
        raw[field] = cell.value == null ? '' : String(cell.text ?? cell.value).trim();
      }
      const errors: string[] = [];
      const partnerId = partnerByCode.get(raw.partnerCode);
      if (!partnerId) errors.push(`거래처 코드 없음: ${raw.partnerCode}`);
      const product = productByCode.get(raw.productCode);
      if (!product) errors.push(`품목 코드 없음: ${raw.productCode}`);
      else if (partnerId && product.partnerId !== partnerId) errors.push('품목이 해당 거래처 소속 아님');
      const type = TYPE_MAP[raw.type];
      if (!type) errors.push(`구분 값 오류: ${raw.type} (입고/출고)`);
      const quantity = Number(raw.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) errors.push(`수량 오류: ${raw.quantity}`);
      const date = new Date(raw.transactionDate);
      if (isNaN(date.getTime())) errors.push(`일자 파싱 실패: ${raw.transactionDate}`);

      if (errors.length) invalidRows.push({ rowIndex, errors, raw });
      else validRows.push({ partnerId, productId: product!.id, type, quantity, transactionDate: raw.transactionDate });
    });

    return { validRows, invalidRows };
  }

  async commit(rows: any[], userId: string) {
    const result = { created: 0, failed: [] as { row: object; error: string }[] };
    for (const row of rows) {
      try {
        await this.txService.create(row, userId, 'EXCEL');
        result.created++;
      } catch (e: any) {
        result.failed.push({ row, error: e.message });
      }
    }
    return result;
  }
}
```

`StatementExportService`: `SettlementFeesService.getStatement` 결과와 `TransactionsService.findAll` 결과를 exceljs 워크북으로 변환. 시트 구성 — 정산서: [운송료] 건별(일자/품목코드/품목명/수량/적용요율출처/금액), [보관료] detail 전개(파렛트일수·단가 또는 면적·단가), [합계]. 출고명세서: 출고 건 목록(일자/품목/수량). 응답은 `res.set({'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename=...'})` + buffer 전송. 서비스 로직이 단순 변환이므로 xlsx 생성 자체는 테스트 생략, statement 데이터 접근 스코프는 Task 11 테스트가 커버.

- [ ] **Step 4: 통과 확인 후 Commit**

Run: `pnpm --filter api test -- transaction-import` → PASS

```bash
git add apps/api/src/warehouse apps/api/src/settlement-fees
git commit -m "feat(api): transaction excel import and statement xlsx export"
```

---

### Task 14: 웹 — master-data feature (거래처·품목·카테고리·단가표 화면)

**Files:**
- Create: `apps/web/src/app/features/master-data/master-data.routes.ts`
- Create: `apps/web/src/app/features/master-data/services/master-data.service.ts`
- Create: `apps/web/src/app/features/master-data/pages/partner-list/partner-list.page.ts`
- Create: `apps/web/src/app/features/master-data/pages/partner-form/partner-form.page.ts`
- Create: `apps/web/src/app/features/master-data/pages/product-list/product-list.page.ts`
- Create: `apps/web/src/app/features/master-data/pages/product-form/product-form.page.ts`
- Create: `apps/web/src/app/features/master-data/pages/category-tree/category-tree.page.ts`
- Create: `apps/web/src/app/features/master-data/pages/rate-cards/rate-cards.page.ts`
- Create: `apps/web/src/app/features/master-data/pages/master-import/master-import.page.ts`
- Test: `apps/web/src/app/features/master-data/services/master-data.service.spec.ts`
- Modify: `apps/web/src/app/app.routes.ts` (lazy route 추가, HQ_ADMIN 가드)

**Interfaces:**
- Consumes: Task 3~6, 12의 REST API. 기존 `core/interceptors`(토큰), 기존 role guard 패턴 (`app.routes.ts`의 기존 가드 사용법 참조).
- Produces: 라우트 `/master-data/partners`, `/master-data/partners/new`, `/master-data/products`, `/master-data/products/new`, `/master-data/categories`, `/master-data/rate-cards`, `/master-data/import`. `MasterDataService` — 시그니처 아래 참조.

- [ ] **Step 1: 서비스 실패 테스트**

```typescript
// apps/web/src/app/features/master-data/services/master-data.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MasterDataService } from './master-data.service';
import { environment } from '../../../../environments/environment';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MasterDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps double-nested response for partner list', async () => {
    const promise = service.getPartners({ page: 1 });
    const req = http.expectOne(r => r.url.includes('/master-data/partners'));
    req.flush({ data: { data: [{ id: 'p1', code: 'P-0001' }], totalCount: 1 } });
    const result = await promise;
    expect(result.data[0].code).toBe('P-0001');
    expect(result.totalCount).toBe(1);
  });

  it('posts partner with nested storage contract', async () => {
    const dto = {
      name: '테스트', storageContract: { contractType: 'PALLET_DAILY', palletDailyRate: '1500', startDate: '2026-07-01' },
    };
    const promise = service.createPartner(dto as any);
    const req = http.expectOne(r => r.method === 'POST' && r.url.includes('/master-data/partners'));
    expect(req.request.body.storageContract.contractType).toBe('PALLET_DAILY');
    req.flush({ data: { data: { id: 'p1' } } });
    await promise;
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web test -- --include='**/master-data.service.spec.ts' --watch=false` → FAIL

- [ ] **Step 3: 서비스 구현**

```typescript
// apps/web/src/app/features/master-data/services/master-data.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ponytail: 백엔드 DTO와 수동 동기화 — packages/shared로 옮길 시점은 세 번째 소비자 등장 때
export interface PartnerRow {
  id: string; code: string; name: string;
  businessRegistrationNo?: string; representativeName?: string;
  businessType?: string; businessCategory?: string; address?: string;
  contactName?: string; phone?: string; email?: string;
  defaultTransportRate?: string;
  storageContracts?: StorageContractRow[];
}
export interface StorageContractRow {
  contractType: 'PALLET_DAILY' | 'AREA_MONTHLY' | 'AREA_YEARLY';
  palletDailyRate?: string; areaPyeong?: string; areaRate?: string;
  startDate: string; endDate?: string;
}
export interface ProductRow {
  id: string; code: string; name: string; categoryId: string; partnerId: string;
  unitPrice: string; costPrice: string; transportRate?: string;
  palletThreshold?: string; maxUnitsPerPallet?: number;
}
export interface CategoryNode {
  id: string; code: string; name: string; depth: number; children: CategoryNode[];
}

type Paged<T> = { data: T[]; totalCount: number };
const unwrap = <T>() => map((res: any) => res.data.data as T);

@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/master-data`;

  getPartners(q: { search?: string; page?: number }): Promise<Paged<PartnerRow>> {
    return firstValueFrom(this.http.get(`${this.base}/partners`, { params: { ...q } as any }).pipe(unwrap<Paged<PartnerRow>>()));
  }
  createPartner(dto: Omit<PartnerRow, 'id'> & { storageContract: StorageContractRow }): Promise<PartnerRow> {
    return firstValueFrom(this.http.post(`${this.base}/partners`, dto).pipe(unwrap<PartnerRow>()));
  }
  updatePartner(id: string, dto: Partial<PartnerRow>): Promise<PartnerRow> {
    return firstValueFrom(this.http.patch(`${this.base}/partners/${id}`, dto).pipe(unwrap<PartnerRow>()));
  }

  getProducts(q: { partnerId?: string; search?: string; page?: number }): Promise<Paged<ProductRow>> {
    return firstValueFrom(this.http.get(`${this.base}/products`, { params: { ...q } as any }).pipe(unwrap<Paged<ProductRow>>()));
  }
  createProduct(dto: Omit<ProductRow, 'id'>): Promise<ProductRow> {
    return firstValueFrom(this.http.post(`${this.base}/products`, dto).pipe(unwrap<ProductRow>()));
  }
  updateProduct(id: string, dto: Partial<ProductRow>): Promise<ProductRow> {
    return firstValueFrom(this.http.patch(`${this.base}/products/${id}`, dto).pipe(unwrap<ProductRow>()));
  }

  getCategoryTree(): Promise<CategoryNode[]> {
    return firstValueFrom(this.http.get(`${this.base}/categories/tree`).pipe(unwrap<CategoryNode[]>()));
  }
  createCategory(dto: { name: string; parentId?: string }): Promise<CategoryNode> {
    return firstValueFrom(this.http.post(`${this.base}/categories`, dto).pipe(unwrap<CategoryNode>()));
  }

  getRateCards(): Promise<any[]> {
    return firstValueFrom(this.http.get(`${this.base}/rate-cards`).pipe(unwrap<any[]>()));
  }
  createRateCard(dto: object): Promise<any> {
    return firstValueFrom(this.http.post(`${this.base}/rate-cards`, dto).pipe(unwrap<any>()));
  }

  importParse(kind: 'partners' | 'products', file: File, mapping: Record<string, string>): Promise<any> {
    const form = new FormData();
    form.append('file', file);
    form.append('mapping', JSON.stringify(mapping));
    return firstValueFrom(this.http.post(`${this.base}/import/${kind}/parse`, form).pipe(unwrap<any>()));
  }
  importCommit(kind: 'partners' | 'products', rows: object[]): Promise<any> {
    return firstValueFrom(this.http.post(`${this.base}/import/${kind}/commit`, { rows }).pipe(unwrap<any>()));
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: 위 test 명령 → PASS

- [ ] **Step 5: 페이지 구현**

패턴: 기존 `features/reports/pages/*` 스타일 — standalone component, Ionic 컴포넌트, signals. 대표 예시(거래처 폼 — 가장 복잡, 보관계약 유형별 조건 필드):

```typescript
// apps/web/src/app/features/master-data/pages/partner-form/partner-form.page.ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { MasterDataService, StorageContractRow } from '../../services/master-data.service';

@Component({
  selector: 'app-partner-form',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/master-data/partners" /></ion-buttons>
      <ion-title>거래처 등록</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item><ion-input label="거래처명 *" [(ngModel)]="name" /></ion-item>
        <ion-item><ion-input label="거래처코드 (비우면 자동채번)" [(ngModel)]="code" /></ion-item>
        <ion-item>
          <ion-input label="사업자등록번호" placeholder="000-00-00000" [(ngModel)]="brn" />
        </ion-item>
        <ion-item><ion-input label="대표자" [(ngModel)]="representativeName" /></ion-item>
        <ion-item><ion-input label="업태" [(ngModel)]="businessType" /></ion-item>
        <ion-item><ion-input label="종목" [(ngModel)]="businessCategory" /></ion-item>
        <ion-item><ion-input label="주소" [(ngModel)]="address" /></ion-item>
        <ion-item><ion-input label="담당자" [(ngModel)]="contactName" /></ion-item>
        <ion-item><ion-input label="연락처" [(ngModel)]="phone" /></ion-item>
        <ion-item><ion-input label="건당 기본 운송요율" type="number" [(ngModel)]="defaultTransportRate" /></ion-item>

        <ion-item>
          <ion-select label="보관료 방식 *" [(ngModel)]="contractType" interface="popover">
            <ion-select-option value="PALLET_DAILY">파렛트 × 일수 단가</ion-select-option>
            <ion-select-option value="AREA_MONTHLY">면적 월임대</ion-select-option>
            <ion-select-option value="AREA_YEARLY">면적 년임대</ion-select-option>
          </ion-select>
        </ion-item>
        @if (contractType === 'PALLET_DAILY') {
          <ion-item><ion-input label="파렛트 1일당 단가 *" type="number" [(ngModel)]="palletDailyRate" /></ion-item>
        } @else {
          <ion-item><ion-input label="계약 면적(평) *" type="number" [(ngModel)]="areaPyeong" /></ion-item>
          <ion-item><ion-input label="평당 단가 *" type="number" [(ngModel)]="areaRate" /></ion-item>
        }
        <ion-item><ion-input label="계약 시작일 *" type="date" [(ngModel)]="startDate" /></ion-item>
      </ion-list>
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      <ion-button expand="block" (click)="save()" [disabled]="saving()">저장</ion-button>
    </ion-content>
  `,
})
export class PartnerFormPage {
  private api = inject(MasterDataService);
  private router = inject(Router);

  name = ''; code = ''; brn = ''; representativeName = ''; businessType = '';
  businessCategory = ''; address = ''; contactName = ''; phone = '';
  defaultTransportRate = '';
  contractType: StorageContractRow['contractType'] = 'PALLET_DAILY';
  palletDailyRate = ''; areaPyeong = ''; areaRate = ''; startDate = '';

  saving = signal(false);
  error = signal('');

  async save() {
    this.error.set('');
    if (!this.name || !this.startDate) { this.error.set('필수 항목을 입력하세요.'); return; }
    if (this.contractType === 'PALLET_DAILY' && !this.palletDailyRate) { this.error.set('파렛트 단가는 필수입니다.'); return; }
    if (this.contractType !== 'PALLET_DAILY' && (!this.areaPyeong || !this.areaRate)) { this.error.set('면적과 단가는 필수입니다.'); return; }
    this.saving.set(true);
    try {
      await this.api.createPartner({
        name: this.name,
        ...(this.code ? { code: this.code } : {}),
        ...(this.brn ? { businessRegistrationNo: this.brn } : {}),
        representativeName: this.representativeName, businessType: this.businessType,
        businessCategory: this.businessCategory, address: this.address,
        contactName: this.contactName, phone: this.phone,
        ...(this.defaultTransportRate ? { defaultTransportRate: this.defaultTransportRate } : {}),
        storageContract: {
          contractType: this.contractType,
          ...(this.contractType === 'PALLET_DAILY'
            ? { palletDailyRate: this.palletDailyRate }
            : { areaPyeong: this.areaPyeong, areaRate: this.areaRate }),
          startDate: this.startDate,
        },
      } as any);
      this.router.navigate(['/master-data/partners']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '저장 실패');
    } finally {
      this.saving.set(false);
    }
  }
}
```

나머지 페이지 — 동일 패턴으로 구현:
- `partner-list.page.ts`: `ion-searchbar` + `ion-list` 목록, 행 클릭 → 수정 폼, `+` FAB → `/master-data/partners/new`.
- `product-form.page.ts`: 품목 필드 + 카테고리 선택(`getCategoryTree()` 결과를 `ion-select` depth 들여쓰기 옵션으로), 거래처 선택, 파렛트 적재 기준(`maxUnitsPerPallet`, `palletThreshold` — placeholder에 "미입력 시 전역 70%").
- `product-list.page.ts`: 거래처 필터 + 검색.
- `category-tree.page.ts`: `findTree` 렌더(재귀 컴포넌트 대신 depth 들여쓰기 flat 리스트), 노드별 추가/이름변경/비활성화 버튼.
- `rate-cards.page.ts`: 목록 + 추가 폼 인라인(차량유형/톤수/컨테이너/특장/단가).
- `master-import.page.ts`: 파일 선택 → 컬럼 매핑(셀렉트: 필드→A~Z) → `importParse` 결과 표시(정상 N건/오류 행 테이블) → `importCommit` 버튼.

routes:

```typescript
// apps/web/src/app/features/master-data/master-data.routes.ts
import { Routes } from '@angular/router';

export const MASTER_DATA_ROUTES: Routes = [
  { path: 'partners', loadComponent: () => import('./pages/partner-list/partner-list.page').then(m => m.PartnerListPage) },
  { path: 'partners/new', loadComponent: () => import('./pages/partner-form/partner-form.page').then(m => m.PartnerFormPage) },
  { path: 'products', loadComponent: () => import('./pages/product-list/product-list.page').then(m => m.ProductListPage) },
  { path: 'products/new', loadComponent: () => import('./pages/product-form/product-form.page').then(m => m.ProductFormPage) },
  { path: 'categories', loadComponent: () => import('./pages/category-tree/category-tree.page').then(m => m.CategoryTreePage) },
  { path: 'rate-cards', loadComponent: () => import('./pages/rate-cards/rate-cards.page').then(m => m.RateCardsPage) },
  { path: 'import', loadComponent: () => import('./pages/master-import/master-import.page').then(m => m.MasterImportPage) },
];
```

`app.routes.ts`에 기존 feature 등록 방식 그대로 `{ path: 'master-data', loadChildren: ... , canActivate: [기존 role guard, HQ_ADMIN] }` 추가 (기존 가드 사용법은 `app.routes.ts` 내 다른 라우트 참조).

- [ ] **Step 6: 빌드·테스트 확인 후 Commit**

Run: `pnpm --filter web test -- --watch=false && pnpm --filter web build`
Expected: PASS + 빌드 성공

```bash
git add apps/web/src/app
git commit -m "feat(web): master data admin screens (partners, products, categories, rates, import)"
```

---

### Task 15: 웹 — warehouse feature (실적 입력 + 엑셀 업로드)

**Files:**
- Create: `apps/web/src/app/features/warehouse/warehouse.routes.ts`
- Create: `apps/web/src/app/features/warehouse/services/warehouse.service.ts`
- Create: `apps/web/src/app/features/warehouse/pages/transaction-entry/transaction-entry.page.ts`
- Create: `apps/web/src/app/features/warehouse/pages/transaction-list/transaction-list.page.ts`
- Create: `apps/web/src/app/features/warehouse/pages/transaction-import/transaction-import.page.ts`
- Test: `apps/web/src/app/features/warehouse/services/warehouse.service.spec.ts`
- Modify: `apps/web/src/app/app.routes.ts`

**Interfaces:**
- Consumes: Task 7, 13 REST. `MasterDataService.getPartners/getProducts` (Task 14 — 선택 드롭다운용).
- Produces: 라우트 `/warehouse/entry`, `/warehouse/list`, `/warehouse/import`. `WarehouseService.createTransaction(dto)`, `getTransactions(q)`, `importParse(file, mapping)`, `importCommit(rows)`.

- [ ] **Step 1: 서비스 테스트 + 구현**

`MasterDataService`와 동일 패턴 — `unwrap` 헬퍼 복제 대신 `core/utils`에 이동 후 공유 (`apps/web/src/app/core/utils/unwrap.ts`로 추출, master-data.service.ts도 리팩터). 테스트는 Task 14 Step 1과 동형 2케이스(목록 unwrap, 생성 POST body).

```typescript
// apps/web/src/app/core/utils/unwrap.ts
import { map } from 'rxjs';
export const unwrap = <T>() => map((res: any) => res.data.data as T);
```

```typescript
// apps/web/src/app/features/warehouse/services/warehouse.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { unwrap } from '../../../core/utils/unwrap';

export interface TransactionRow {
  id: string; type: 'INBOUND' | 'OUTBOUND'; partnerId: string; productId: string;
  quantity: number; transactionDate: string;
  product?: { code: string; name: string };
}

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/warehouse/transactions`;

  createTransaction(dto: Omit<TransactionRow, 'id' | 'product'> & { vehicleRateId?: string }): Promise<TransactionRow> {
    return firstValueFrom(this.http.post(this.base, dto).pipe(unwrap<TransactionRow>()));
  }
  getTransactions(q: Record<string, string | number>): Promise<{ data: TransactionRow[]; totalCount: number }> {
    return firstValueFrom(this.http.get(this.base, { params: q as any }).pipe(unwrap<any>()));
  }
  importParse(file: File, mapping: Record<string, string>): Promise<any> {
    const form = new FormData();
    form.append('file', file);
    form.append('mapping', JSON.stringify(mapping));
    return firstValueFrom(this.http.post(`${this.base}/import/parse`, form).pipe(unwrap<any>()));
  }
  importCommit(rows: object[]): Promise<any> {
    return firstValueFrom(this.http.post(`${this.base}/import/commit`, { rows }).pipe(unwrap<any>()));
  }
}
```

- [ ] **Step 2: 페이지 구현**

- `transaction-entry.page.ts`: 거래처 선택 → 해당 거래처 품목 검색 선택(`getProducts({partnerId})`) → 입/출고 토글(`ion-segment`) → 수량(`type="number"`) → 일자(`type="date"`, 기본 오늘) → 차량 선택(선택 사항, `getRateCards()`) → 저장. 모바일 우선 단일 컬럼. E2002 에러 응답 시 "해당 월은 정산 마감되어 입력 불가" 노출.
- `transaction-list.page.ts`: 날짜 범위 + 거래처 필터, 최근순 목록, 무한 스크롤(`ion-infinite-scroll`).
- `transaction-import.page.ts`: Task 14 `master-import.page.ts`와 동일 3단계 플로우(파일 → 매핑 → 오류/정상 확인 → 확정) — 필드만 실적용(거래처코드/품목코드/구분/수량/일자).

라우트 가드: HQ_ADMIN + WAREHOUSE_STAFF.

- [ ] **Step 3: 빌드·테스트 확인 후 Commit**

Run: `pnpm --filter web test -- --watch=false && pnpm --filter web build` → PASS

```bash
git add apps/web/src/app
git commit -m "feat(web): warehouse transaction entry, list and excel import"
```

---

### Task 16: 웹 — settlement feature (breakdown + 월 정산 + 대시보드)

**Files:**
- Create: `apps/web/src/app/features/settlement-fees/settlement-fees.routes.ts`
- Create: `apps/web/src/app/features/settlement-fees/services/settlement-fees.service.ts`
- Create: `apps/web/src/app/features/settlement-fees/pages/fee-dashboard/fee-dashboard.page.ts`
- Create: `apps/web/src/app/features/settlement-fees/pages/monthly-close/monthly-close.page.ts`
- Create: `apps/web/src/app/features/settlement-fees/pages/breakdown/breakdown.page.ts`
- Create: `apps/web/src/app/features/settlement-fees/pages/statement/statement.page.ts`
- Test: `apps/web/src/app/features/settlement-fees/services/settlement-fees.service.spec.ts`
- Modify: `apps/web/src/app/app.routes.ts`

**Interfaces:**
- Consumes: Task 11, 13 REST.
- Produces: 라우트 `/settlement-fees`(대시보드), `/settlement-fees/close`, `/settlement-fees/breakdown/:transactionId`, `/settlement-fees/statement`. `SettlementFeesService.preview(yearMonth)`, `close(yearMonth)`, `getBreakdown(transactionId)`, `getStatement(partnerId, yearMonth)`, `downloadStatement(partnerId, yearMonth): void`(blob 다운로드).

- [ ] **Step 1: 서비스 테스트 + 구현** — Task 15와 동형(unwrap 재사용). `downloadStatement`는 `this.http.get(url, { responseType: 'blob' })` → `URL.createObjectURL` + a[download] 클릭.

- [ ] **Step 2: 페이지 구현**

- `monthly-close.page.ts`: 월 선택(`ion-datetime` presentation="month-year") → [미리보기] → 거래처별 운송료/보관료 합계 테이블 + **오류 목록**(E4108 요율 누락 건: 품목·거래처 링크) → 오류 0건일 때만 [마감 실행] 활성화 → 완료 후 거래처별 정산서 링크.
- `breakdown.page.ts`: `calculationDetail` 렌더 — 운송 건: 적용 요율·출처(품목/거래처기본/차량)·계산식. 보관 건: 파렛트일수 상세(품목별 palletDays, threshold, skippedProducts 경고) 또는 면적 계산식. JSON 그대로 노출하지 말고 라벨 매핑.
- `statement.page.ts`: 거래처+월 선택 → `getStatement` 렌더(운송료 건별 테이블 + 보관료 + 총계) → [엑셀 다운로드].
- `fee-dashboard.page.ts`: 오늘/이번 달 누적 운송료·보관료 카드(preview API 재사용 — 현재 월), 요율 누락 건수 경고 배지, 거래처별 상위 5 물량.

라우트 가드: HQ_ADMIN.

- [ ] **Step 3: 빌드·테스트 확인 후 Commit**

Run: `pnpm --filter web test -- --watch=false && pnpm --filter web build` → PASS

```bash
git add apps/web/src/app
git commit -m "feat(web): settlement dashboard, monthly close, breakdown and statement"
```

---

### Task 17: 웹 — 거래처 포털 + 격리 e2e

**Files:**
- Create: `apps/web/src/app/features/partner-portal/partner-portal.routes.ts`
- Create: `apps/web/src/app/features/partner-portal/pages/portal-home/portal-home.page.ts`
- Create: `apps/web/src/app/features/partner-portal/pages/my-transactions/my-transactions.page.ts`
- Create: `apps/web/src/app/features/partner-portal/pages/my-statement/my-statement.page.ts`
- Test: `e2e/partner-isolation.spec.ts` (기존 e2e 디렉터리 패턴 준수 — Playwright)
- Modify: `apps/web/src/app/app.routes.ts`

**Interfaces:**
- Consumes: Task 7 `GET /warehouse/transactions`(스코프 자동), Task 11 statement/breakdown, Task 13 다운로드. Task 15 `WarehouseService`, Task 16 `SettlementFeesService` 재사용 — 신규 API 서비스 불필요.
- Produces: 라우트 `/portal`(PARTNER_COORDINATOR 가드): 홈(이번 달 요약), 내 물량(출고명세서 다운로드 버튼 포함), 내 정산서(월 선택 + breakdown 링크 + 다운로드).

- [ ] **Step 1: 페이지 구현**

- `portal-home.page.ts`: 이번 달 자사 출고 건수·정산 총액 카드(`getStatement(자기 partnerId, 현재 월)` — partnerId는 로그인 유저 정보에서, 기존 auth 상태 저장소 참조). 정산서·물량 화면 링크.
- `my-transactions.page.ts`: Task 15 `transaction-list.page.ts`와 동일 목록(거래처 필터 UI 제거 — 서버가 스코프 강제) + [출고명세서 엑셀] 다운로드(기간 선택).
- `my-statement.page.ts`: 월 선택 → statement 렌더 + [정산서 다운로드] + 건별 breakdown 이동.

- [ ] **Step 2: 격리 e2e 작성**

```typescript
// e2e/partner-isolation.spec.ts
import { test, expect } from '@playwright/test';

// 전제: 시드 데이터에 거래처 A/B, 각 소속 PARTNER_COORDINATOR 계정 존재
// (기존 e2e 시드 방식 확인 후 동일 방식으로 partner 계정 시드 추가)

test('partner sees only own transactions', async ({ request }) => {
  const loginA = await request.post('/api/v1/auth/login', {
    data: { email: 'partner-a@test.com', password: 'test1234' },
  });
  const tokenA = (await loginA.json()).data.data.accessToken;

  const res = await request.get('/api/v1/warehouse/transactions?partnerId=PARTNER_B_ID', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const body = (await res.json()).data.data;
  // partnerId 쿼리를 타사로 줘도 자사 데이터만 반환
  for (const tx of body.data) expect(tx.partnerId).not.toBe('PARTNER_B_ID');
});

test('partner statement for other partner returns 403', async ({ request }) => {
  const loginA = await request.post('/api/v1/auth/login', {
    data: { email: 'partner-a@test.com', password: 'test1234' },
  });
  const tokenA = (await loginA.json()).data.data.accessToken;

  const res = await request.get('/api/v1/settlement-fees/statement?partnerId=PARTNER_B_ID&yearMonth=2026-07', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  expect(res.status()).toBe(403);
});
```

주의: 로그인 엔드포인트·응답 형태·시드 계정은 기존 e2e 스펙(`e2e/` 기존 파일) 확인 후 실제 형태에 맞출 것.

- [ ] **Step 3: 전체 검증 후 Commit**

Run: `pnpm --filter web build && pnpm --filter api test && pnpm --filter web test -- --watch=false`
e2e는 로컬 환경 기동 후: `docker compose up -d && pnpm api:dev &` 상태에서 playwright 실행 (기존 e2e 실행 스크립트 참조).

```bash
git add apps/web/src/app e2e
git commit -m "feat(web): partner portal with data isolation e2e"
```

---

## 실행 순서·의존성 요약

```
Task 1 (스키마)
 ├─ Task 2 (BRN 검증) ─ Task 3 (Partner) ─┐
 ├─ Task 4 (Category) ─┬─ Task 5 (Product) ─┼─ Task 12 (마스터 import)
 ├─ Task 6 (Rates/Setting) ─┐              │
 └─ Task 7 (Warehouse Tx) ──┼─ Task 13 (실적 import/export)
    Task 8 (Pallet) ─ Task 10 (Storage fee) ─┤
    Task 9 (Transport fee) ──────────────────┴─ Task 11 (마감)
웹: Task 14 (master-data) → Task 15 (warehouse) → Task 16 (settlement) → Task 17 (portal)
```

Task 2·4·6·8·9는 상호 독립 — 병렬 실행 가능.

## 계획 외 확인 사항 (실행 중 발견 시 스펙 §10 참조)

- `JwtPayload.partnerId` 부재 시 auth 모듈 확장 (Task 7 주의사항).
- `SettlementPeriod` 복합 unique 부재 시 Task 1에서 추가 (Task 11 주의사항).
- 실제 엑셀 파일 확보 시: Task 12 매핑 기본값을 실제 컬럼에 맞춰 프리셋 추가.
