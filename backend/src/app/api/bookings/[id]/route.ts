import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

const body = z.object({ status: z.enum(['IN_SERVICE', 'DONE', 'CANCELLED']) });

/** Move a booking through its lifecycle and keep room/therapist status in sync. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF', 'THERAPIST']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  const id = Number(params.id);
  const { status } = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: 'ไม่พบการจอง' }, { status: 404 });
  if (booking.status === 'DONE' || booking.status === 'CANCELLED')
    return NextResponse.json({ error: 'การจองนี้จบแล้ว' }, { status: 409 });

  const [updated] = await prisma.$transaction([
    prisma.booking.update({ where: { id }, data: { status } }),
    prisma.room.update({
      where: { id: booking.roomId },
      data: { status: status === 'IN_SERVICE' ? 'IN_USE' : status === 'DONE' ? 'CLEANING' : 'AVAILABLE' },
    }),
    prisma.therapist.update({
      where: { id: booking.therapistId },
      data: { status: status === 'IN_SERVICE' ? 'IN_SERVICE' : 'AVAILABLE' },
    }),
  ]);
  return NextResponse.json(updated);
}
