import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/** Customer profile + visit history (paid bills). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const customer = await prisma.customer.findUnique({
    where: { id: Number(params.id) },
    include: {
      packages: {
        orderBy: { expiresAt: 'asc' },
        include: { plan: { include: { service: { select: { id: true, name: true, minutes: true } } } } },
      },
      vouchers: {
        where: { active: true },
        orderBy: { id: 'desc' },
      },
      bills: {
        where: { status: 'PAID' },
        orderBy: { id: 'desc' },
        take: 20,
        include: { items: { include: { service: { select: { name: true } }, therapist: { select: { name: true } } } } },
      },
    },
  });
  if (!customer) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
  const spent = await prisma.bill.aggregate({ where: { customerId: customer.id, status: 'PAID' }, _sum: { total: true }, _count: true });
  return NextResponse.json({ ...customer, visits: spent._count, totalSpent: spent._sum.total ?? 0 });
}

const body = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  member: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const c = await prisma.customer.update({ where: { id: Number(params.id) }, data: parsed.data });
  return NextResponse.json(c);
}
