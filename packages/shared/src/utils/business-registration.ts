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
