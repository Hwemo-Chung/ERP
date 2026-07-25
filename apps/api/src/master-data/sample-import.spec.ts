import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { ExcelImportService } from './excel-import.service';
import { PartnersService } from './partners.service';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';
import { TransactionImportService } from '../warehouse/transaction-import.service';
import { TransactionsService } from '../warehouse/transactions.service';
import { PrismaService } from '../prisma/prisma.service';

// 이관 리허설용 커밋 샘플 (docs/samples/*.xlsx, scripts/generate-sample-excel.mjs로 생성).
// __dirname → apps/api/src/master-data, repo root까지 4단계 위.
const SAMPLES_DIR = path.resolve(__dirname, '../../../../docs/samples');

function readSample(name: string): Buffer {
  const file = path.join(SAMPLES_DIR, name);
  if (!fs.existsSync(file)) {
    throw new Error(`sample file missing: ${file} — run \`node scripts/generate-sample-excel.mjs\` first`);
  }
  return fs.readFileSync(file);
}

// 거래처 매핑: 필드명 → CreatePartnerDto 필드와 동일 (excel-import.service.commitPartners가
// validRows를 그대로 partners.create()에 스프레드하므로).
const PARTNER_MAPPING = {
  code: 'A', name: 'B', businessRegistrationNo: 'C', representativeName: 'D',
  businessType: 'E', businessCategory: 'F', address: 'G', contactName: 'H',
  phone: 'I', defaultTransportRate: 'J',
};
const PRODUCT_MAPPING = {
  code: 'A', name: 'B', categoryName: 'C', unitPrice: 'D', costPrice: 'E',
  transportRate: 'F', palletThreshold: 'G', maxUnitsPerPallet: 'H',
};
const TX_MAPPING = { partnerCode: 'A', productCode: 'B', type: 'C', quantity: 'D', transactionDate: 'E' };

describe('sample excel data (docs/samples) — 이관 리허설', () => {
  describe('partners-sample.xlsx', () => {
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

    it('parses 10 rows → 8 valid, 2 invalid (bad checksum, missing name)', async () => {
      const buf = readSample('partners-sample.xlsx');
      const r = await service.parsePartners(buf, PARTNER_MAPPING);
      expect(r.validRows).toHaveLength(8);
      expect(r.invalidRows).toHaveLength(2);
      expect(r.invalidRows.find((row: any) => row.raw.code === 'KM003')?.errors).toContain('사업자등록번호 체크섬 오류');
      expect(r.invalidRows.find((row: any) => row.raw.code === 'KM007')?.errors).toContain('업체명 누락');
    });

    it('commitPartners creates exactly the 8 valid rows', async () => {
      const buf = readSample('partners-sample.xlsx');
      const { validRows } = await service.parsePartners(buf, PARTNER_MAPPING);
      partnersMock.create.mockResolvedValue({ id: 'x' });
      const result = await service.commitPartners(validRows, {
        contractType: 'PALLET_DAILY', palletDailyRate: '1000', startDate: '2026-07-01',
      });
      expect(result.created).toBe(8);
      expect(result.failed).toHaveLength(0);
      expect(partnersMock.create).toHaveBeenCalledTimes(8);
    });
  });

  describe('products-sample.xlsx', () => {
    let service: ExcelImportService;
    const partnersMock = { create: jest.fn() };
    const productsMock = { create: jest.fn() };
    const categoriesMock = { create: jest.fn(), findTree: jest.fn().mockResolvedValue([]) };

    beforeEach(async () => {
      jest.clearAllMocks();
      categoriesMock.findTree.mockResolvedValue([]);
      categoriesMock.create.mockImplementation(async (dto: { name: string }) => ({ id: `cat-${dto.name}`, ...dto }));
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

    it('parses 20 rows → 18 valid, 2 invalid (blank 상품명, blank 분류)', async () => {
      const buf = readSample('products-sample.xlsx');
      const r = await service.parseProducts(buf, PRODUCT_MAPPING);
      expect(r.validRows).toHaveLength(18);
      expect(r.invalidRows).toHaveLength(2);
      expect(r.invalidRows.find((row: any) => row.raw.code === 'I-00005')?.errors).toContain('상품명 누락');
      expect(r.invalidRows.find((row: any) => row.raw.code === 'I-00015')?.errors).toContain('categoryName 누락');
    });

    it('commitProducts creates exactly the 18 valid rows', async () => {
      const buf = readSample('products-sample.xlsx');
      const { validRows } = await service.parseProducts(buf, PRODUCT_MAPPING);
      productsMock.create.mockResolvedValue({ id: 'x' });
      const result = await service.commitProducts(validRows, 'partner-1');
      expect(result.created).toBe(18);
      expect(result.failed).toHaveLength(0);
      expect(productsMock.create).toHaveBeenCalledTimes(18);
    });
  });

  describe('transactions-sample.xlsx', () => {
    let service: TransactionImportService;
    // 8 valid partner codes + 18 valid product codes from partners/products-sample.xlsx —
    // matches PRODUCT_OWNER assignment in scripts/generate-sample-excel.mjs exactly (product
    // I belongs to VALID_PARTNER_CODES[i % 8]).
    const partners = [
      'KM001', 'KM002', 'KM004', 'KM005', 'KM006', 'KM008', 'KM009', 'KM010',
    ].map((code) => ({ id: code, code }));
    const productOwner: Record<string, string> = {
      'I-00001': 'KM001', 'I-00002': 'KM002', 'I-00003': 'KM004', 'I-00004': 'KM005',
      'I-00006': 'KM008', 'I-00007': 'KM009', 'I-00008': 'KM010', 'I-00009': 'KM001',
      'I-00010': 'KM002', 'I-00011': 'KM004', 'I-00012': 'KM005', 'I-00013': 'KM006',
      'I-00014': 'KM008', 'I-00016': 'KM010', 'I-00017': 'KM001', 'I-00018': 'KM002',
      'I-00019': 'KM004', 'I-00020': 'KM005',
    };
    const products = Object.entries(productOwner).map(([code, partnerCode]) => ({
      id: code, code, partnerId: partnerCode,
    }));

    const prismaMock = {
      partner: { findMany: jest.fn().mockResolvedValue(partners) },
      product: { findMany: jest.fn().mockResolvedValue(products) },
    };
    const txServiceMock = { create: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      prismaMock.partner.findMany.mockResolvedValue(partners);
      prismaMock.product.findMany.mockResolvedValue(products);
      const module = await Test.createTestingModule({
        providers: [
          TransactionImportService,
          { provide: TransactionsService, useValue: txServiceMock },
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();
      service = module.get(TransactionImportService);
    });

    it('parses 30 rows → 28 valid, 2 invalid (unknown code, zero quantity)', async () => {
      const buf = readSample('transactions-sample.xlsx');
      const r = await service.parse(buf, TX_MAPPING);
      expect(r.validRows).toHaveLength(28);
      expect(r.invalidRows).toHaveLength(2);
      expect(r.invalidRows.some((row: any) => row.errors.some((e: string) => e.includes('거래처 코드 없음: KM999')))).toBe(true);
      expect(r.invalidRows.some((row: any) => row.errors.some((e: string) => e.includes('수량 오류: 0')))).toBe(true);
    });

    it('commit persists the 28 valid rows with EXCEL source', async () => {
      const buf = readSample('transactions-sample.xlsx');
      const { validRows } = await service.parse(buf, TX_MAPPING);
      txServiceMock.create.mockResolvedValue({});
      const result = await service.commit(validRows, 'u1');
      expect(result.created).toBe(28);
      expect(result.failed).toHaveLength(0);
      expect(txServiceMock.create).toHaveBeenCalledTimes(28);
      expect(txServiceMock.create).toHaveBeenCalledWith(expect.anything(), 'u1', 'EXCEL');
    });
  });
});
