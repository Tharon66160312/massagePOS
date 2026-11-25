import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { bangkokDayRange, bangkokMonthRange } from '@/lib/board';

export const dynamic = 'force-dynamic';

/** Daily shift-close or Monthly in-depth summary + therapist commission + gross profit. Owner/Manager only. */
export async function GET(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER']);
  if ('error' in auth) return auth.error;
  const sp = new URL(req.url).searchParams;
  const period = sp.get('period') === 'month' ? 'month' : 'day';
  const range =
    period === 'month'
      ? bangkokMonthRange(sp.get('month') ?? undefined)
      : bangkokDayRange(sp.get('date') ?? undefined);

  const [bills, soldPackages, issuedVouchers] = await Promise.all([
    prisma.bill.findMany({
      where: { status: 'PAID', createdAt: { gte: range.start, lt: range.end } },
      include: {
        items: { include: { service: { select: { name: true, category: true } }, therapist: { select: { name: true } } } },
        payments: true,
      },
    }),
    prisma.customerPackage.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
      include: { plan: { select: { price: true } } },
    }),
    prisma.voucher.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
    }),
  ]);

  const byMethod: Record<string, number> = { CASH: 0, PROMPTPAY: 0, CARD: 0 };
  const tipByMethod: Record<string, number> = { CASH: 0, PROMPTPAY: 0, CARD: 0 };
  const byService = new Map<string, { count: number; revenue: number; commission: number }>();
  const byHour = new Array<number>(24).fill(0);
  const therapists = new Map<
    number,
    { name: string; services: number; minutes: number; revenue: number; commission: number; tips: number }
  >();

  let totalCommissions = 0;
  let packageRedemptions = 0;
  let voucherRedeemedAmount = 0;

  for (const bill of bills) {
    for (const p of bill.payments) byMethod[p.method] += p.amount;
    if (bill.tip && bill.tipMethod) tipByMethod[bill.tipMethod] += bill.tip;
    voucherRedeemedAmount += bill.voucherAmount ?? 0;
    byHour[new Date(bill.createdAt.getTime() + 7 * 3600_000).getUTCHours()] += bill.total;

    const staff = new Set<number>();
    for (const it of bill.items) {
      totalCommissions += it.commission;
      if (it.customerPackageId) packageRedemptions += 1;
      const s = byService.get(it.service.name) ?? { count: 0, revenue: 0, commission: 0 };
      s.count += 1;
      s.revenue += it.price;
      s.commission += it.commission;
      byService.set(it.service.name, s);
      if (it.therapistId && it.therapist) {
        staff.add(it.therapistId);
        const t = therapists.get(it.therapistId) ?? {
          name: it.therapist.name,
          services: 0,
          minutes: 0,
          revenue: 0,
          commission: 0,
          tips: 0,
        };
        t.services += 1;
        t.minutes += it.minutes;
        t.revenue += it.price;
        t.commission += it.commission;
        therapists.set(it.therapistId, t);
      }
    }
    if (bill.tip > 0 && staff.size > 0) {
      const ids = [...staff];
      const share = Math.floor(bill.tip / ids.length);
      ids.forEach((id, i) => {
        therapists.get(id)!.tips += share + (i === 0 ? bill.tip - share * ids.length : 0);
      });
    }
  }

  const revenue = bills.reduce((n, b) => n + b.total, 0);
  const packageSalesRevenue = soldPackages.reduce((n, p) => n + p.plan.price, 0);
  const voucherSalesRevenue = issuedVouchers.reduce((n, v) => n + v.initialValue, 0);
  const grossProfit = revenue + packageSalesRevenue - totalCommissions;

  return NextResponse.json({
    period,
    label: 'day' in range ? range.day : range.month,
    bills: bills.length,
    revenue,
    discounts: bills.reduce((n, b) => n + b.discount, 0),
    totalCommissions,
    grossProfit,
    packageSalesCount: soldPackages.length,
    packageSalesRevenue,
    packageRedemptions,
    voucherIssuedCount: issuedVouchers.length,
    voucherSalesRevenue,
    voucherRedeemedAmount,
    byMethod,
    tipByMethod,
    services: [...byService].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
    byHour,
    therapists: [...therapists.values()].map((t) => ({ ...t, payout: t.commission + t.tips })),
  });
}
