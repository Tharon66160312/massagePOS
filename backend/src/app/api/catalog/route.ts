import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF', 'THERAPIST']);
  if ('error' in auth) return auth.error;
  const [services, therapists, rooms] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } }),
    prisma.therapist.findMany({ orderBy: { id: 'asc' } }),
    prisma.room.findMany({ orderBy: { id: 'asc' } }),
  ]);
  // commission rules are internal: don't ship them to the cashier UI
  return NextResponse.json({
    services: services.map(({ commissionType, commissionValue, ...s }) => s),
    therapists,
    rooms,
  });
}
