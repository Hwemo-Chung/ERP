import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create branches
  const branches = await Promise.all([
    prisma.branch.upsert({
      where: { code: 'HQ' },
      update: {},
      create: {
        code: 'HQ',
        name: 'Headquarters',
        region: 'Seoul',
        timezone: 'Asia/Seoul',
      },
    }),
    prisma.branch.upsert({
      where: { code: 'SEL01' },
      update: {},
      create: {
        code: 'SEL01',
        name: 'Seoul Branch 1',
        region: 'Seoul',
        timezone: 'Asia/Seoul',
      },
    }),
    prisma.branch.upsert({
      where: { code: 'GGN01' },
      update: {},
      create: {
        code: 'GGN01',
        name: 'Gyeonggi Branch 1',
        region: 'Gyeonggi',
        timezone: 'Asia/Seoul',
      },
    }),
  ]);

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

  // Create waste codes (P01-P21)
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

  // Create reason codes (10 total)
  const reasonCodes = [
    { type: 'CANCEL' as const, code: 'C01', descriptionKo: '고객 요청', descriptionEn: 'Customer Request' },
    { type: 'CANCEL' as const, code: 'C02', descriptionKo: '재고 부족', descriptionEn: 'Out of Stock' },
    { type: 'CANCEL' as const, code: 'C03', descriptionKo: '가격 이의', descriptionEn: 'Price Dispute' },
    { type: 'CANCEL' as const, code: 'C04', descriptionKo: '중복 주문', descriptionEn: 'Duplicate Order' },
    { type: 'POSTPONE' as const, code: 'D01', descriptionKo: '고객 일정 변경', descriptionEn: 'Customer Schedule Change' },
    { type: 'POSTPONE' as const, code: 'D02', descriptionKo: '배송 지연', descriptionEn: 'Delivery Delay' },
    { type: 'POSTPONE' as const, code: 'D03', descriptionKo: '기상 악화', descriptionEn: 'Bad Weather' },
    { type: 'ABSENCE' as const, code: 'A01', descriptionKo: '부재중', descriptionEn: 'Not at Home' },
    { type: 'ABSENCE' as const, code: 'A02', descriptionKo: '연락 불가', descriptionEn: 'Unreachable' },
    { type: 'ABSENCE' as const, code: 'A03', descriptionKo: '주소 오류', descriptionEn: 'Wrong Address' },
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

  // Create 10 Partners
  const partners = [];
  for (let i = 1; i <= 10; i++) {
    const partner = await prisma.partner.upsert({
      where: { code: `PTN${String(i).padStart(2, '0')}` },
      update: {},
      create: {
        code: `PTN${String(i).padStart(2, '0')}`,
        name: `Partner Company ${i}`,
        contactName: `Partner Manager ${i}`,
        phone: `010-${1000 + i}-${2000 + i}`,
        email: `partner${i}@example.com`,
        isActive: true,
      },
    });
    partners.push(partner);
  }
  console.log(`✅ Created ${partners.length} partners`);

  // Create 5 Installers per partner (25 total)
  const installers = [];
  for (let p = 0; p < partners.length; p++) {
    for (let i = 1; i <= 5; i++) {
      const installerNum = p * 5 + i;
      const inst = await prisma.installer.upsert({
        where: { id: `installer-${installerNum}` },
        update: {},
        create: {
          id: `installer-${installerNum}`,
          partnerId: partners[p].id,
          branchId: branches[1].id, // SEL01
          name: `Installer ${String(installerNum).padStart(2, '0')}`,
          phone: `010-3${String(installerNum).padStart(3, '0')}-${4000 + installerNum}`,
          skillTags: ['AC', 'Refrigerator', 'WashingMachine'].slice(0, (installerNum % 3) + 1),
          capacityPerDay: 8 + (installerNum % 5),
          isActive: true,
        },
      });
      installers.push(inst);
    }
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
