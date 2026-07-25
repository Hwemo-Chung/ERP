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
