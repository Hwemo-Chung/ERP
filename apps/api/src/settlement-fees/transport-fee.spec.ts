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
