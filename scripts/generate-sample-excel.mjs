// scripts/generate-sample-excel.mjs
// Generates docs/samples/{partners,products,transactions}-sample.xlsx for the 이관 리허설
// (migration rehearsal) manual QA flow, and for apps/api/src/master-data/sample-import.spec.ts.
//
// Run: node scripts/generate-sample-excel.mjs
//
// ponytail: exceljs is a dependency of apps/api, not the repo root — resolve it from
// apps/api/node_modules via createRequire instead of adding it as a root devDependency
// for a one-off generator script.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ExcelJS = require(require.resolve('exceljs', { paths: [path.join(__dirname, '../apps/api')] }));

const OUT_DIR = path.join(__dirname, '../docs/samples');

// --- BRN checksum: copy of packages/shared/src/utils/business-registration.ts ---
// (that file is TS and this script runs as plain Node/mjs, so it can't be imported directly;
// keep this WEIGHTS array in sync with the source of truth if the algorithm ever changes.)
const BRN_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5];
function brnCheckDigit(nineDigits) {
  const nums = nineDigits.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * BRN_WEIGHTS[i];
  sum += Math.floor((nums[8] * 5) / 10);
  return (10 - (sum % 10)) % 10;
}
function validBrn(prefix9) {
  return `${prefix9}${brnCheckDigit(prefix9)}`;
}
function formatBrn(digits10) {
  return `${digits10.slice(0, 3)}-${digits10.slice(3, 5)}-${digits10.slice(5)}`;
}

async function writeWorkbook(fileName, header, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(header);
  for (const row of rows) ws.addRow(row);
  await wb.xlsx.writeFile(path.join(OUT_DIR, fileName));
  console.log(`wrote ${fileName} (${rows.length} rows)`);
}

// ============================================
// 1. partners-sample.xlsx — 10 업체, 2 invalid
// ============================================
const PARTNER_CODES = Array.from({ length: 10 }, (_, i) => `KM${String(i + 1).padStart(3, '0')}`);
// row indices (1-based within data rows) that are deliberately invalid:
const BAD_BRN_ROW = 3; // KM003 — checksum broken on purpose
const MISSING_NAME_ROW = 7; // KM007 — blank 업체명
const VALID_PARTNER_CODES = PARTNER_CODES.filter((_, i) => i + 1 !== BAD_BRN_ROW && i + 1 !== MISSING_NAME_ROW);

const partnerRows = PARTNER_CODES.map((code, i) => {
  const idx = i + 1;
  const brnPrefix = String(120810000 + idx).padStart(9, '0');
  const correctDigits = validBrn(brnPrefix); // 10 digits, valid checksum
  const digits = idx === BAD_BRN_ROW
    ? correctDigits.slice(0, 9) + String((Number(correctDigits.slice(9)) + 1) % 10) // break the check digit on purpose
    : correctDigits;
  const brn = formatBrn(digits);
  const name = idx === MISSING_NAME_ROW ? '' : `${code} 물류상사`;
  return [
    code,
    name,
    brn,
    `대표${idx}`,
    '도소매업',
    '가전유통',
    `서울특별시 강남구 테헤란로 ${idx}`,
    `담당자${idx}`,
    `010-1000-${String(1000 + idx).slice(-4)}`,
    String(3000 + idx * 100),
  ];
});

// ============================================
// 2. products-sample.xlsx — 20 품목, 2 invalid
// ============================================
const CATEGORIES = ['대형가전', '소형가전', '가구'];
const PRODUCT_CODES = Array.from({ length: 20 }, (_, i) => `I-${String(i + 1).padStart(5, '0')}`);
const BLANK_NAME_ROW = 5; // I-00005
const BLANK_CATEGORY_ROW = 15; // I-00015
const VALID_PRODUCT_CODES = PRODUCT_CODES.filter((_, i) => i + 1 !== BLANK_NAME_ROW && i + 1 !== BLANK_CATEGORY_ROW);
// each product's owning partner (for the transactions sample / import test fixture only —
// the products excel template itself has no partnerCode column; partner is chosen once per
// commit batch via defaultPartnerId, per ExcelImportService.commitProducts).
const PRODUCT_OWNER = new Map(
  PRODUCT_CODES.map((code, i) => [code, VALID_PARTNER_CODES[i % VALID_PARTNER_CODES.length]]),
);

const productRows = PRODUCT_CODES.map((code, i) => {
  const idx = i + 1;
  const name = idx === BLANK_NAME_ROW ? '' : `${code} 상품`;
  const category = idx === BLANK_CATEGORY_ROW ? '' : CATEGORIES[i % CATEGORIES.length];
  return [
    code,
    name,
    category,
    String(50000 + idx * 1000),
    String(30000 + idx * 800),
    String(5000 + idx * 50),
    '70',
    String(10 + idx),
  ];
});

// ============================================
// 3. transactions-sample.xlsx — 30 실적, 2 invalid
// ============================================
const UNKNOWN_CODE_ROW = 10;
const ZERO_QTY_ROW = 20;

const txRows = [];
for (let idx = 1; idx <= 30; idx++) {
  const day = String(((idx - 1) % 28) + 1).padStart(2, '0');
  const date = `2026-07-${day}`;
  const type = idx % 2 === 0 ? '출고' : '입고';

  if (idx === UNKNOWN_CODE_ROW) {
    // partner code that was never registered — simulates a row referencing a partner that
    // failed to import (e.g. KM007's missing-name row was rejected upstream)
    txRows.push(['KM999', VALID_PRODUCT_CODES[0], type, 5, date]);
    continue;
  }
  if (idx === ZERO_QTY_ROW) {
    const productCode = VALID_PRODUCT_CODES[idx % VALID_PRODUCT_CODES.length];
    txRows.push([PRODUCT_OWNER.get(productCode), productCode, type, 0, date]);
    continue;
  }

  const productCode = VALID_PRODUCT_CODES[idx % VALID_PRODUCT_CODES.length];
  const partnerCode = PRODUCT_OWNER.get(productCode);
  txRows.push([partnerCode, productCode, type, (idx % 5) + 1, date]);
}

async function main() {
  await writeWorkbook('partners-sample.xlsx',
    ['코드', '업체명', '사업자번호', '대표자', '업태', '종목', '주소', '담당자', '연락처', '기본운송요율'],
    partnerRows);
  await writeWorkbook('products-sample.xlsx',
    ['코드', '상품명', '분류', '단가', '원가', '운송요율', '파렛트임계', '최대적재'],
    productRows);
  await writeWorkbook('transactions-sample.xlsx',
    ['거래처코드', '품목코드', '구분', '수량', '일자'],
    txRows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
