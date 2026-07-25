import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementFeesService } from './settlement-fees.service';
import { TransportFeeDetail } from './transport-fee';
import { PalletDailyDetail, AreaFeeDetail } from './storage-fee';

@Injectable()
export class StatementExportService {
  constructor(
    private readonly settlementFees: SettlementFeesService,
    private readonly prisma: PrismaService,
  ) {}

  /** 정산서: 운송료 건별 시트 + 보관료 시트 + 합계. scope는 getStatement로 그대로 전달해 E4110 fail-closed 유지. */
  async buildStatementXlsx(
    partnerId: string,
    yearMonth: string,
    scope: { partnerId?: string } = {},
  ): Promise<Buffer> {
    const statement = await this.settlementFees.getStatement(partnerId, yearMonth, scope);
    const wb = new ExcelJS.Workbook();

    const transportSheet = wb.addWorksheet('운송료');
    transportSheet.addRow(['일자', '품목코드', '품목명', '수량', '적용요율출처', '금액']);
    for (const r of statement.transport.records) {
      const detail = r.calculationDetail as unknown as TransportFeeDetail;
      const tx = r.transaction;
      transportSheet.addRow([
        tx?.transactionDate ? new Date(tx.transactionDate).toISOString().slice(0, 10) : '',
        tx?.product?.code ?? '',
        tx?.product?.name ?? '',
        tx?.quantity ?? '',
        detail?.rateSource ?? '',
        r.amount.toString(),
      ]);
    }

    const storageSheet = wb.addWorksheet('보관료');
    storageSheet.addRow(['계약유형', '수량(파렛트일/면적)', '단가', '금액', '산식']);
    for (const r of statement.storage.records) {
      const detail = r.calculationDetail as unknown as PalletDailyDetail | AreaFeeDetail;
      const qty = detail.contractType === 'PALLET_DAILY' ? detail.totalPalletDays : detail.areaPyeong;
      const rate = detail.contractType === 'PALLET_DAILY' ? detail.palletDailyRate : detail.areaRate;
      storageSheet.addRow([detail.contractType, qty, rate, r.amount.toString(), detail.formula]);
    }

    const summarySheet = wb.addWorksheet('합계');
    summarySheet.addRow(['구분', '건수', '금액']);
    summarySheet.addRow(['운송료', statement.transport.count, statement.transport.total]);
    summarySheet.addRow(['보관료', statement.storage.records.length, statement.storage.total]);
    summarySheet.addRow(['합계', '', statement.grandTotal]);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * 출고명세서: 출고 건 목록. TransactionsService.findAll을 거치지 않고 prisma를 직접 조회한다 —
   * WarehouseModule의 TransactionsController가 이 서비스를(shipment-list/download 라우트) 가져다 쓰므로,
   * 여기서 TransactionsService를 다시 의존하면 WarehouseModule ↔ SettlementFeesModule 순환 참조가 생긴다.
   * findAll의 200건 페이지 캡도 우회해 전체 내보내기가 잘리지 않도록 한다(reports.service.ts와 동일하게
   * export 경로는 prisma 직접 조회가 기존 관례).
   */
  async buildShipmentListXlsx(partnerId: string, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.prisma.warehouseTransaction.findMany({
      where: {
        type: 'OUTBOUND',
        partnerId,
        ...(dateFrom || dateTo
          ? {
              transactionDate: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { transactionDate: 'asc' },
      include: { product: { select: { code: true, name: true } } },
    });

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('출고명세서');
    sheet.addRow(['일자', '품목코드', '품목명', '수량']);
    for (const t of rows) {
      sheet.addRow([t.transactionDate.toISOString().slice(0, 10), t.product.code, t.product.name, t.quantity]);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
