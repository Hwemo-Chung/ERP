// Sentinel branchId used for SettlementPeriod rows created by warehouse settlement closes
// (as opposed to order-settlement branch locks, which use a real Branch UUID).
// Task 11 (warehouse settlement close) must reuse this constant when creating those rows.
export const WAREHOUSE_SETTLEMENT_BRANCH_ID = 'WAREHOUSE';
