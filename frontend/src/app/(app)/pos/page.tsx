import { Suspense } from 'react';
import { PosScreen } from '@/components/PosScreen';

export default function PosPage() {
  return (
    <Suspense fallback={null}>
      <PosScreen />
    </Suspense>
  );
}
