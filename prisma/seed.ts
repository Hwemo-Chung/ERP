import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create 30 branches
  const branchData = [
    { code: 'HQ', name: 'Headquarters', region: 'Seoul' },
    { code: 'SEL01', name: 'Seoul Branch 1', region: 'Seoul' },
    { code: 'SEL02', name: 'Seoul Branch 2', region: 'Seoul' },
    { code: 'SEL03', name: 'Seoul Branch 3', region: 'Seoul' },
    { code: 'GGN01', name: 'Gyeonggi Branch 1', region: 'Gyeonggi' },
    { code: 'GGN02', name: 'Gyeonggi Branch 2', region: 'Gyeonggi' },
    { code: 'GGN03', name: 'Gyeonggi Branch 3', region: 'Gyeonggi' },
    { code: 'ICN01', name: 'Incheon Branch 1', region: 'Incheon' },
    { code: 'ICN02', name: 'Incheon Branch 2', region: 'Incheon' },
    { code: 'BSN01', name: 'Busan Branch 1', region: 'Busan' },
    { code: 'BSN02', name: 'Busan Branch 2', region: 'Busan' },
    { code: 'BSN03', name: 'Busan Branch 3', region: 'Busan' },
    { code: 'DGU01', name: 'Daegu Branch 1', region: 'Daegu' },
    { code: 'DGU02', name: 'Daegu Branch 2', region: 'Daegu' },
    { code: 'GWJ01', name: 'Gwangju Branch 1', region: 'Gwangju' },
    { code: 'GWJ02', name: 'Gwangju Branch 2', region: 'Gwangju' },
    { code: 'DJN01', name: 'Daejeon Branch 1', region: 'Daejeon' },
    { code: 'DJN02', name: 'Daejeon Branch 2', region: 'Daejeon' },
    { code: 'USN01', name: 'Ulsan Branch 1', region: 'Ulsan' },
    { code: 'USN02', name: 'Ulsan Branch 2', region: 'Ulsan' },
    { code: 'SWN01', name: 'Suwon Branch 1', region: 'Suwon' },
    { code: 'SWN02', name: 'Suwon Branch 2', region: 'Suwon' },
    { code: 'CHN01', name: 'Cheonan Branch 1', region: 'Cheonan' },
    { code: 'CHN02', name: 'Cheonan Branch 2', region: 'Cheonan' },
    { code: 'JJU01', name: 'Jeonju Branch 1', region: 'Jeonju' },
    { code: 'JJU02', name: 'Jeonju Branch 2', region: 'Jeonju' },
    { code: 'CJU01', name: 'Cheongju Branch 1', region: 'Cheongju' },
    { code: 'CJU02', name: 'Cheongju Branch 2', region: 'Cheongju' },
    { code: 'GNJ01', name: 'Gimhae Branch 1', region: 'Gimhae' },
    { code: 'YSN01', name: 'Yeosu Branch 1', region: 'Yeosu' },
  ];

  const branches = [];
  for (const b of branchData) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: {},
      create: { code: b.code, name: b.name, region: b.region, timezone: 'Asia/Seoul' },
    });
    branches.push(branch);
  }

  console.log(`✅ Created ${branches.length} branches`);

  // Create HQ Admin user
  const adminPassword = await argon2.hash('admin123!');
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'System Admin',
      email: 'admin@erp-logistics.com',
      locale: 'ko',
      branchId: branches[0].id,
      isActive: true,
    },
  });

  // Create admin role
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: Role.HQ_ADMIN } },
    update: {},
    create: { userId: admin.id, role: Role.HQ_ADMIN },
  });

  console.log(`✅ Created admin user: ${admin.username}`);

  // Create Branch Manager
  const managerPassword = await argon2.hash('manager123!');
  const manager = await prisma.user.upsert({
    where: { username: 'manager01' },
    update: {},
    create: {
      username: 'manager01',
      passwordHash: managerPassword,
      fullName: 'Kim Branch Manager',
      email: 'manager01@erp-logistics.com',
      locale: 'ko',
      branchId: branches[1].id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: manager.id, role: Role.BRANCH_MANAGER } },
    update: {},
    create: { userId: manager.id, role: Role.BRANCH_MANAGER },
  });

  console.log(`✅ Created branch manager: ${manager.username}`);

  // Create Partner Coordinator
  const coordinatorPassword = await argon2.hash('coord123!');
  const coordinator = await prisma.user.upsert({
    where: { username: 'coord01' },
    update: {},
    create: {
      username: 'coord01',
      passwordHash: coordinatorPassword,
      fullName: 'Park Coordinator',
      email: 'coord01@erp-logistics.com',
      locale: 'ko',
      branchId: branches[1].id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: coordinator.id, role: Role.PARTNER_COORDINATOR } },
    update: {},
    create: { userId: coordinator.id, role: Role.PARTNER_COORDINATOR },
  });

  console.log(`✅ Created coordinator: ${coordinator.username}`);

  // Create Installer
  const installerPassword = await argon2.hash('inst123!');
  const installer = await prisma.user.upsert({
    where: { username: 'installer01' },
    update: {},
    create: {
      username: 'installer01',
      passwordHash: installerPassword,
      fullName: 'Lee Installer',
      email: 'installer01@erp-logistics.com',
      locale: 'ko',
      branchId: branches[1].id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: installer.id, role: Role.INSTALLER } },
    update: {},
    create: { userId: installer.id, role: Role.INSTALLER },
  });

  console.log(`✅ Created installer: ${installer.username}`);

  // Create Test User (0001 / test)
  const testPassword = await argon2.hash('test');
  const testUser = await prisma.user.upsert({
    where: { username: '0001' },
    update: {},
    create: {
      username: '0001',
      passwordHash: testPassword,
      fullName: 'Test User',
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

  console.log(`✅ Created test user: ${testUser.username} (password: test)`);

  // Create additional users to reach 30 total
  const additionalUserPassword = await argon2.hash('user123!');
  const roles = [Role.BRANCH_MANAGER, Role.PARTNER_COORDINATOR, Role.INSTALLER];

  for (let i = 1; i <= 25; i++) {
    const branchIdx = i % (branches.length - 1) + 1; // Skip HQ
    const roleIdx = i % roles.length;
    const username = `user${String(i).padStart(2, '0')}`;

    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        passwordHash: additionalUserPassword,
        fullName: `User ${String(i).padStart(2, '0')}`,
        email: `user${i}@erp-logistics.com`,
        locale: 'ko',
        branchId: branches[branchIdx].id,
        isActive: i % 10 !== 0, // 10% inactive
      },
    });

    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: roles[roleIdx] } },
      update: {},
      create: { userId: user.id, role: roles[roleIdx] },
    });
  }
  console.log('✅ Created 25 additional users (30 total)');

  // Create 30 waste codes (P01-P30)
  const wasteCodes = [
    { code: 'P01', descriptionKo: '에어컨 실외기', descriptionEn: 'Air Conditioner Outdoor Unit' },
    { code: 'P02', descriptionKo: '에어컨 실내기', descriptionEn: 'Air Conditioner Indoor Unit' },
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
    { code: 'P21', descriptionKo: '오븐', descriptionEn: 'Oven' },
    { code: 'P22', descriptionKo: '토스터', descriptionEn: 'Toaster' },
    { code: 'P23', descriptionKo: '커피머신', descriptionEn: 'Coffee Machine' },
    { code: 'P24', descriptionKo: '믹서기', descriptionEn: 'Blender' },
    { code: 'P25', descriptionKo: '전기포트', descriptionEn: 'Electric Kettle' },
    { code: 'P26', descriptionKo: '스팀다리미', descriptionEn: 'Steam Iron' },
    { code: 'P27', descriptionKo: '로봇청소기', descriptionEn: 'Robot Vacuum' },
    { code: 'P28', descriptionKo: '스마트워치', descriptionEn: 'Smart Watch' },
    { code: 'P29', descriptionKo: '태블릿', descriptionEn: 'Tablet' },
    { code: 'P30', descriptionKo: '스피커', descriptionEn: 'Speaker' },
  ];

  for (const wc of wasteCodes) {
    await prisma.wasteCode.upsert({
      where: { code: wc.code },
      update: {},
      create: {
        code: wc.code,
        descriptionKo: wc.descriptionKo,
        descriptionEn: wc.descriptionEn,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${wasteCodes.length} waste codes`);

  // Create 30 reason codes
  const reasonCodes = [
    { type: 'CANCEL' as const, code: 'C01', descriptionKo: '고객 요청', descriptionEn: 'Customer Request' },
    { type: 'CANCEL' as const, code: 'C02', descriptionKo: '재고 부족', descriptionEn: 'Out of Stock' },
    { type: 'CANCEL' as const, code: 'C03', descriptionKo: '가격 이의', descriptionEn: 'Price Dispute' },
    { type: 'CANCEL' as const, code: 'C04', descriptionKo: '중복 주문', descriptionEn: 'Duplicate Order' },
    { type: 'CANCEL' as const, code: 'C05', descriptionKo: '제품 불량', descriptionEn: 'Defective Product' },
    { type: 'CANCEL' as const, code: 'C06', descriptionKo: '배송 오류', descriptionEn: 'Delivery Error' },
    { type: 'CANCEL' as const, code: 'C07', descriptionKo: '고객 변심', descriptionEn: 'Customer Changed Mind' },
    { type: 'CANCEL' as const, code: 'C08', descriptionKo: '결제 실패', descriptionEn: 'Payment Failed' },
    { type: 'CANCEL' as const, code: 'C09', descriptionKo: '시스템 오류', descriptionEn: 'System Error' },
    { type: 'CANCEL' as const, code: 'C10', descriptionKo: '기타 취소', descriptionEn: 'Other Cancellation' },
    { type: 'POSTPONE' as const, code: 'D01', descriptionKo: '고객 일정 변경', descriptionEn: 'Customer Schedule Change' },
    { type: 'POSTPONE' as const, code: 'D02', descriptionKo: '배송 지연', descriptionEn: 'Delivery Delay' },
    { type: 'POSTPONE' as const, code: 'D03', descriptionKo: '기상 악화', descriptionEn: 'Bad Weather' },
    { type: 'POSTPONE' as const, code: 'D04', descriptionKo: '재고 입고 대기', descriptionEn: 'Waiting for Stock' },
    { type: 'POSTPONE' as const, code: 'D05', descriptionKo: '설치 환경 미비', descriptionEn: 'Installation Not Ready' },
    { type: 'POSTPONE' as const, code: 'D06', descriptionKo: '기사 사정', descriptionEn: 'Technician Unavailable' },
    { type: 'POSTPONE' as const, code: 'D07', descriptionKo: '교통 상황', descriptionEn: 'Traffic Conditions' },
    { type: 'POSTPONE' as const, code: 'D08', descriptionKo: '휴일 지정', descriptionEn: 'Holiday Designated' },
    { type: 'POSTPONE' as const, code: 'D09', descriptionKo: '장비 고장', descriptionEn: 'Equipment Malfunction' },
    { type: 'POSTPONE' as const, code: 'D10', descriptionKo: '기타 연기', descriptionEn: 'Other Postponement' },
    { type: 'ABSENCE' as const, code: 'A01', descriptionKo: '부재중', descriptionEn: 'Not at Home' },
    { type: 'ABSENCE' as const, code: 'A02', descriptionKo: '연락 불가', descriptionEn: 'Unreachable' },
    { type: 'ABSENCE' as const, code: 'A03', descriptionKo: '주소 오류', descriptionEn: 'Wrong Address' },
    { type: 'ABSENCE' as const, code: 'A04', descriptionKo: '방문 거부', descriptionEn: 'Refused Entry' },
    { type: 'ABSENCE' as const, code: 'A05', descriptionKo: '건물 출입 제한', descriptionEn: 'Building Access Denied' },
    { type: 'ABSENCE' as const, code: 'A06', descriptionKo: '주차 불가', descriptionEn: 'No Parking Available' },
    { type: 'ABSENCE' as const, code: 'A07', descriptionKo: '엘리베이터 고장', descriptionEn: 'Elevator Out of Order' },
    { type: 'ABSENCE' as const, code: 'A08', descriptionKo: '호수 확인 불가', descriptionEn: 'Unit Number Unknown' },
    { type: 'ABSENCE' as const, code: 'A09', descriptionKo: '보안 문제', descriptionEn: 'Security Issue' },
    { type: 'ABSENCE' as const, code: 'A10', descriptionKo: '기타 부재', descriptionEn: 'Other Absence' },
  ];

  for (const rc of reasonCodes) {
    await prisma.reasonCode.upsert({
      where: { code: rc.code },
      update: {},
      create: {
        type: rc.type,
        code: rc.code,
        descriptionKo: rc.descriptionKo,
        descriptionEn: rc.descriptionEn,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${reasonCodes.length} reason codes`);

  // ============================================
  // COMPREHENSIVE TEST DATA
  // ============================================

  // Create 30 Partners
  const partners = [];
  const partnerTypes = ['Electronics', 'Appliances', 'HVAC', 'Home Services', 'Installation'];
  for (let i = 1; i <= 30; i++) {
    const partner = await prisma.partner.upsert({
      where: { code: `PTN${String(i).padStart(2, '0')}` },
      update: {},
      create: {
        code: `PTN${String(i).padStart(2, '0')}`,
        name: `${partnerTypes[i % 5]} Partner ${i}`,
        contactName: `Partner Manager ${i}`,
        phone: `010-${1000 + i}-${2000 + i}`,
        email: `partner${i}@example.com`,
        isActive: i % 10 !== 0, // 10% inactive
      },
    });
    partners.push(partner);
  }
  console.log(`✅ Created ${partners.length} partners`);

  // Create 30 Installers (distributed across partners)
  const installers = [];
  const skillSets = [
    ['AC', 'Refrigerator'],
    ['WashingMachine', 'Dryer'],
    ['AC', 'WashingMachine', 'Refrigerator'],
    ['TV', 'Computer', 'Monitor'],
    ['All'],
  ];
  for (let i = 1; i <= 30; i++) {
    const partnerIdx = (i - 1) % partners.length;
    const branchIdx = (i % (branches.length - 1)) + 1; // Exclude HQ
    const inst = await prisma.installer.upsert({
      where: { id: `installer-${i}` },
      update: {},
      create: {
        id: `installer-${i}`,
        partnerId: partners[partnerIdx].id,
        branchId: branches[branchIdx].id,
        name: `Installer ${String(i).padStart(2, '0')}`,
        phone: `010-3${String(i).padStart(3, '0')}-${4000 + i}`,
        skillTags: skillSets[i % skillSets.length],
        capacityPerDay: 6 + (i % 6),
        isActive: i % 15 !== 0, // ~7% inactive
      },
    });
    installers.push(inst);
  }
  console.log(`✅ Created ${installers.length} installers`);

  // Create orders for each status
  const statuses = [
    'UNASSIGNED',
    'ASSIGNED',
    'CONFIRMED',
    'RELEASED',
    'DISPATCHED',
    'POSTPONED',
    'ABSENT',
    'COMPLETED',
    'PARTIAL',
    'COLLECTED',
    'CANCELLED',
    'REQUEST_CANCEL',
  ] as const;

  const today = new Date();
  const orders = [];
  let orderCounter = 1;

  for (const status of statuses) {
    for (let i = 1; i <= 5; i++) {
      const orderNo = `ORD-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(orderCounter).padStart(4, '0')}`;

      const needsInstaller = !['UNASSIGNED'].includes(status);
      const appointmentDate = new Date(today);
      appointmentDate.setDate(today.getDate() + (i % 7) - 3); // -3 to +3 days

      const order = await prisma.order.upsert({
        where: { orderNo },
        update: {},
        create: {
          orderNo,
          customerName: `Customer ${orderCounter}`,
          customerPhone: `010-5${String(orderCounter).padStart(3, '0')}-${6000 + orderCounter}`,
          address: {
            line1: `${100 + orderCounter} Main Street`,
            line2: `Apt ${orderCounter}`,
            city: 'Seoul',
            postal: `0${String(1000 + orderCounter).slice(1)}`,
          },
          vendor: ['Samsung', 'LG', 'Carrier', 'Whirlpool', 'Bosch'][orderCounter % 5],
          branchId: branches[1].id, // SEL01
          partnerId: needsInstaller ? partners[orderCounter % partners.length].id : null,
          installerId: needsInstaller ? installers[orderCounter % installers.length].id : null,
          status: status as any,
          appointmentDate,
          appointmentTimeWindow: ['09:00-12:00', '12:00-15:00', '15:00-18:00'][orderCounter % 3],
          promisedDate: appointmentDate,
          remarks: status === 'POSTPONED' ? 'Customer requested reschedule' :
                   status === 'ABSENT' ? 'Customer not at home' :
                   status === 'CANCELLED' ? 'Order cancelled by customer' : null,
          version: 1,
        },
      });
      orders.push(order);

      // Create order lines for each order (2-4 items per order)
      const itemCount = 2 + (orderCounter % 3);
      for (let j = 1; j <= itemCount; j++) {
        await prisma.orderLine.create({
          data: {
            orderId: order.id,
            itemCode: `ITEM-${String(j).padStart(3, '0')}`,
            itemName: ['Air Conditioner', 'Refrigerator', 'Washing Machine', 'Dryer'][j % 4],
            quantity: 1 + (j % 2),
            weight: 15.5 + (j * 5),
          },
        });
      }

      // Create status history for orders
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: 'UNASSIGNED',
          newStatus: status as any,
          changedBy: testUser.id,
          notes: `Status changed to ${status}`,
        },
      });

      orderCounter++;
    }
  }
  console.log(`✅ Created ${orders.length} orders with order lines and status history`);

  // Create cancellation records for CANCELLED and REQUEST_CANCEL orders
  const cancelledOrders = orders.filter(o =>
    ['CANCELLED', 'REQUEST_CANCEL'].includes(o.status)
  );

  for (let i = 0; i < cancelledOrders.length; i++) {
    await prisma.cancellationRecord.upsert({
      where: { orderId: cancelledOrders[i].id },
      update: {},
      create: {
        orderId: cancelledOrders[i].id,
        reason: ['CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE', 'WRONG_ADDRESS', 'OTHER'][i % 5],
        note: `Cancellation reason note ${i + 1}`,
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

  // Create waste pickups for COMPLETED orders
  const completedOrders = orders.filter(o =>
    ['COMPLETED', 'COLLECTED'].includes(o.status)
  );

  for (let i = 0; i < completedOrders.length; i++) {
    const wasteCode = wasteCodes[i % wasteCodes.length].code;
    await prisma.wastePickup.upsert({
      where: {
        orderId_code: {
          orderId: completedOrders[i].id,
          code: wasteCode,
        }
      },
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

  // Create serial numbers for COMPLETED orders
  let serialCount = 0;
  for (let i = 0; i < completedOrders.length; i++) {
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
  console.log(`✅ Created ${serialCount} serial numbers for completed orders`);

  // Create settlement period
  const periodStart = new Date(today);
  periodStart.setDate(today.getDate() - today.getDay()); // Start of week
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

  console.log('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
