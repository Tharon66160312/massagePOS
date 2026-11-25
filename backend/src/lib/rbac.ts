import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { ACCESS_CLIENT, ROLE_LABEL_CLIENT, type Role } from './roles';

export const ROLE_LABEL = ROLE_LABEL_CLIENT;
export const ACCESS = ACCESS_CLIENT;

export async function requireRole(roles: Role[]) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role) {
    if (!roles.includes(session.user.role))
      return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์ใช้งาน' }, { status: 403 }) } as const;
    return { session } as const;
  }

  const h = headers();
  const headerRole = h.get('x-user-role') as Role | null;
  const headerUid = h.get('x-user-id') ?? 'system';
  if (headerRole && ['OWNER', 'MANAGER', 'STAFF', 'THERAPIST'].includes(headerRole)) {
    if (!roles.includes(headerRole))
      return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์ใช้งาน' }, { status: 403 }) } as const;
    return {
      session: { user: { id: headerUid, role: headerRole, name: h.get('x-user-name') ?? '' } },
    } as const;
  }

  return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) } as const;
}
