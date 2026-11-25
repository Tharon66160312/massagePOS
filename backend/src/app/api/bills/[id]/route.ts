import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/** Get full bill details for the 80mm thermal receipt page in frontend. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(['OWNER', 'MANAGER', 'STAFF']);
  if ('error' in auth) return auth.error;
  const bill = await prisma.bill.findUnique({
    where: { id: Number(params.id) },
    include: {
      customer: true,
      voucher: true,
      payments: true,
      items: {
        include: {
          service: { select: { name: true } },
          therapist: { select: { name: true } },
          customerPackage: { include: { plan: { select: { name: true, quotaType: true } } } },
        },
      },
    },
  });
  if (!bill) return NextResponse.json({ error: 'ไม่พบบิล' }, { status: 404 });
  return NextResponse.json(bill);
}
