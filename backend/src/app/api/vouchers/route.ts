import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const sp = new URL(req.url).searchParams;
  const code = sp.get('code')?.trim().toUpperCase();
  if (code) {
    const v = await prisma.voucher.findUnique({
      where: { code },
      include: { customer: { select: { id: true, name: true } } },
    });
    if (!v || !v.active) return NextResponse.json({ error: 'ไม่พบรหัสบัตรกำนัล' }, { status: 404 });
    if (v.expiresAt && v.expiresAt.getTime() < Date.now())
      return NextResponse.json({ error: 'บัตรกำนัลหมดอายุแล้ว' }, { status: 400 });
    if (v.remainingValue <= 0)
      return NextResponse.json({ error: 'บัตรกำนัลนี้ใช้ยอดครบแล้ว' }, { status: 400 });
    return NextResponse.json(v);
  }
  const vouchers = await prisma.voucher.findMany({
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { id: 'desc' },
    take: 50,
  });
  return NextResponse.json(vouchers);
}

const body = z.object({
  code: z.string().min(3).max(32).optional(),
  initialValue: z.number().int().positive(),
  customerId: z.number().int().nullable().optional(),
  note: z.string().max(200).optional(),
  validDays: z.number().int().positive().default(180),
});

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'LMN-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลบัตรกำนัลไม่ถูกต้อง' }, { status: 400 });
  const code = (parsed.data.code?.trim().toUpperCase()) || genCode();
  const expiresAt = new Date(Date.now() + parsed.data.validDays * 86_400_000);
  try {
    const v = await prisma.voucher.create({
      data: {
        code,
        initialValue: parsed.data.initialValue,
        remainingValue: parsed.data.initialValue,
        customerId: parsed.data.customerId || null,
        note: parsed.data.note || null,
        expiresAt,
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    return NextResponse.json(v, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return NextResponse.json({ error: 'รหัสบัตรกำนัลนี้ซ้ำในระบบ' }, { status: 409 });
    throw e;
  }
}
