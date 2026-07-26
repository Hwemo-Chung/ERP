// scripts/verify-qty-after-transaction.mjs
// P0-2 (docs/prd/2026-07-26-erp-benchmark-prd.md §3 P0-2) post-backfill verification: independently
// recomputes the (partnerId, productId)-scoped running balance in JS (same algorithm as
// apps/api/src/settlement-fees/storage-fee.ts buildDailyStock's running-sum loop — no new
// algorithm invented here) and reports any row whose stored `qty_after_transaction` disagrees.
//
// Run (against a real, migrated DB — this cannot run in a sandbox with no reachable Postgres):
//   node scripts/verify-qty-after-transaction.mjs
//
// Exit code 0 = all rows agree. Exit code 1 = at least one mismatch (prints up to 50, with count).
//
// ponytail: @prisma/client is a dependency of apps/api, not the repo root — resolve it from
// apps/api/node_modules via createRequire, same pattern as scripts/generate-sample-excel.mjs.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [path.join(__dirname, '../apps/api')] }));

const prisma = new PrismaClient();

async function main() {
  // Ordering matches both the backfill migration's window function and the insert-path lookup:
  // partitioned by (partnerId, productId), ordered by (transactionDate, id) ascending.
  const rows = await prisma.warehouseTransaction.findMany({
    select: { id: true, partnerId: true, productId: true, type: true, quantity: true, transactionDate: true, qtyAfterTransaction: true },
    orderBy: [{ partnerId: 'asc' }, { productId: 'asc' }, { transactionDate: 'asc' }, { id: 'asc' }],
  });

  const running = new Map(); // `${partnerId}:${productId}` -> running balance
  const mismatches = [];

  for (const row of rows) {
    const key = `${row.partnerId}:${row.productId}`;
    const prev = running.get(key) ?? 0;
    const expected = prev + (row.type === 'INBOUND' ? row.quantity : -row.quantity);
    running.set(key, expected);
    if (expected !== row.qtyAfterTransaction) {
      mismatches.push({ id: row.id, partnerId: row.partnerId, productId: row.productId, expected, stored: row.qtyAfterTransaction });
    }
  }

  console.log(`Checked ${rows.length} warehouse_transactions rows.`);
  if (mismatches.length === 0) {
    console.log('OK: every row\'s qty_after_transaction matches its recomputed running balance.');
    return 0;
  }

  console.error(`MISMATCH: ${mismatches.length} row(s) disagree with the recomputed running balance:`);
  for (const m of mismatches.slice(0, 50)) {
    console.error(`  id=${m.id} partnerId=${m.partnerId} productId=${m.productId} expected=${m.expected} stored=${m.stored}`);
  }
  if (mismatches.length > 50) console.error(`  ... and ${mismatches.length - 50} more`);
  return 1;
}

main()
  .then((code) => prisma.$disconnect().then(() => process.exit(code)))
  .catch((err) => {
    console.error('verify-qty-after-transaction failed:', err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
