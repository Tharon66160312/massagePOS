import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Public catalog for customer self-service online booking (main courses only). */
export async function GET() {
  const [services, therapists] = await Promise.all([
    prisma.service.findMany({
      where: { active: true, minutes: { gt: 0 } },
      select: { id: true, name: true, description: true, minutes: true, price: true, category: true, tint: true },
      orderBy: { id: 'asc' },
    }),
    prisma.therapist.findMany({
      select: { id: true, name: true, specialty: true, years: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return NextResponse.json({ services, therapists });
}

const body = z.object({
  serviceId: z.number().int(),
  therapistId: z.number().int().optional(), // optional: auto-assign first available therapist
  startsAt: z.string().datetime({ offset: true }),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(6).max(30),
  source: z.enum(['WEB', 'LINE_OA']).default('WEB'),
  note: z.string().max(300).optional(),
});

/** Public customer booking endpoint — auto-picks an open room (and therapist if not specified). */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'กรุณากรอกชื่อ เบอร์โทร และวันเวลาให้ครบถ้วน' }, { status: 400 });
  const b = parsed.data;

  const service = await prisma.service.findFirst({ where: { id: b.serviceId, active: true, minutes: { gt: 0 } } });
  if (!service) return NextResponse.json({ error: 'ไม่พบคอร์สนวดที่เลือก' }, { status: 400 });

  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.minutes * 60_000);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const overlapping = await tx.booking.findMany({
          where: {
            status: { in: ['BOOKED', 'IN_SERVICE'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { therapistId: true, roomId: true },
        });
        const busyTherapists = new Set(overlapping.map((o) => o.therapistId));
        const busyRooms = new Set(overlapping.map((o) => o.roomId));

        let therapistId = b.therapistId;
        if (therapistId) {
          if (busyTherapists.has(therapistId)) throw new Error('CLASH_THERAPIST');
        } else {
          const allTherapists = await tx.therapist.findMany({ orderBy: { id: 'asc' } });
          const freeT = allTherapists.find((t) => !busyTherapists.has(t.id));
          if (!freeT) throw new Error('NO_THERAPIST');
          therapistId = freeT.id;
        }

        const allRooms = await tx.room.findMany({ orderBy: { id: 'asc' } });
        const freeRoom = allRooms.find((r) => !busyRooms.has(r.id));
        if (!freeRoom) throw new Error('NO_ROOM');

        const customer = await tx.customer.upsert({
          where: { phone: b.customerPhone.trim() },
          update: { name: b.customerName.trim() },
          create: { name: b.customerName.trim(), phone: b.customerPhone.trim(), member: true },
        });

        return tx.booking.create({
          data: {
            serviceId: service.id,
            therapistId,
            roomId: freeRoom.id,
            customerId: customer.id,
            startsAt,
            endsAt,
            source: b.source,
            note: b.note || null,
          },
          include: {
            service: { select: { name: true, minutes: true, price: true } },
            therapist: { select: { name: true } },
            room: { select: { name: true } },
          },
        });
      },
    );

    return NextResponse.json(
      {
        bookingNo: `BK-${String(result.id).padStart(4, '0')}`,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        service: result.service,
        therapist: result.therapist.name,
        room: result.room.name,
      },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'CLASH_THERAPIST')
      return NextResponse.json({ error: 'หมอนวดที่เลือกติดคิวในช่วงเวลานี้ กรุณาเลือกเวลาอื่นหรือให้ร้านจัดคิวให้' }, { status: 409 });
    if (msg === 'NO_THERAPIST')
      return NextResponse.json({ error: 'หมอนวดเต็มทุกท่านในช่วงเวลานี้ กรุณาเลือกเวลาอื่น' }, { status: 409 });
    if (msg === 'NO_ROOM')
      return NextResponse.json({ error: 'ห้อง/เตียงเต็มในช่วงเวลานี้ กรุณาเลือกเวลาอื่น' }, { status: 409 });
    throw e;
  }
}
