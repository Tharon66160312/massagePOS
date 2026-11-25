'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-secondary lg:grid-cols-[640px_1fr]">
      <div className="hidden flex-col justify-center bg-primary px-16 text-primary-foreground lg:flex">
        <div className="text-6xl font-semibold">ละมุน</div>
        <div className="mt-1 text-sm tracking-widest opacity-80">LAMUN MASSAGE</div>
        <p className="mt-10 max-w-sm text-lg opacity-90">ให้ทุกการพักผ่อน เริ่มต้นอย่างราบรื่น</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg bg-surface p-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-ink">เข้าสู่ระบบ</h1>
            <p className="mt-1 text-sm text-muted-foreground">สำหรับเจ้าของร้าน ผู้จัดการ พนักงาน และหมอนวด</p>
          </div>
          <label className="block space-y-1.5 text-sm font-medium text-ink">
            อีเมล
            <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-ink">
            รหัสผ่าน
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
      </div>
    </div>
  );
}
