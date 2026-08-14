import { BadRequestException } from '@nestjs/common';
import { SettlementInvoiceService } from './settlement-invoice.service';

describe('SettlementInvoiceService', () => {
  const prisma = {
    settlementInvoice: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new SettlementInvoiceService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('moves a draft invoice to issued and records the issuer', async () => {
    // Given
    prisma.settlementInvoice.findUnique.mockResolvedValue({ id: 'invoice-1', status: 'DRAFT' });
    prisma.settlementInvoice.update.mockImplementation(({ data }) => Promise.resolve(data));

    // When
    const result = await service.changeStatus('invoice-1', 'ISSUED', 'user-1');

    // Then
    expect(result).toMatchObject({ status: 'ISSUED', issuedBy: 'user-1' });
  });

  it('rejects paid before issued', async () => {
    // Given
    prisma.settlementInvoice.findUnique.mockResolvedValue({ id: 'invoice-1', status: 'DRAFT' });

    // When / Then
    await expect(service.changeStatus('invoice-1', 'PAID', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
