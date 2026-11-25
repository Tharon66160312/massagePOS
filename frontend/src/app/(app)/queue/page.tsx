import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { QueueBoard } from '@/components/QueueBoard';

export default async function QueuePage() {
  const session = await getServerSession(authOptions);
  return <QueueBoard role={session!.user.role} />;
}
