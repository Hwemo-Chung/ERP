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

  describe('REPLACE mode explicit (unchanged behavior)', () => {
    it('matches default behavior when mode passed explicitly', () => {
      const r = calcTransportFee({ productRate: '5000', partnerDefaultRate: '3000', vehicleRate: '120000' }, 'REPLACE');
      expect(r.amount).toBe('120000');
      expect(r.detail.vehicleRateMode).toBe('REPLACE');
    });
  });

  describe('ADD mode', () => {
    it('sums vehicle rate and product rate when both present', () => {
      const r = calcTransportFee({ productRate: '5000', partnerDefaultRate: '3000', vehicleRate: '120000' }, 'ADD');
      expect(r.amount).toBe('125000');
      expect(r.detail.rateSource).toBe('VEHICLE');
      expect(r.detail.vehicleRateMode).toBe('ADD');
      expect(r.detail.baseRate).toBe('5000');
      expect(r.detail.vehicleRate).toBe('120000');
    });

    it('sums vehicle rate and partner default rate when no product rate', () => {
      const r = calcTransportFee({ productRate: null, partnerDefaultRate: '3000', vehicleRate: '120000' }, 'ADD');
      expect(r.amount).toBe('123000');
      expect(r.detail.baseRate).toBe('3000');
    });

    it('uses vehicle rate alone when neither product nor partner default present', () => {
      const r = calcTransportFee({ productRate: null, partnerDefaultRate: null, vehicleRate: '120000' }, 'ADD');
      expect(r.amount).toBe('120000');
      expect(r.detail.baseRate).toBe('0');
    });

    it('falls back to REPLACE chain when no vehicle rate present', () => {
      const r = calcTransportFee({ productRate: '5000', partnerDefaultRate: '3000', vehicleRate: null }, 'ADD');
      expect(r.amount).toBe('5000');
      expect(r.detail.rateSource).toBe('PRODUCT');
      expect(r.detail.vehicleRateMode).toBe('ADD');
    });

    it('still throws E4108 when nothing at all is configured', () => {
      expect(() => calcTransportFee({ productRate: null, partnerDefaultRate: null, vehicleRate: null }, 'ADD')).toThrow('E4108');
    });
  });
});
