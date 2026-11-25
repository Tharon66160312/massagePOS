import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

/** Mark a room as available after cleaning. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = z.object({ status: z.enum(['AVAILABLE', 'CLEANING']) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  const room = await prisma.room.update({ where: { id: Number(params.id) }, data: parsed.data });
  return NextResponse.json(room);
}
