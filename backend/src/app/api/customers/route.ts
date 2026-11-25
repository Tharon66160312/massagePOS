import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const q = new URL(req.url).searchParams.get('q')?.trim();
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : undefined,
    include: {
      packages: {
        where: { remainingQuota: { gt: 0 }, expiresAt: { gt: new Date() } },
        include: { plan: { include: { service: { select: { id: true, name: true, minutes: true } } } } },
      },
    },
    orderBy: { id: 'desc' },
    take: 30,
  });
  return NextResponse.json(customers);
}

const body = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(30).optional(),
  member: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
  allergies: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลลูกค้าไม่ถูกต้อง' }, { status: 400 });
  try {
    const c = await prisma.customer.create({ data: { ...parsed.data, phone: parsed.data.phone || undefined } });
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return NextResponse.json({ error: 'เบอร์โทรนี้มีในระบบแล้ว' }, { status: 409 });
    throw e;
  }
}
