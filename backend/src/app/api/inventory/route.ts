import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { active: true }, orderBy: [{ kind: 'asc' }, { id: 'asc' }] }),
    prisma.stockMovement.findMany({
      orderBy: { id: 'desc' },
      take: 30,
      include: { item: { select: { name: true, sku: true, unit: true } } },
    }),
  ]);
  return NextResponse.json({ items, movements });
}

const createBody = z.object({
  sku: z.string().min(2).max(40),
  name: z.string().min(1).max(120),
  kind: z.enum(['RETAIL', 'CONSUMABLE']),
  unit: z.string().min(1).max(20).default('ชิ้น'),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
  cost: z.number().int().min(0).default(0),
  price: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER']);
  if ('error' in auth) return auth.error;
  const parsed = createBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลสต็อกไม่ถูกต้อง' }, { status: 400 });
  const d = parsed.data;
  try {
    const item = await prisma.$transaction(async (tx) => {
      let serviceId: number | undefined;
      if (d.kind === 'RETAIL' && d.price > 0) {
        const svc = await tx.service.create({
          data: {
            name: d.name,
            description: `สินค้าปลีก (${d.sku})`,
            minutes: 0,
            price: d.price,
            category: 'สินค้าปลีก',
            tint: '#e8efdf',
            commissionType: 'FIXED',
            commissionValue: 0,
          },
        });
        serviceId = svc.id;
      }
      return tx.inventoryItem.create({
        data: { ...d, sku: d.sku.toUpperCase(), serviceId },
      });
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return NextResponse.json({ error: 'รหัสสินค้า (SKU) นี้ซ้ำในระบบ' }, { status: 409 });
    throw e;
  }
}

const moveBody = z.object({
  itemId: z.number().int(),
  type: z.enum(['RESTOCK', 'ISSUE', 'ADJUST']),
  quantity: z.number().int().positive(),
  note: z.string().max(200).optional(),
});

/** Record stock movement (restock in or issue consumables out). */
export async function PATCH(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = moveBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลการปรับสต็อกไม่ถูกต้อง' }, { status: 400 });
  const { itemId, type, quantity, note } = parsed.data;
  const delta = type === 'ISSUE' ? -quantity : quantity;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findUnique({ where: { id: itemId } });
      if (!current) throw new Error('NOT_FOUND');
      if (current.stock + delta < 0) throw new Error('INSUFFICIENT');
      await tx.stockMovement.create({
        data: { itemId, type, delta, note: note || null },
      });
      return tx.inventoryItem.update({
        where: { id: itemId },
        data: { stock: { increment: delta } },
      });
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === 'INSUFFICIENT')
      return NextResponse.json({ error: 'สต็อกคงเหลือไม่พอให้เบิก' }, { status: 400 });
    return NextResponse.json({ error: 'ไม่พบรายการสต็อก' }, { status: 404 });
  }
}
