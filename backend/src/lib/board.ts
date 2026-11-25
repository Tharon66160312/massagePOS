import { prisma } from './prisma';

/** Start/end of a Bangkok calendar day for a YYYY-MM-DD string (default: today). */
export function bangkokDayRange(date?: string) {
  const day = date ?? new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00+07:00`);
  return { day, start, end: new Date(start.getTime() + 86_400_000) };
}

/** Start/end of a Bangkok calendar month for a YYYY-MM string. */
export function bangkokMonthRange(month?: string) {
  const m = month ?? new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const start = new Date(`${m}-01T00:00:00+07:00`);
  const nextMonth = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  const end = new Date(`${nextMonth}-01T00:00:00+07:00`);
  return { month: m, start, end };
}

/** Snapshot used by the queue board (REST + SSE). */
export async function getBoard() {
  const { start, end } = bangkokDayRange();
  const [rooms, therapists, bookings] = await Promise.all([
    prisma.room.findMany({ orderBy: { id: 'asc' } }),
    prisma.therapist.findMany({ orderBy: { id: 'asc' } }),
    prisma.booking.findMany({
      where: { startsAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      include: { service: { select: { name: true, minutes: true } }, therapist: { select: { name: true } }, room: { select: { name: true } }, customer: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);
  return { now: new Date().toISOString(), rooms, therapists, bookings };
}
