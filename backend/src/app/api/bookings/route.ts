import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { getBoard } from '@/lib/board';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF', 'THERAPIST']);
  if ('error' in auth) return auth.error;
  return NextResponse.json(await getBoard());
}

const body = z.object({
  serviceId: z.number().int(),
  therapistId: z.number().int(),
  roomId: z.number().int(),
  startsAt: z.string().datetime({ offset: true }),
  minutes: z.number().int().positive().optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  source: z.enum(['WALK_IN', 'PHONE', 'LINE_OA', 'WEB']).default('WALK_IN'),
  note: z.string().max(300).optional(),
});

/** Create a booking. Rejects overlaps for the same therapist or room (409). */
export async function POST(req: Request) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลการจองไม่ถูกต้อง' }, { status: 400 });
  const b = parsed.data;

  const service = await prisma.service.findFirst({ where: { id: b.serviceId, active: true } });
  if (!service) return NextResponse.json({ error: 'ไม่พบบริการ' }, { status: 400 });
  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(startsAt.getTime() + (b.minutes ?? service.minutes) * 60_000);

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const clash = await tx.booking.findFirst({
          where: {
            status: { in: ['BOOKED', 'IN_SERVICE'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
            OR: [{ therapistId: b.therapistId }, { roomId: b.roomId }],
          },
        });
        if (clash) throw new Error(clash.therapistId === b.therapistId ? 'CLASH_THERAPIST' : 'CLASH_ROOM');

        let customerId: number | undefined;
        if (b.customerName) {
          const c = b.customerPhone
            ? await tx.customer.upsert({
                where: { phone: b.customerPhone },
                update: { name: b.customerName },
                create: { name: b.customerName, phone: b.customerPhone },
              })
            : await tx.customer.create({ data: { name: b.customerName } });
          customerId = c.id;
        }
        return tx.booking.create({
          data: {
            serviceId: b.serviceId,
            therapistId: b.therapistId,
            roomId: b.roomId,
            startsAt,
            endsAt,
            customerId,
            source: b.source,
            note: b.note || null,
          },
        });
      },
    );
    return NextResponse.json(booking, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'CLASH_THERAPIST') return NextResponse.json({ error: 'หมอนวดไม่ว่างในช่วงเวลานี้' }, { status: 409 });
    if (msg === 'CLASH_ROOM') return NextResponse.json({ error: 'ห้อง/เตียงไม่ว่างในช่วงเวลานี้' }, { status: 409 });
    // serialization failure under concurrent writes
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')
      return NextResponse.json({ error: 'มีการจองพร้อมกัน กรุณาลองใหม่' }, { status: 409 });
    throw e;
  }
}
