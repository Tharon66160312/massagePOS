import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { lineCommission, linePrice } from '@/lib/money';

export const dynamic = 'force-dynamic';

const nextBillNo = async (tx: Prisma.TransactionClient) => {
  const last = await tx.bill.findFirst({ orderBy: { id: 'desc' }, select: { billNo: true } });
  const n = last ? Number(last.billNo.slice(3)) + 1 : 128;
  return `LM-${String(n).padStart(5, '0')}`;
};

export async function GET(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const sp = new URL(req.url).searchParams;
  if (sp.get('next') === '1') {
    return NextResponse.json({ billNo: await nextBillNo(prisma) });
  }
  const status = sp.get('status');
  const bills = await prisma.bill.findMany({
    where: status === 'HELD' || status === 'PAID' ? { status } : undefined,
    orderBy: { id: 'desc' },
    take: 50,
    include: {
      payments: true,
      items: true,
      customer: {
        include: {
          packages: {
            where: { remainingQuota: { gt: 0 }, expiresAt: { gt: new Date() } },
            include: { plan: { include: { service: { select: { id: true, name: true, minutes: true } } } } },
          },
        },
      },
      voucher: true,
    },
  });
  return NextResponse.json(bills);
}

const method = z.enum(['CASH', 'PROMPTPAY', 'CARD']);
const body = z.object({
  status: z.enum(['PAID', 'HELD']),
  customerId: z.number().int().optional(),
  resumeBillId: z.number().int().optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  discount: z.number().int().min(0).default(0),
  voucherCode: z.string().max(32).optional(),
  tip: z.number().int().min(0).default(0),
  tipMethod: method.optional(),
  payments: z.array(z.object({ method, amount: z.number().int().positive() })).default([]),
  items: z
    .array(
      z.object({
        serviceId: z.number().int(),
        minutes: z.number().int().min(0),
        therapistId: z.number().int().optional(),
        roomId: z.number().int().optional(),
        bookingId: z.number().int().optional(),
        customerPackageId: z.number().int().optional(),
        note: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

/**
 * Create a bill. Prices, commissions, package redemptions, and voucher deductions
 * are always validated and recomputed on the server.
 */
export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลบิลไม่ถูกต้อง' }, { status: 400 });
  const b = parsed.data;

  const services = await prisma.service.findMany({ where: { id: { in: b.items.map((i) => i.serviceId) }, active: true } });
  const byId = new Map(services.map((s) => [s.id, s]));

  // Pre-fetch referenced customer packages
  const pkgIds = [...new Set(b.items.flatMap((i) => (i.customerPackageId ? [i.customerPackageId] : [])))];
  const pkgs = pkgIds.length
    ? await prisma.customerPackage.findMany({ where: { id: { in: pkgIds } }, include: { plan: true } })
    : [];
  const pkgById = new Map(pkgs.map((p) => [p.id, p]));
  const quotaTally = new Map<number, number>();

  const lines: (z.infer<typeof body>['items'][number] & { price: number; commission: number; quotaUsed: number })[] = [];
  for (const it of b.items) {
    const s = byId.get(it.serviceId);
    if (!s) return NextResponse.json({ error: `ไม่พบบริการ ${it.serviceId}` }, { status: 400 });

    let price = linePrice(s, it.minutes);
    const commission = lineCommission(s, it.minutes);
    let quotaUsed = 0;

    if (it.customerPackageId) {
      const cp = pkgById.get(it.customerPackageId);
      if (!cp) return NextResponse.json({ error: 'ไม่พบแพ็กเกจของลูกค้า' }, { status: 400 });
      if (b.customerId && cp.customerId !== b.customerId)
        return NextResponse.json({ error: 'แพ็กเกจไม่ตรงกับลูกค้าที่เลือก' }, { status: 400 });
      if (cp.expiresAt.getTime() < Date.now())
        return NextResponse.json({ error: `แพ็กเกจ "${cp.plan.name}" หมดอายุแล้ว` }, { status: 400 });
      if (cp.plan.serviceId && cp.plan.serviceId !== s.id)
        return NextResponse.json({ error: `แพ็กเกจ "${cp.plan.name}" ใช้กับบริการนี้ไม่ได้` }, { status: 400 });

      quotaUsed = cp.plan.quotaType === 'MINUTES' ? (it.minutes || s.minutes) : 1;
      const usedSoFar = (quotaTally.get(cp.id) ?? 0) + quotaUsed;
      if (usedSoFar > cp.remainingQuota)
        return NextResponse.json({ error: `สิทธิ์คงเหลือของ "${cp.plan.name}" ไม่พอ` }, { status: 400 });
      quotaTally.set(cp.id, usedSoFar);
      price = 0;
    }

    lines.push({ ...it, price, commission, quotaUsed });
  }

  const subtotal = lines.reduce((n, l) => n + l.price, 0);
  const discount = Math.min(b.discount, subtotal);
  const afterDiscount = subtotal - discount;

  let voucher: { id: number; code: string; remainingValue: number } | null = null;
  let voucherAmount = 0;
  if (b.voucherCode?.trim()) {
    const code = b.voucherCode.trim().toUpperCase();
    const v = await prisma.voucher.findUnique({ where: { code } });
    if (!v || !v.active) return NextResponse.json({ error: 'ไม่พบรหัสบัตรกำนัล' }, { status: 400 });
    if (v.expiresAt && v.expiresAt.getTime() < Date.now())
      return NextResponse.json({ error: 'บัตรกำนัลหมดอายุแล้ว' }, { status: 400 });
    if (v.remainingValue <= 0)
      return NextResponse.json({ error: 'บัตรกำนัลนี้ใช้ยอดครบแล้ว' }, { status: 400 });
    voucher = v;
    voucherAmount = Math.min(v.remainingValue, afterDiscount);
  }

  const total = afterDiscount - voucherAmount;

  if (b.status === 'PAID') {
    const paid = b.payments.reduce((n, p) => n + p.amount, 0);
    if (paid !== total)
      return NextResponse.json({ error: `ยอดชำระ (${paid}) ไม่ตรงกับยอดสุทธิ (${total})` }, { status: 400 });
    if (b.tip > 0 && !b.tipMethod) return NextResponse.json({ error: 'ระบุช่องทางรับทิป' }, { status: 400 });
  }

  const createBill = () =>
    prisma.$transaction(async (tx) => {
      if (b.resumeBillId) {
        const held = await tx.bill.findUnique({ where: { id: b.resumeBillId } });
        if (!held || held.status !== 'HELD') throw new Error('RESUME_INVALID');
        await tx.bill.delete({ where: { id: held.id } });
      }
      if (b.status === 'PAID') {
        for (const [cpId, deduct] of quotaTally.entries()) {
          const fresh = await tx.customerPackage.findUnique({ where: { id: cpId } });
          if (!fresh || fresh.remainingQuota < deduct) throw new Error('QUOTA_INSUFFICIENT');
          await tx.customerPackage.update({
            where: { id: cpId },
            data: { remainingQuota: { decrement: deduct } },
          });
        }
        if (voucher && voucherAmount > 0) {
          const freshV = await tx.voucher.findUnique({ where: { id: voucher.id } });
          if (!freshV || freshV.remainingValue < voucherAmount) throw new Error('VOUCHER_INSUFFICIENT');
          await tx.voucher.update({
            where: { id: voucher.id },
            data: { remainingValue: { decrement: voucherAmount } },
          });
        }
      }

      const created = await tx.bill.create({
        data: {
          billNo: await nextBillNo(tx),
          status: b.status,
          subtotal,
          discount,
          voucherId: voucher ? voucher.id : null,
          voucherAmount,
          total,
          tip: b.status === 'PAID' ? b.tip : 0,
          tipMethod: b.status === 'PAID' && b.tip > 0 ? b.tipMethod : null,
          createdById: auth.session.user.id,
          customerId:
            b.customerId ??
            (b.customerName
              ? (
                  b.customerPhone
                    ? await tx.customer.upsert({
                        where: { phone: b.customerPhone },
                        update: { name: b.customerName },
                        create: { name: b.customerName, phone: b.customerPhone, member: true },
                      })
                    : await tx.customer.create({ data: { name: b.customerName } })
                ).id
              : undefined),
          items: { create: lines },
          payments: b.status === 'PAID' && b.payments.length > 0 ? { create: b.payments } : undefined,
        },
      });
      if (b.status === 'PAID') {
        for (const it of lines) {
          // auto-deduct retail inventory when a linked product service is sold
          const inv = await tx.inventoryItem.findUnique({ where: { serviceId: it.serviceId } });
          if (inv) {
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { stock: { decrement: 1 } },
            });
            await tx.stockMovement.create({
              data: { itemId: inv.id, type: 'SALE', delta: -1, note: `ขายหน้าร้าน` },
            });
          }
          if (!it.bookingId) continue;
          const bk = await tx.booking.update({ where: { id: it.bookingId }, data: { status: 'DONE' } });
          await tx.room.update({ where: { id: bk.roomId }, data: { status: 'CLEANING' } });
          await tx.therapist.update({ where: { id: bk.therapistId }, data: { status: 'AVAILABLE' } });
        }
      }
      return created;
    });

  let bill;
  try {
    bill = await createBill();
  } catch (e) {
    if (e instanceof Error && e.message === 'RESUME_INVALID')
      return NextResponse.json({ error: 'บิลที่พักไว้ไม่ถูกต้องหรือถูกใช้ไปแล้ว' }, { status: 409 });
    if (e instanceof Error && (e.message === 'QUOTA_INSUFFICIENT' || e.message === 'VOUCHER_INSUFFICIENT'))
      return NextResponse.json({ error: 'สิทธิ์แพ็กเกจหรือยอดบัตรกำนัลไม่เพียงพอ' }, { status: 409 });
    throw e;
  }
  return NextResponse.json({ id: bill.id, billNo: bill.billNo, status: bill.status, total, voucherAmount }, { status: 201 });
}
