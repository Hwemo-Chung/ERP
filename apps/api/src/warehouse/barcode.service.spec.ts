import { NotFoundException } from '@nestjs/common';
import { BarcodeService } from './barcode.service';

describe('BarcodeService', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    partner: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const service = new BarcodeService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('resolves an exact product code before trying a partner code', async () => {
    // Given
    prisma.product.findUnique.mockResolvedValue({ id: 'product-1', code: 'SAME' });

    // When
    const result = await service.resolve('SAME', 'user-1');

    // Then
    expect(result.type).toBe('PRODUCT');
    expect(prisma.partner.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'BARCODE_SCAN_MATCH' }) }),
    );
  });

  it('rejects an unregistered barcode', async () => {
    // Given
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.partner.findUnique.mockResolvedValue(null);

    // When / Then
    await expect(service.resolve('UNKNOWN', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'BARCODE_SCAN_MISS' }) }),
    );
  });
});
