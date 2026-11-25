import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const plans = await prisma.packagePlan.findMany({
    where: { active: true },
    include: { service: { select: { id: true, name: true, minutes: true } }, _count: { select: { customerPackages: true } } },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json(plans);
}

const body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  serviceId: z.number().int().nullable().optional(),
  quotaType: z.enum(['SESSIONS', 'MINUTES']).default('SESSIONS'),
  totalQuota: z.number().int().positive(),
  price: z.number().int().min(0),
  validDays: z.number().int().positive().default(180),
});

export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแพ็กเกจไม่ถูกต้อง' }, { status: 400 });
  const plan = await prisma.packagePlan.create({
    data: { ...parsed.data, serviceId: parsed.data.serviceId || null },
    include: { service: { select: { id: true, name: true, minutes: true } }, _count: { select: { customerPackages: true } } },
  });
  return NextResponse.json(plan, { status: 201 });
}
