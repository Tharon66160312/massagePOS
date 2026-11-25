import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { InventoryView } from '@/components/InventoryView';

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.role;
  return <InventoryView canManage={role === 'OWNER' || role === 'MANAGER'} />;
}
