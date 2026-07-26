import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { validateBusinessRegistrationNo } from '../common/business-registration';
import { PartnersService } from './partners.service';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';
import { StorageContractDto } from './dto/create-partner.dto';

export interface InvalidRow {
  rowIndex: number;
  errors: string[];
  raw: object;
}

export interface ParseResult {
  validRows: object[];
  invalidRows: InvalidRow[];
  extractedCategories: string[];
}

export interface CommitResult {
  created: number;
  failed: { row: object; error: string }[];
}

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

  async parsePartners(buffer: Buffer, mapping: Record<string, string>): Promise<ParseResult> {
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
    return { validRows, invalidRows, extractedCategories: [] };
  }

  async parseProducts(buffer: Buffer, mapping: Record<string, string>): Promise<ParseResult> {
    const rows = await this.readRows(buffer, mapping);
    const validRows: object[] = [];
    const invalidRows: InvalidRow[] = [];
    const categorySet = new Set<string>();
    for (const { rowIndex, raw } of rows) {
      const errors: string[] = [];
      if (!raw.name) errors.push('상품명 누락');
      if (!raw.categoryName) errors.push('categoryName 누락');
      else categorySet.add(raw.categoryName);
      // 단가/원가는 필수 — 값이 없거나(blank) 숫자가 아니면 거부 (falsy만 통과시키던 이전 버전은
      // Number('') === 0이라 blank 셀이 조용히 통과했다).
      if (!raw.unitPrice || isNaN(Number(raw.unitPrice))) errors.push('단가 숫자 아님');
      if (!raw.costPrice || isNaN(Number(raw.costPrice))) errors.push('원가 숫자 아님');
      if (errors.length) invalidRows.push({ rowIndex, errors, raw });
      else validRows.push(raw);
    }
    return { validRows, invalidRows, extractedCategories: [...categorySet] };
  }

  /**
   * 정상 행만 반영. 실패 행은 결과에 수집해 반환 (부분 성공 허용 — 업로드 화면에서 선택).
   * 엑셀 행에는 보관 계약 정보가 없으므로, 업로드 화면에서 배치 단위로 한 번 입력받은
   * defaultStorageContract를 모든 생성 파트너에 동일 적용한다.
   */
  async commitPartners(validRows: any[], defaultStorageContract: StorageContractDto): Promise<CommitResult> {
    const results: CommitResult = { created: 0, failed: [] };
    for (const row of validRows) {
      try {
        await this.partners.create({ ...row, storageContract: defaultStorageContract });
        results.created++;
      } catch (e: any) {
        results.failed.push({ row, error: e.message });
      }
    }
    return results;
  }

  /**
   * 정상 행만 반영. products.partnerId는 DB에서 NOT NULL이지만 엑셀 행은 파트너 UUID를
   * 담지 않으므로 (commitPartners의 defaultStorageContract와 동일 정책), 업로드 화면에서
   * 배치 단위로 한 번 선택한 defaultPartnerId를 모든 생성 상품에 동일 적용한다.
   */
  async commitProducts(validRows: any[], defaultPartnerId: string): Promise<CommitResult> {
    // 카테고리 이름 → id 매핑 (없으면 depth1으로 생성)
    const tree = await this.categories.findTree();
    const nameToId = new Map<string, string>();
    const walk = (nodes: any[]) =>
      nodes.forEach((n) => {
        nameToId.set(n.name, n.id);
        walk(n.children ?? []);
      });
    walk(tree);

    const results: CommitResult = { created: 0, failed: [] };
    for (const row of validRows) {
      try {
        let categoryId = nameToId.get(row.categoryName);
        if (!categoryId) {
          const created = await this.categories.create({ name: row.categoryName });
          categoryId = created.id;
          nameToId.set(row.categoryName, categoryId);
        }
        // ponytail: explicit whitelist, not a spread — this is a service-to-service call so
        // CreateProductDto's class-validator whitelist never runs; a bare `...row` spread
        // would let a posted row set unrelated Product columns (e.g. isActive, id).
        const { code, name, unitPrice, costPrice, transportRate, palletThreshold, maxUnitsPerPallet } = row;

        // readRows() stringifies every cell, so maxUnitsPerPallet arrives as e.g. "12" — Prisma's
        // Int? column does not coerce String, it would reject the whole row. Coerce here instead
        // of silently forwarding a bad value; an invalid cell becomes a row error (caught below),
        // not a silent skip.
        let maxUnitsPerPalletNum: number | undefined;
        if (maxUnitsPerPallet !== undefined && maxUnitsPerPallet !== '') {
          maxUnitsPerPalletNum = Number(maxUnitsPerPallet);
          if (!Number.isInteger(maxUnitsPerPalletNum) || maxUnitsPerPalletNum < 1) {
            throw new Error('maxUnitsPerPallet 숫자 아님 (1 이상 정수 필요)');
          }
        }

        await this.products.create({
          code,
          name,
          unitPrice,
          costPrice,
          transportRate: transportRate === '' ? undefined : transportRate,
          palletThreshold: palletThreshold === '' ? undefined : palletThreshold,
          maxUnitsPerPallet: maxUnitsPerPalletNum,
          categoryId,
          partnerId: defaultPartnerId,
        });
        results.created++;
      } catch (e: any) {
        results.failed.push({ row, error: e.message });
      }
    }
    return results;
  }
}
