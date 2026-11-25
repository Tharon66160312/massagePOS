import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.service.count()) > 0) {
    console.log('already seeded');
    return;
  }
  await prisma.service.createMany({
    data: [
      { name: 'นวดไทย', description: 'คลายเส้น ผ่อนคลายทั้งร่างกาย', minutes: 60, price: 350, category: 'นวดไทย', tint: '#e9eedf' },
      { name: 'นวดอโรมา', description: 'สัมผัสอ่อนโยน พร้อมน้ำมันหอม', minutes: 60, price: 650, category: 'นวดน้ำมัน', tint: '#f2eadd' },
      { name: 'นวดเท้า', description: 'เติมความเบาสบายให้ทุกก้าว', minutes: 60, price: 350, category: 'นวดเฉพาะจุด', tint: '#e8ede7' },
      { name: 'นวดคอ บ่า ไหล่', description: 'ผ่อนคลายความล้าจากการทำงาน', minutes: 30, price: 250, category: 'นวดเฉพาะจุด', tint: '#eee8e1' },
      { name: 'นวดประคบสมุนไพร', description: 'อุ่นสบาย ด้วยสมุนไพรไทย', minutes: 90, price: 750, category: 'นวดไทย', tint: '#eae9d8' },
      { name: 'นวดน้ำมันมะพร้าว', description: 'บำรุงผิว พร้อมคลายความตึง', minutes: 60, price: 550, category: 'นวดน้ำมัน', tint: '#e9eee7' },
      // add-ons: minutes = 0 means flat price, fixed commission
      { name: 'น้ำมันอโรมา (เสริม)', description: 'เพิ่มน้ำมันหอมระเหย', minutes: 0, price: 100, category: 'บริการเสริม', tint: '#f2eadd', commissionType: 'FIXED', commissionValue: 20 },
      { name: 'ลูกประคบสมุนไพร (เสริม)', description: 'เพิ่มประคบร้อน', minutes: 0, price: 150, category: 'บริการเสริม', tint: '#eae9d8', commissionType: 'FIXED', commissionValue: 30 },
      // retail products: minutes = 0, category = 'สินค้าปลีก', no therapist commission
      { name: 'ยาหม่องสมุนไพรละมุน 50g', description: 'บาล์มสมุนไพรสูตรเย็น ซื้อกลับบ้าน', minutes: 0, price: 180, category: 'สินค้าปลีก', tint: '#e8efdf', commissionType: 'FIXED', commissionValue: 15 },
      { name: 'น้ำมันนวดอโรมา ขวดกลับบ้าน', description: 'กลิ่นตะไคร้หอม 120ml', minutes: 0, price: 320, category: 'สินค้าปลีก', tint: '#f2eadd', commissionType: 'FIXED', commissionValue: 25 },
      { name: 'ชาสมุนไพรมะตูม-ขิง (กล่อง)', description: 'บรรจุ 15 ซอง ชงดื่มผ่อนคลาย', minutes: 0, price: 150, category: 'สินค้าปลีก', tint: '#eee8e1', commissionType: 'FIXED', commissionValue: 10 },
    ],
  });
  // default commission: 40% of price (edit per service via the DB / future admin page)
  const t = await Promise.all(
    [['พี่อ้อย', 'นวดไทย', 5], ['พี่นิด', 'อโรมา', 4], ['พี่แอน', 'นวดเท้า', 3]].map(([name, specialty, years]) =>
      prisma.therapist.create({ data: { name: name as string, specialty: specialty as string, years: years as number } }),
    ),
  );
  await prisma.room.createMany({ data: ['เตียง 01', 'เตียง 02', 'เตียง 03', 'เตียง 04'].map((name) => ({ name })) });

  // Demo accounts — change these passwords before going live!
  const pw = (p: string) => bcrypt.hashSync(p, 10);
  await prisma.user.createMany({
    data: [
      { email: 'owner@lamun.local', name: 'เจ้าของร้าน', role: 'OWNER', passwordHash: pw('owner1234') },
      { email: 'manager@lamun.local', name: 'ผู้จัดการ', role: 'MANAGER', passwordHash: pw('manager1234') },
      { email: 'ploy@lamun.local', name: 'คุณพลอย', role: 'STAFF', passwordHash: pw('staff1234') },
    ],
  });
  await prisma.user.create({
    data: { email: 'aoy@lamun.local', name: 'พี่อ้อย', role: 'THERAPIST', passwordHash: pw('therapist1234'), therapistId: t[0].id },
  });

  const thaiSvc = await prisma.service.findFirst({ where: { name: 'นวดไทย' } });
  const aromaSvc = await prisma.service.findFirst({ where: { name: 'นวดอโรมา' } });
  const p1 = await prisma.packagePlan.create({
    data: { name: 'แพ็กเกจนวดไทย 5 ครั้ง (แถม 1)', description: 'นวดไทย 60 นาที รวม 6 ครั้ง อายุ 180 วัน', serviceId: thaiSvc?.id, quotaType: 'SESSIONS', totalQuota: 6, price: 1750, validDays: 180 },
  });
  const p2 = await prisma.packagePlan.create({
    data: { name: 'แพ็กเกจนวดอโรมา 5 ครั้ง', description: 'นวดอโรมา 60 นาที 5 ครั้ง ประหยัด ฿350', serviceId: aromaSvc?.id, quotaType: 'SESSIONS', totalQuota: 5, price: 2900, validDays: 180 },
  });
  await prisma.packagePlan.create({
    data: { name: 'แพ็กเกจสะสมเวลา 600 นาที', description: 'ใช้ได้กับทุกคอร์สนวด หักตามนาทีจริง อายุ 365 วัน', quotaType: 'MINUTES', totalQuota: 600, price: 3200, validDays: 365 },
  });

  const cust = await prisma.customer.create({
    data: { name: 'คุณศิริพร ใจดี', phone: '081-234-5678', member: true, notes: 'เน้นคอ บ่า ไหล่ น้ำหนักมือปานกลาง', allergies: 'แพ้น้ำมันกลิ่นยูคาลิปตัส' },
  });
  await prisma.customerPackage.createMany({
    data: [
      { customerId: cust.id, planId: p1.id, totalQuota: p1.totalQuota, remainingQuota: 4, expiresAt: new Date(Date.now() + 150 * 86_400_000) },
      { customerId: cust.id, planId: p2.id, totalQuota: p2.totalQuota, remainingQuota: 5, expiresAt: new Date(Date.now() + 180 * 86_400_000) },
    ],
  });
  await prisma.voucher.createMany({
    data: [
      { code: 'LAMUN500', initialValue: 500, remainingValue: 500, customerId: cust.id, note: 'บัตรของขวัญปีใหม่', expiresAt: new Date(Date.now() + 180 * 86_400_000) },
      { code: 'WELCOME200', initialValue: 200, remainingValue: 200, note: 'คูปองต้อนรับลูกค้าใหม่', expiresAt: new Date(Date.now() + 90 * 86_400_000) },
    ],
  });

  const balmSvc = await prisma.service.findFirst({ where: { name: 'ยาหม่องสมุนไพรละมุน 50g' } });
  const oilRetailSvc = await prisma.service.findFirst({ where: { name: 'น้ำมันนวดอโรมา ขวดกลับบ้าน' } });
  const teaSvc = await prisma.service.findFirst({ where: { name: 'ชาสมุนไพรมะตูม-ขิง (กล่อง)' } });

  await prisma.inventoryItem.createMany({
    data: [
      { sku: 'RET-BALM50', name: 'ยาหม่องสมุนไพรละมุน 50g', kind: 'RETAIL', unit: 'กระปุก', stock: 24, minStock: 8, cost: 75, price: 180, serviceId: balmSvc?.id },
      { sku: 'RET-OIL120', name: 'น้ำมันนวดอโรมา ขวดกลับบ้าน 120ml', kind: 'RETAIL', unit: 'ขวด', stock: 6, minStock: 8, cost: 140, price: 320, serviceId: oilRetailSvc?.id },
      { sku: 'RET-TEA15', name: 'ชาสมุนไพรมะตูม-ขิง (กล่อง)', kind: 'RETAIL', unit: 'กล่อง', stock: 18, minStock: 5, cost: 65, price: 150, serviceId: teaSvc?.id },
      { sku: 'CON-AROMA1L', name: 'น้ำมันอโรมาเกรดสปา (แกลลอน 1 ลิตร)', kind: 'CONSUMABLE', unit: 'ขวด', stock: 4, minStock: 5, cost: 420, price: 0 },
      { sku: 'CON-HERBBALL', name: 'ลูกประคบสมุนไพรสด', kind: 'CONSUMABLE', unit: 'ลูก', stock: 12, minStock: 15, cost: 45, price: 0 },
      { sku: 'CON-TOWEL', name: 'ผ้าเช็ดตัวผืนใหญ่ (ซักพร้อมใช้)', kind: 'CONSUMABLE', unit: 'ผืน', stock: 45, minStock: 20, cost: 120, price: 0 },
      { sku: 'CON-UNIFORM', name: 'ชุดนวดไทยสำหรับลูกค้า (ฟรีไซส์)', kind: 'CONSUMABLE', unit: 'ชุด', stock: 30, minStock: 15, cost: 190, price: 0 },
    ],
  });
  console.log('seeded');
}

main().finally(() => prisma.$disconnect());
