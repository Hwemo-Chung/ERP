/**
 * 정산 시연용 데이터 생성 스크립트 (로컬 데모 전용).
 *
 * 실행: set -a && . ./.env && set +a && node scripts/seed-demo-settlement.mjs
 *
 * 생성 내용:
 *  - 카테고리 3단 트리 (가전 > 대형가전 > 냉장고/세탁기, 소형가전, 가구)
 *  - 거래처 2곳: 대한물류(파렛트×일수 계약) / 한국유통(면적 월임대 · 일할)
 *  - 품목 6종 (파렛트 적재 기준·요율 설정 포함)
 *  - 차량 단가표 3종 (1t/2.5t/5t)
 *  - **요율 이력**: 대한물류 기본 운송요율이 당월 16일부터 인상 → P0-1 시연용
 *  - 입출고 실적: 당월 1~25일, qtyAfterTransaction 러닝합 직접 계산
 *
 * 멱등: code 기준 upsert. 재실행 시 실적은 중복 생성하지 않도록 기존 건 삭제 후 재생성.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const now = new Date();
const Y = now.getUTCFullYear();
const M = now.getUTCMonth() + 1; // 1-12
const ym = `${Y}-${String(M).padStart(2, '0')}`;
const d = (day, hour = 9) => new Date(Date.UTC(Y, M - 1, day, hour, 0, 0));
const dateOnly = (day) => new Date(Date.UTC(Y, M - 1, day));

async function main() {
  console.log(`\n🎬 정산 시연 데이터 생성 (대상 월: ${ym})\n`);

  // ─── 1. 카테고리 트리 ────────────────────────────────────────────
  const catRoot = await prisma.category.upsert({
    where: { code: 'A' },
    update: { name: '가전' },
    create: { code: 'A', name: '가전', depth: 1, isActive: true },
  });
  const catLarge = await prisma.category.upsert({
    where: { code: 'A-01' },
    update: { name: '대형가전' },
    create: { code: 'A-01', name: '대형가전', depth: 2, parentId: catRoot.id, isActive: true },
  });
  const catFridge = await prisma.category.upsert({
    where: { code: 'A-01-001' },
    update: { name: '냉장고' },
    create: { code: 'A-01-001', name: '냉장고', depth: 3, parentId: catLarge.id, isActive: true },
  });
  const catWasher = await prisma.category.upsert({
    where: { code: 'A-01-002' },
    update: { name: '세탁기' },
    create: { code: 'A-01-002', name: '세탁기', depth: 3, parentId: catLarge.id, isActive: true },
  });
  const catFurn = await prisma.category.upsert({
    where: { code: 'B' },
    update: { name: '가구' },
    create: { code: 'B', name: '가구', depth: 1, isActive: true },
  });
  console.log('✅ 카테고리 5건 (가전 > 대형가전 > 냉장고/세탁기, 가구)');

  // ─── 2. 거래처 + 보관계약 ────────────────────────────────────────
  // 파렛트×일수 계약
  const pA = await prisma.partner.upsert({
    where: { code: 'DEMO-A' },
    update: { defaultTransportRate: new Prisma.Decimal(3000) },
    create: {
      code: 'DEMO-A',
      name: '대한물류(주)',
      businessRegistrationNo: '1208147521',
      representativeName: '김대한',
      businessType: '운수업',
      businessCategory: '화물운송',
      address: '서울 강서구 오정로 123',
      contactName: '박담당',
      phone: '02-1234-5678',
      email: 'demo-a@example.com',
      defaultTransportRate: new Prisma.Decimal(3000),
      isActive: true,
    },
  });
  // 면적 월임대 + 일할
  const pB = await prisma.partner.upsert({
    where: { code: 'DEMO-B' },
    update: { defaultTransportRate: new Prisma.Decimal(4500) },
    create: {
      code: 'DEMO-B',
      name: '한국유통(주)',
      businessRegistrationNo: '2208150563',
      representativeName: '이한국',
      businessType: '도매업',
      businessCategory: '가전유통',
      address: '경기 부천시 오정구 456',
      contactName: '최담당',
      phone: '032-987-6543',
      email: 'demo-b@example.com',
      defaultTransportRate: new Prisma.Decimal(4500),
      isActive: true,
    },
  });

  for (const [partner, contract] of [
    [pA, { contractType: 'PALLET_DAILY', palletDailyRate: new Prisma.Decimal(1500) }],
    [pB, {
      contractType: 'AREA_MONTHLY',
      areaPyeong: new Prisma.Decimal(120),
      areaRate: new Prisma.Decimal(9000),
      areaBillingMode: 'DAILY_PRORATED',
    }],
  ]) {
    const existing = await prisma.storageContract.findFirst({
      where: { partnerId: partner.id, isActive: true },
    });
    if (!existing) {
      await prisma.storageContract.create({
        data: {
          partnerId: partner.id,
          ...contract,
          // 일할 시연: 한국유통은 당월 10일부터 계약 시작 → 일할 안분 발생
          startDate: contract.contractType === 'AREA_MONTHLY' ? dateOnly(10) : dateOnly(1),
          isActive: true,
        },
      });
    }
  }
  console.log('✅ 거래처 2곳 + 보관계약 (대한물류: 파렛트×일수 1,500원 / 한국유통: 면적 120평×9,000원 일할, 당월 10일 계약시작)');

  // ─── 3. 품목 ────────────────────────────────────────────────────
  const productDefs = [
    { code: 'DEMO-I-001', name: '냉장고 RF85 (양문형)', categoryId: catFridge.id, partnerId: pA.id, unitPrice: 1_850_000, costPrice: 1_400_000, transportRate: 8000, maxUnitsPerPallet: 4 },
    { code: 'DEMO-I-002', name: '냉장고 RF60 (일반형)', categoryId: catFridge.id, partnerId: pA.id, unitPrice: 990_000, costPrice: 720_000, transportRate: 6000, maxUnitsPerPallet: 6 },
    { code: 'DEMO-I-003', name: '드럼세탁기 WD21', categoryId: catWasher.id, partnerId: pA.id, unitPrice: 1_290_000, costPrice: 950_000, transportRate: null, maxUnitsPerPallet: 8 },
    { code: 'DEMO-I-004', name: '통돌이세탁기 WT15', categoryId: catWasher.id, partnerId: pA.id, unitPrice: 690_000, costPrice: 480_000, transportRate: null, maxUnitsPerPallet: 10, palletThreshold: 50 },
    { code: 'DEMO-I-005', name: '4인용 소파', categoryId: catFurn.id, partnerId: pB.id, unitPrice: 1_200_000, costPrice: 800_000, transportRate: 12000, maxUnitsPerPallet: 2 },
    { code: 'DEMO-I-006', name: '식탁 세트 6인', categoryId: catFurn.id, partnerId: pB.id, unitPrice: 890_000, costPrice: 600_000, transportRate: null, maxUnitsPerPallet: 3 },
  ];
  const products = {};
  for (const p of productDefs) {
    products[p.code] = await prisma.product.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        unitPrice: new Prisma.Decimal(p.unitPrice),
        costPrice: new Prisma.Decimal(p.costPrice),
        transportRate: p.transportRate === null ? null : new Prisma.Decimal(p.transportRate),
        maxUnitsPerPallet: p.maxUnitsPerPallet,
        palletThreshold: p.palletThreshold == null ? null : new Prisma.Decimal(p.palletThreshold),
      },
      create: {
        code: p.code,
        name: p.name,
        categoryId: p.categoryId,
        partnerId: p.partnerId,
        unitPrice: new Prisma.Decimal(p.unitPrice),
        costPrice: new Prisma.Decimal(p.costPrice),
        transportRate: p.transportRate === null ? null : new Prisma.Decimal(p.transportRate),
        maxUnitsPerPallet: p.maxUnitsPerPallet,
        palletThreshold: p.palletThreshold == null ? null : new Prisma.Decimal(p.palletThreshold),
        isActive: true,
      },
    });
  }
  console.log('✅ 품목 6종 (파렛트 적재 4~10개, 일부는 품목별 운송요율 설정 / WT15는 임계값 50% override)');

  // ─── 4. 차량 단가표 ──────────────────────────────────────────────
  const rateCardDefs = [
    { vehicleType: '카고 1톤', tonnage: 1.0, rate: 90_000 },
    { vehicleType: '윙바디 2.5톤', tonnage: 2.5, rate: 150_000 },
    { vehicleType: '윙바디 5톤', tonnage: 5.0, rate: 240_000 },
  ];
  const rateCards = [];
  for (const rc of rateCardDefs) {
    let card = await prisma.transportRateCard.findFirst({
      where: { vehicleType: rc.vehicleType, isActive: true },
    });
    if (!card) {
      card = await prisma.transportRateCard.create({
        data: {
          vehicleType: rc.vehicleType,
          tonnage: new Prisma.Decimal(rc.tonnage),
          rate: new Prisma.Decimal(rc.rate),
          isActive: true,
        },
      });
    }
    rateCards.push(card);
  }
  console.log('✅ 차량 단가표 3종 (1t 90,000 / 2.5t 150,000 / 5t 240,000)');

  // ─── 5. 요율 이력 (P0-1 시연: 당월 16일부터 인상) ──────────────────
  // 대한물류 기본 운송요율: 1~15일 3,000원 → 16일부터 4,000원
  await prisma.partnerTransportRateHistory.deleteMany({ where: { partnerId: pA.id } });
  await prisma.partnerTransportRateHistory.createMany({
    data: [
      { partnerId: pA.id, rate: new Prisma.Decimal(3000), effectiveFrom: dateOnly(1), effectiveTo: dateOnly(16) },
      { partnerId: pA.id, rate: new Prisma.Decimal(4000), effectiveFrom: dateOnly(16), effectiveTo: null },
    ],
  });
  // 캐시 컬럼은 "현재값"(=최신 이력)과 일치시킨다
  await prisma.partner.update({ where: { id: pA.id }, data: { defaultTransportRate: new Prisma.Decimal(4000) } });

  // 냉장고 RF85 품목 요율: 전 기간 8,000원 (변동 없음 — 대조군)
  await prisma.productTransportRateHistory.deleteMany({ where: { productId: products['DEMO-I-001'].id } });
  await prisma.productTransportRateHistory.create({
    data: { productId: products['DEMO-I-001'].id, rate: new Prisma.Decimal(8000), effectiveFrom: dateOnly(1), effectiveTo: null },
  });
  console.log(`✅ 요율 이력: 대한물류 기본요율 ${ym}-01~15 = 3,000원 → ${ym}-16부터 4,000원 (P0-1 시연용)`);

  // ─── 6. 입출고 실적 (당월) ───────────────────────────────────────
  const demoPartnerIds = [pA.id, pB.id];
  await prisma.settlementRecord.deleteMany({ where: { partnerId: { in: demoPartnerIds } } });
  await prisma.warehouseTransaction.deleteMany({ where: { partnerId: { in: demoPartnerIds } } });

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });

  // [day, productCode, type, qty, vehicleIdx?]
  const txDefs = [
    // 대한물류 — 입고 후 분산 출고. 16일 전후로 요율 변경 효과 확인 가능
    [1, 'DEMO-I-001', 'INBOUND', 40], [1, 'DEMO-I-002', 'INBOUND', 60],
    [2, 'DEMO-I-003', 'INBOUND', 48], [2, 'DEMO-I-004', 'INBOUND', 100],
    [5, 'DEMO-I-001', 'OUTBOUND', 8, 1], [6, 'DEMO-I-002', 'OUTBOUND', 12],
    [8, 'DEMO-I-003', 'OUTBOUND', 16, 0], [10, 'DEMO-I-004', 'OUTBOUND', 30],
    [12, 'DEMO-I-001', 'OUTBOUND', 4], [14, 'DEMO-I-002', 'OUTBOUND', 18, 2],
    // ↓ 여기부터 16일 이후 — 대한물류 기본요율 4,000원 적용 구간
    [17, 'DEMO-I-003', 'OUTBOUND', 8], [18, 'DEMO-I-004', 'OUTBOUND', 25],
    [20, 'DEMO-I-001', 'INBOUND', 20], [21, 'DEMO-I-002', 'OUTBOUND', 10, 1],
    [23, 'DEMO-I-003', 'OUTBOUND', 12], [25, 'DEMO-I-004', 'OUTBOUND', 20],
    // 한국유통 — 면적 계약(물량 무관)이지만 출고 운송료는 발생
    [11, 'DEMO-I-005', 'INBOUND', 12], [11, 'DEMO-I-006', 'INBOUND', 18],
    [13, 'DEMO-I-005', 'OUTBOUND', 4, 2], [15, 'DEMO-I-006', 'OUTBOUND', 6],
    [19, 'DEMO-I-005', 'OUTBOUND', 3], [22, 'DEMO-I-006', 'OUTBOUND', 5, 0],
    [24, 'DEMO-I-005', 'INBOUND', 10],
  ];

  // (partnerId, productId)별 러닝 잔고 — 마이그레이션 백필과 같은 정렬(날짜 → id) 전제
  const balance = new Map();
  let created = 0;
  for (const [day, code, type, qty, vIdx] of txDefs) {
    const product = products[code];
    const key = `${product.partnerId}:${product.id}`;
    const prev = balance.get(key) ?? 0;
    const next = prev + (type === 'INBOUND' ? qty : -qty);
    balance.set(key, next);
    await prisma.warehouseTransaction.create({
      data: {
        type,
        partnerId: product.partnerId,
        productId: product.id,
        quantity: qty,
        transactionDate: d(day),
        vehicleRateId: vIdx == null ? null : rateCards[vIdx].id,
        source: 'PWA',
        createdBy: admin.id,
        qtyAfterTransaction: next,
      },
    });
    created++;
  }
  console.log(`✅ 입출고 실적 ${created}건 (${ym}-01 ~ ${ym}-25, 누적 잔고 계산 포함)`);

  // ─── 7. 전역 설정 ────────────────────────────────────────────────
  await prisma.systemSetting.upsert({
    where: { key: 'pallet_threshold_default' },
    update: { value: '70' },
    create: { key: 'pallet_threshold_default', value: '70' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'vehicle_rate_mode' },
    update: { value: 'REPLACE' },
    create: { key: 'vehicle_rate_mode', value: 'REPLACE' },
  });
  console.log('✅ 전역 설정 (파렛트 임계 70%, 차량요율 모드 REPLACE)');

  console.log(`\n🎉 시연 데이터 준비 완료 — 정산 대상 월: ${ym}\n`);
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
