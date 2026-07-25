import * as ExcelJS from 'exceljs';
import { Test } from '@nestjs/testing';
import { ExcelImportService } from './excel-import.service';
import { PartnersService } from './partners.service';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';

async function buildXlsx(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  rows.forEach((r) => ws.addRow(r));
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

  describe('parsePartners', () => {
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
  });

  describe('parseProducts', () => {
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

    it('flags non-numeric unitPrice/costPrice', async () => {
      const buf = await buildXlsx([
        ['품목코드', '상품명', '단가', '원가'],
        ['A1', '냉장고', 'abc', '100'],
      ]);
      const r = await service.parseProducts(buf, { code: 'A', name: 'B', unitPrice: 'C', costPrice: 'D' });
      expect(r.validRows).toHaveLength(0);
      expect(r.invalidRows[0].errors).toContain('단가 숫자 아님');
    });
  });

  describe('commitPartners', () => {
    const defaultStorageContract = {
      contractType: 'PALLET_DAILY' as const,
      palletDailyRate: '1500',
      startDate: '2026-07-01',
    };

    it('applies the batch-level defaultStorageContract to every created partner', async () => {
      partnersMock.create.mockResolvedValue({ id: 'p1' });
      const rows = [{ code: 'KM001', name: '테스트상사' }];
      const results = await service.commitPartners(rows, defaultStorageContract);
      expect(results.created).toBe(1);
      expect(partnersMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ ...rows[0], storageContract: defaultStorageContract }),
      );
    });

    it('collects row-level failures (e.g. E4103 from an incomplete contract) without aborting the batch', async () => {
      partnersMock.create
        .mockRejectedValueOnce({ message: 'palletDailyRate required for PALLET_DAILY contract' })
        .mockResolvedValueOnce({ id: 'p2' });
      const rows = [{ code: 'KM001', name: 'A' }, { code: 'KM002', name: 'B' }];
      const results = await service.commitPartners(rows, defaultStorageContract);
      expect(results.created).toBe(1);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].error).toMatch(/palletDailyRate/);
    });
  });

  describe('commitProducts', () => {
    const defaultPartnerId = 'partner-1';

    it('reuses an existing category id from the tree instead of recreating it, and applies defaultPartnerId', async () => {
      categoriesMock.findTree.mockResolvedValue([{ id: 'cat-1', name: '대형가전', children: [] }]);
      productsMock.create.mockResolvedValue({ id: 'prod-1' });
      const rows = [{ code: 'A1', name: '냉장고', categoryName: '대형가전' }];
      const results = await service.commitProducts(rows, defaultPartnerId);
      expect(results.created).toBe(1);
      expect(categoriesMock.create).not.toHaveBeenCalled();
      expect(productsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'A1', name: '냉장고', categoryId: 'cat-1', partnerId: defaultPartnerId }),
      );
    });

    it('creates a new depth-1 category when the name is not found in the tree', async () => {
      categoriesMock.findTree.mockResolvedValue([]);
      categoriesMock.create.mockResolvedValue({ id: 'cat-new' });
      productsMock.create.mockResolvedValue({ id: 'prod-1' });
      const rows = [{ code: 'A2', name: '세탁기', categoryName: '대형가전' }];
      const results = await service.commitProducts(rows, defaultPartnerId);
      expect(results.created).toBe(1);
      expect(categoriesMock.create).toHaveBeenCalledWith({ name: '대형가전' });
      expect(productsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-new', partnerId: defaultPartnerId }),
      );
    });

    it('collects row-level failures without aborting the batch', async () => {
      categoriesMock.findTree.mockResolvedValue([{ id: 'cat-1', name: '대형가전', children: [] }]);
      productsMock.create.mockRejectedValueOnce({ message: 'duplicate product code' });
      const rows = [{ code: 'A1', name: '냉장고', categoryName: '대형가전' }];
      const results = await service.commitProducts(rows, defaultPartnerId);
      expect(results.created).toBe(0);
      expect(results.failed[0].error).toBe('duplicate product code');
    });
  });
});
