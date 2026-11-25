import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const customerId = Number(new URL(req.url).searchParams.get('customerId'));
  const pkgs = await prisma.customerPackage.findMany({
    where: customerId ? { customerId } : undefined,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      plan: { include: { service: { select: { id: true, name: true, minutes: true } } } },
    },
    orderBy: { id: 'desc' },
    take: 50,
  });
  return NextResponse.json(pkgs);
}

const body = z.object({
  customerId: z.number().int(),
  planId: z.number().int(),
});

/** Assign / sell a package plan to a customer. */
export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const plan = await prisma.packagePlan.findFirst({ where: { id: parsed.data.planId, active: true } });
  if (!plan) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });

  const expiresAt = new Date(Date.now() + plan.validDays * 86_400_000);
  const cp = await prisma.customerPackage.create({
    data: {
      customerId: parsed.data.customerId,
      planId: plan.id,
      totalQuota: plan.totalQuota,
      remainingQuota: plan.totalQuota,
      expiresAt,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      plan: { include: { service: { select: { id: true, name: true, minutes: true } } } },
    },
  });
  return NextResponse.json(cp, { status: 201 });
}
