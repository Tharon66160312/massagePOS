import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PackagesView } from '@/components/PackagesView';

export default async function PackagesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.role;
  const canManage = role === 'OWNER' || role === 'MANAGER';
  return <PackagesView canManage={canManage} />;
}
