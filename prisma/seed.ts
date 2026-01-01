import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Korean names for realistic data
const LAST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const FIRST_NAMES = ['민준', '서연', '예준', '서윤', '도윤', '지우', '시우', '지민', '주원', '하은', '지호', '수아', '현우', '지아', '준서', '하윤', '예은', '유준', '수빈', '승현'];

// Korean cities and districts
const CITIES = [
  { city: '서울특별시', districts: ['강남구', '서초구', '송파구', '강동구', '마포구', '용산구', '종로구', '중구', '영등포구', '구로구'] },
  { city: '경기도 수원시', districts: ['장안구', '권선구', '팔달구', '영통구'] },
  { city: '경기도 성남시', districts: ['분당구', '수정구', '중원구'] },
  { city: '인천광역시', districts: ['남동구', '부평구', '계양구', '서구', '연수구'] },
  { city: '부산광역시', districts: ['해운대구', '수영구', '남구', '동래구', '부산진구'] },
  { city: '대구광역시', districts: ['수성구', '달서구', '북구', '동구'] },
  { city: '대전광역시', districts: ['유성구', '서구', '중구', '대덕구'] },
  { city: '광주광역시', districts: ['서구', '북구', '광산구', '남구'] },
];

const STREETS = ['대로', '로', '길'];
const BUILDINGS = ['아파트', '오피스텔', '빌라', '주택', '상가'];
const PRODUCTS = [
  { code: 'AC-001', name: '벽걸이 에어컨', weight: 35 },
  { code: 'AC-002', name: '스탠드 에어컨', weight: 55 },
  { code: 'AC-003', name: '시스템 에어컨', weight: 45 },
  { code: 'REF-001', name: '양문형 냉장고', weight: 95 },
  { code: 'REF-002', name: '김치냉장고', weight: 75 },
  { code: 'REF-003', name: '미니 냉장고', weight: 25 },
  { code: 'WM-001', name: '드럼세탁기', weight: 85 },
  { code: 'WM-002', name: '통돌이세탁기', weight: 65 },
  { code: 'DRY-001', name: '건조기', weight: 55 },
  { code: 'TV-001', name: 'OLED TV 65인치', weight: 25 },
  { code: 'TV-002', name: 'QLED TV 75인치', weight: 35 },
  { code: 'DW-001', name: '식기세척기', weight: 45 },
];

const VENDORS = ['삼성전자', 'LG전자', '위니아', '대우전자', '캐리어'];
const TIME_WINDOWS = ['09:00-12:00', '12:00-15:00', '15:00-18:00'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateKoreanName(): string {
  return randomItem(LAST_NAMES) + randomItem(FIRST_NAMES);
}

function generateKoreanAddress(): { line1: string; line2: string; city: string; postal: string } {
  const cityData = randomItem(CITIES);
  const district = randomItem(cityData.districts);
  const streetNum = Math.floor(Math.random() * 500) + 1;
  const streetType = randomItem(STREETS);
  const buildingType = randomItem(BUILDINGS);
  const buildingNum = Math.floor(Math.random() * 30) + 1;
  const unitNum = Math.floor(Math.random() * 2000) + 101;

  return {
    line1: `${district} ${streetNum}${streetType}`,
    line2: `${buildingType} ${buildingNum}동 ${unitNum}호`,
    city: cityData.city,
    postal: String(10000 + Math.floor(Math.random() * 89999)),
  };
}

function generatePhone(): string {
  const prefix = ['010', '011', '016', '017', '019'][Math.floor(Math.random() * 5)];
  const mid = String(Math.floor(Math.random() * 9000) + 1000);
  const last = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${mid}-${last}`;
}

async function main() {
  console.log('🌱 Starting Korean sample data seed (1000+ orders)...');

  // Create 30 branches with Korean names
  const branchData = [
    { code: 'HQ', name: '본사', region: '서울' },
    { code: 'SEL01', name: '서울 강남센터', region: '서울' },
    { code: 'SEL02', name: '서울 서초센터', region: '서울' },
    { code: 'SEL03', name: '서울 송파센터', region: '서울' },
    { code: 'SEL04', name: '서울 마포센터', region: '서울' },
    { code: 'SEL05', name: '서울 영등포센터', region: '서울' },
    { code: 'GGN01', name: '경기 수원센터', region: '경기' },
    { code: 'GGN02', name: '경기 성남센터', region: '경기' },
    { code: 'GGN03', name: '경기 고양센터', region: '경기' },
    { code: 'GGN04', name: '경기 용인센터', region: '경기' },
    { code: 'ICN01', name: '인천 남동센터', region: '인천' },
    { code: 'ICN02', name: '인천 부평센터', region: '인천' },
    { code: 'BSN01', name: '부산 해운대센터', region: '부산' },
    { code: 'BSN02', name: '부산 동래센터', region: '부산' },
    { code: 'BSN03', name: '부산 서면센터', region: '부산' },
    { code: 'DGU01', name: '대구 수성센터', region: '대구' },
    { code: 'DGU02', name: '대구 달서센터', region: '대구' },
    { code: 'GWJ01', name: '광주 서구센터', region: '광주' },
    { code: 'GWJ02', name: '광주 북구센터', region: '광주' },
    { code: 'DJN01', name: '대전 유성센터', region: '대전' },
    { code: 'DJN02', name: '대전 서구센터', region: '대전' },
    { code: 'USN01', name: '울산 남구센터', region: '울산' },
    { code: 'SWN01', name: '수원 영통센터', region: '경기' },
    { code: 'SWN02', name: '수원 권선센터', region: '경기' },
    { code: 'CHN01', name: '천안 서북센터', region: '충남' },
    { code: 'CHN02', name: '천안 동남센터', region: '충남' },
    { code: 'JJU01', name: '전주 덕진센터', region: '전북' },
    { code: 'CJU01', name: '청주 상당센터', region: '충북' },
    { code: 'GNJ01', name: '김해 센터', region: '경남' },
    { code: 'JJD01', name: '제주 센터', region: '제주' },
  ];

  const branches = [];
  for (const b of branchData) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: { name: b.name, region: b.region },
      create: { code: b.code, name: b.name, region: b.region, timezone: 'Asia/Seoul' },
    });
    branches.push(branch);
  }
  console.log(`✅ Created ${branches.length} branches (Korean names)`);

  // Create users
  const adminPassword = await argon2.hash('admin123!');
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      fullName: '관리자',
      email: 'admin@erp-logistics.com',
      locale: 'ko',
      branchId: branches[0].id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: Role.HQ_ADMIN } },
    update: {},
    create: { userId: admin.id, role: Role.HQ_ADMIN },
  });
  console.log(`✅ Created admin user: ${admin.username}`);

  // Create branch managers
  const managerPassword = await argon2.hash('manager123!');
  for (let i = 1; i <= 10; i++) {
    const branchIdx = i % (branches.length - 1) + 1;
    const username = `manager${String(i).padStart(2, '0')}`;
    const manager = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        passwordHash: managerPassword,
        fullName: `${generateKoreanName()} 센터장`,
        email: `${username}@erp-logistics.com`,
        locale: 'ko',
        branchId: branches[branchIdx].id,
        isActive: true,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: manager.id, role: Role.BRANCH_MANAGER } },
      update: {},
      create: { userId: manager.id, role: Role.BRANCH_MANAGER },
    });
  }
  console.log('✅ Created 10 branch managers');

  // Create test user
  const testPassword = await argon2.hash('test');
  const testUser = await prisma.user.upsert({
    where: { username: '0001' },
    update: {},
    create: {
      username: '0001',
      passwordHash: testPassword,
      fullName: '테스트 기사',
      email: 'test@erp-logistics.com',
      locale: 'ko',
      branchId: branches[1].id,
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: testUser.id, role: Role.INSTALLER } },
    update: {},
    create: { userId: testUser.id, role: Role.INSTALLER },
  });
  console.log(`✅ Created test user: 0001 (password: test)`);

  // Create waste codes
  const wasteCodes = [
    { code: 'P01', descriptionKo: '에어컨 실외기', descriptionEn: 'AC Outdoor Unit' },
    { code: 'P02', descriptionKo: '에어컨 실내기', descriptionEn: 'AC Indoor Unit' },
    { code: 'P03', descriptionKo: '냉장고', descriptionEn: 'Refrigerator' },
    { code: 'P04', descriptionKo: '세탁기', descriptionEn: 'Washing Machine' },
    { code: 'P05', descriptionKo: 'TV', descriptionEn: 'Television' },
    { code: 'P06', descriptionKo: '전자레인지', descriptionEn: 'Microwave' },
    { code: 'P07', descriptionKo: '컴퓨터', descriptionEn: 'Computer' },
    { code: 'P08', descriptionKo: '프린터', descriptionEn: 'Printer' },
    { code: 'P09', descriptionKo: '모니터', descriptionEn: 'Monitor' },
    { code: 'P10', descriptionKo: '청소기', descriptionEn: 'Vacuum Cleaner' },
    { code: 'P11', descriptionKo: '건조기', descriptionEn: 'Dryer' },
    { code: 'P12', descriptionKo: '공기청정기', descriptionEn: 'Air Purifier' },
    { code: 'P13', descriptionKo: '제습기', descriptionEn: 'Dehumidifier' },
    { code: 'P14', descriptionKo: '가습기', descriptionEn: 'Humidifier' },
    { code: 'P15', descriptionKo: '온풍기', descriptionEn: 'Heater' },
    { code: 'P16', descriptionKo: '선풍기', descriptionEn: 'Fan' },
    { code: 'P17', descriptionKo: '식기세척기', descriptionEn: 'Dishwasher' },
    { code: 'P18', descriptionKo: '전기밥솥', descriptionEn: 'Rice Cooker' },
    { code: 'P19', descriptionKo: '정수기', descriptionEn: 'Water Purifier' },
    { code: 'P20', descriptionKo: '비데', descriptionEn: 'Bidet' },
  ];

  for (const wc of wasteCodes) {
    await prisma.wasteCode.upsert({
      where: { code: wc.code },
      update: {},
      create: { ...wc, isActive: true },
    });
  }
  console.log(`✅ Created ${wasteCodes.length} waste codes`);

  // Create reason codes
  const reasonCodes = [
    { type: 'CANCEL' as const, code: 'C01', descriptionKo: '고객 요청 취소', descriptionEn: 'Customer Request' },
    { type: 'CANCEL' as const, code: 'C02', descriptionKo: '재고 부족', descriptionEn: 'Out of Stock' },
    { type: 'CANCEL' as const, code: 'C03', descriptionKo: '가격 문제', descriptionEn: 'Price Issue' },
    { type: 'CANCEL' as const, code: 'C04', descriptionKo: '중복 주문', descriptionEn: 'Duplicate Order' },
    { type: 'CANCEL' as const, code: 'C05', descriptionKo: '제품 불량', descriptionEn: 'Defective Product' },
    { type: 'POSTPONE' as const, code: 'D01', descriptionKo: '고객 일정 변경', descriptionEn: 'Schedule Change' },
    { type: 'POSTPONE' as const, code: 'D02', descriptionKo: '배송 지연', descriptionEn: 'Delivery Delay' },
    { type: 'POSTPONE' as const, code: 'D03', descriptionKo: '기상 악화', descriptionEn: 'Bad Weather' },
    { type: 'POSTPONE' as const, code: 'D04', descriptionKo: '설치 환경 미비', descriptionEn: 'Not Ready' },
    { type: 'POSTPONE' as const, code: 'D05', descriptionKo: '기사 사정', descriptionEn: 'Technician Issue' },
    { type: 'ABSENCE' as const, code: 'A01', descriptionKo: '고객 부재', descriptionEn: 'Not at Home' },
    { type: 'ABSENCE' as const, code: 'A02', descriptionKo: '연락 불가', descriptionEn: 'Unreachable' },
    { type: 'ABSENCE' as const, code: 'A03', descriptionKo: '주소 오류', descriptionEn: 'Wrong Address' },
    { type: 'ABSENCE' as const, code: 'A04', descriptionKo: '방문 거부', descriptionEn: 'Refused Entry' },
    { type: 'ABSENCE' as const, code: 'A05', descriptionKo: '건물 출입 제한', descriptionEn: 'Access Denied' },
  ];

  for (const rc of reasonCodes) {
    await prisma.reasonCode.upsert({
      where: { code: rc.code },
      update: {},
      create: { ...rc, isActive: true },
    });
  }
  console.log(`✅ Created ${reasonCodes.length} reason codes`);

  // Create 30 Partners with Korean names
  const partners = [];
  const partnerNames = [
    '한국전자서비스', '대한설치', '우리홈서비스', '삼성에어컨', 'LG설치센터',
    '스마트홈서비스', '프리미엄설치', '빠른배송설치', '전문가그룹', '홈케어서비스',
    '에이스설치', '베스트서비스', '원스톱설치', '프로설치', '탑클래스서비스',
    '그린설치', '블루서비스', '골드설치', '실버케어', '다이아몬드서비스',
    '파워설치', '스피드서비스', '마스터설치', '엘리트서비스', '프라임설치',
    '익스퍼트그룹', '테크설치', '스마트케어', '홈마스터', '설치왕'
  ];

  for (let i = 0; i < 30; i++) {
    const partner = await prisma.partner.upsert({
      where: { code: `PTN${String(i + 1).padStart(2, '0')}` },
      update: { name: partnerNames[i] },
      create: {
        code: `PTN${String(i + 1).padStart(2, '0')}`,
        name: partnerNames[i],
        contactName: `${generateKoreanName()} 대표`,
        phone: generatePhone(),
        email: `partner${i + 1}@example.com`,
        isActive: i % 10 !== 0,
      },
    });
    partners.push(partner);
  }
  console.log(`✅ Created ${partners.length} partners (Korean names)`);

  // Create 50 Installers with Korean names
  const installers = [];
  for (let i = 1; i <= 50; i++) {
    const partnerIdx = (i - 1) % partners.length;
    const branchIdx = (i % (branches.length - 1)) + 1;
    const inst = await prisma.installer.upsert({
      where: { id: `installer-${i}` },
      update: { name: `${generateKoreanName()} 기사` },
      create: {
        id: `installer-${i}`,
        partnerId: partners[partnerIdx].id,
        branchId: branches[branchIdx].id,
        name: `${generateKoreanName()} 기사`,
        phone: generatePhone(),
        skillTags: ['에어컨', '냉장고', '세탁기'].slice(0, 1 + (i % 3)),
        capacityPerDay: 6 + (i % 6),
        isActive: i % 12 !== 0,
      },
    });
    installers.push(inst);
  }
  console.log(`✅ Created ${installers.length} installers (Korean names)`);

  // ============================================
  // CREATE 1000+ ORDERS
  // ============================================
  const statuses = [
    'UNASSIGNED', 'ASSIGNED', 'CONFIRMED', 'RELEASED', 'DISPATCHED',
    'POSTPONED', 'ABSENT', 'COMPLETED', 'PARTIAL', 'COLLECTED',
    'CANCELLED', 'REQUEST_CANCEL',
  ] as const;

  const today = new Date();
  const orders = [];
  let orderCounter = 1;

  // Target: ~85 orders per status = 1020 orders
  const ORDERS_PER_STATUS = 85;

  console.log(`🔄 Creating ${statuses.length * ORDERS_PER_STATUS} orders...`);

  for (const status of statuses) {
    for (let i = 1; i <= ORDERS_PER_STATUS; i++) {
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const orderNo = `ORD-${dateStr}-${String(orderCounter).padStart(4, '0')}`;

      const needsInstaller = !['UNASSIGNED'].includes(status);

      // Distribute dates: -7 days to +14 days from today
      // More orders today and near future for dashboard visibility
      let dayOffset: number;
      if (i <= 30) {
        dayOffset = 0; // 30 orders today
      } else if (i <= 50) {
        dayOffset = 1; // 20 orders tomorrow
      } else if (i <= 65) {
        dayOffset = -1; // 15 orders yesterday
      } else {
        dayOffset = Math.floor(Math.random() * 21) - 7; // -7 to +14
      }

      const appointmentDate = new Date(today);
      appointmentDate.setDate(today.getDate() + dayOffset);
      appointmentDate.setHours(0, 0, 0, 0);

      const branchIdx = (orderCounter % (branches.length - 1)) + 1;
      const customerName = generateKoreanName();
      const address = generateKoreanAddress();

      const order = await prisma.order.upsert({
        where: { orderNo },
        update: {},
        create: {
          orderNo,
          customerName,
          customerPhone: generatePhone(),
          address,
          vendor: randomItem(VENDORS),
          branchId: branches[branchIdx].id,
          partnerId: needsInstaller ? partners[orderCounter % partners.length].id : null,
          installerId: needsInstaller ? installers[orderCounter % installers.length].id : null,
          status: status as any,
          appointmentDate,
          appointmentTimeWindow: randomItem(TIME_WINDOWS),
          promisedDate: appointmentDate,
          remarks: status === 'POSTPONED' ? '고객 요청으로 일정 변경' :
                   status === 'ABSENT' ? '방문 시 고객 부재' :
                   status === 'CANCELLED' ? '고객 취소 요청' :
                   status === 'REQUEST_CANCEL' ? '의뢰사 취소 요청' : null,
          version: 1,
        },
      });
      orders.push(order);

      // Create order lines (2-4 items per order)
      const itemCount = 2 + (orderCounter % 3);
      for (let j = 0; j < itemCount; j++) {
        const product = PRODUCTS[(orderCounter + j) % PRODUCTS.length];
        await prisma.orderLine.create({
          data: {
            orderId: order.id,
            itemCode: product.code,
            itemName: product.name,
            quantity: 1 + (j % 2),
            weight: String(product.weight + (j * 5)),
          },
        });
      }

      // Create status history
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: 'UNASSIGNED',
          newStatus: status as any,
          changedBy: testUser.id,
          notes: `상태 변경: ${status}`,
        },
      });

      orderCounter++;

      // Progress log every 100 orders
      if (orderCounter % 100 === 0) {
        console.log(`   📦 Created ${orderCounter} orders...`);
      }
    }
  }
  console.log(`✅ Created ${orders.length} orders with order lines`);

  // Create cancellation records
  const cancelledOrders = orders.filter(o => ['CANCELLED', 'REQUEST_CANCEL'].includes(o.status));
  for (let i = 0; i < cancelledOrders.length; i++) {
    await prisma.cancellationRecord.upsert({
      where: { orderId: cancelledOrders[i].id },
      update: {},
      create: {
        orderId: cancelledOrders[i].id,
        reason: ['CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE', 'WRONG_ADDRESS', 'OTHER'][i % 5],
        note: `취소 사유: ${['고객 요청', '재고 부족', '중복 주문', '주소 오류', '기타'][i % 5]}`,
        cancelledBy: testUser.id,
        previousStatus: 'ASSIGNED',
        refundAmount: 50000 + (i * 10000),
        refundProcessed: i % 2 === 0,
        isReturned: i % 3 === 0,
        returnedAt: i % 3 === 0 ? new Date() : null,
        returnedBy: i % 3 === 0 ? testUser.id : null,
      },
    });
  }
  console.log(`✅ Created ${cancelledOrders.length} cancellation records`);

  // Create waste pickups
  const completedOrders = orders.filter(o => ['COMPLETED', 'COLLECTED'].includes(o.status));
  for (let i = 0; i < completedOrders.length; i++) {
    const wasteCode = wasteCodes[i % wasteCodes.length].code;
    await prisma.wastePickup.upsert({
      where: { orderId_code: { orderId: completedOrders[i].id, code: wasteCode } },
      update: {},
      create: {
        orderId: completedOrders[i].id,
        code: wasteCode,
        quantity: 1 + (i % 3),
        collectedBy: installers[i % installers.length].id,
        collectedAt: new Date(),
      },
    });
  }
  console.log(`✅ Created ${completedOrders.length} waste pickups`);

  // Create serial numbers for completed orders
  let serialCount = 0;
  for (let i = 0; i < Math.min(completedOrders.length, 100); i++) {
    const orderLines = await prisma.orderLine.findMany({
      where: { orderId: completedOrders[i].id },
    });
    for (const line of orderLines) {
      const serialNo = `SN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await prisma.serialNumber.upsert({
        where: { serial: serialNo },
        update: {},
        create: {
          orderLineId: line.id,
          serial: serialNo,
          recordedBy: testUser.id,
        },
      });
      serialCount++;
    }
  }
  console.log(`✅ Created ${serialCount} serial numbers`);

  // Create settlement period
  const periodStart = new Date(today);
  periodStart.setDate(today.getDate() - today.getDay());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 6);

  await prisma.settlementPeriod.upsert({
    where: { id: 'settlement-current-week' },
    update: {},
    create: {
      id: 'settlement-current-week',
      branchId: branches[1].id,
      periodStart,
      periodEnd,
      status: 'OPEN',
    },
  });
  console.log(`✅ Created settlement period`);

  // Summary
  console.log('\n🎉 Database seed completed!');
  console.log('='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   - ${branches.length} branches`);
  console.log(`   - ${partners.length} partners`);
  console.log(`   - ${installers.length} installers`);
  console.log(`   - ${orders.length} orders (1000+)`);
  console.log(`   - Each status: ~${ORDERS_PER_STATUS} orders`);
  console.log(`   - Today's orders: ~${statuses.length * 30} orders`);
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
