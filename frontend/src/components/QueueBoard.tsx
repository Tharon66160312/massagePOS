'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Board, BoardBooking, Catalog, Room } from '@/lib/types';

const ROOM_BADGE: Record<Room['status'], { label: string; variant: 'success' | 'danger' | 'info' | 'warning' }> = {
  AVAILABLE: { label: 'ว่าง', variant: 'success' },
  IN_USE: { label: 'กำลังใช้งาน', variant: 'danger' },
  RESERVED: { label: 'จองล่วงหน้า', variant: 'info' },
  CLEANING: { label: 'รอทำความสะอาด', variant: 'warning' },
};
const THERAPIST_BADGE = { AVAILABLE: ['ว่าง', 'success'], IN_SERVICE: ['กำลังนวด', 'danger'], OFF_SHIFT: ['พัก/นอกกะ', 'muted'] } as const;
const BOOKING_BADGE = { BOOKED: ['จองแล้ว', 'info'], IN_SERVICE: ['กำลังให้บริการ', 'danger'], DONE: ['เสร็จสิ้น', 'success'], CANCELLED: ['ยกเลิก', 'muted'] } as const;
const SOURCE_LABEL = { WALK_IN: 'หน้าร้าน', PHONE: 'โทรศัพท์', LINE_OA: 'LINE OA', WEB: 'เว็บไซต์' } as const;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function QueueBoard({ role }: { role: Role }) {
  const canBook = role !== 'THERAPIST';
  const [board, setBoard] = useState<Board | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    serviceId: 0,
    therapistId: 0,
    roomId: 0,
    startsAt: toLocalInput(new Date()),
    customerName: '',
    source: 'WALK_IN' as 'WALK_IN' | 'PHONE' | 'LINE_OA' | 'WEB',
  });

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // live board via SSE (falls back to the browser's automatic reconnect)
  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.onmessage = (e) => setBoard(JSON.parse(e.data));
    return () => es.close();
  }, []);
  useEffect(() => {
    fetch('/api/catalog').then((r) => r.json()).then((c: Catalog) => {
      setCatalog(c);
      setForm((f) => ({ ...f, serviceId: c.services[0]?.id ?? 0, therapistId: c.therapists[0]?.id ?? 0, roomId: c.rooms[0]?.id ?? 0 }));
    });
  }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function refresh() { setBoard(await fetch('/api/bookings').then((r) => r.json())); }
  async function patch(url: string, status: string) {
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!res.ok) flash((await res.json()).error ?? 'ทำรายการไม่สำเร็จ');
    refresh();
  }
  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), customerName: form.customerName || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'จองไม่สำเร็จ');
    flash('จองคิวเรียบร้อย');
    setForm({ ...form, customerName: '' });
    refresh();
  }

  const active = (roomId: number) => board?.bookings.find((b) => b.roomId === roomId && b.status === 'IN_SERVICE');
  const upcoming = (roomId: number) => board?.bookings.find((b) => b.roomId === roomId && b.status === 'BOOKED');

  return (
    <main className="workspace">
      <header className="workspace__head">
        <div>
          <h1>การจองและคิว</h1>
          <p>สถานะห้อง หมอนวด และคิววันนี้ อัปเดตอัตโนมัติ (รองรับทั้งหน้าร้าน โทรศัพท์ LINE OA และเว็บ)</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/book" target="_blank">หน้าจองคิวออนไลน์ (ลูกค้า) ↗</Link>
        </Button>
      </header>

      <h2 className="mb-3 mt-8 text-lg font-semibold">ห้อง / เตียง</h2>
      <div className="grid grid-cols-4 gap-3">
        {board?.rooms.map((room) => {
          const cur = active(room.id);
          const nxt = upcoming(room.id);
          const remaining = cur ? new Date(cur.endsAt).getTime() - now : 0;
          const badge = ROOM_BADGE[room.status === 'AVAILABLE' && nxt ? 'RESERVED' : room.status];
          return (
            <Card key={room.id} className={cur && remaining < 5 * 60_000 ? 'border-[#c0392b]' : ''}>
              <CardHeader><CardTitle>{room.name}</CardTitle><Badge variant={badge.variant}>{badge.label}</Badge></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {cur ? (
                  <>
                    <div className="text-ink">{cur.service.name} · {cur.therapist.name}</div>
                    <div className={`mt-1 text-2xl font-semibold tabular-nums ${remaining < 5 * 60_000 ? 'text-[#c0392b]' : 'text-primary'}`}>{clock(remaining)}</div>
                    {remaining <= 0 && <div className="text-[#c0392b]">หมดเวลาแล้ว</div>}
                    {remaining > 0 && remaining < 5 * 60_000 && <div className="text-[#c0392b]">ใกล้หมดเวลา</div>}
                  </>
                ) : nxt ? (
                  <div>คิวถัดไป {fmtTime(nxt.startsAt)} · {nxt.service.name}</div>
                ) : <div>—</div>}
                {room.status === 'CLEANING' && canBook && (
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => patch(`/api/rooms/${room.id}`, 'AVAILABLE')}>ทำความสะอาดแล้ว</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">หมอนวด</h2>
      <div className="grid grid-cols-3 gap-3">
        {board?.therapists.map((t) => {
          const [label, v] = THERAPIST_BADGE[t.status];
          return (
            <Card key={t.id}>
              <CardHeader><CardTitle>{t.name}</CardTitle><Badge variant={v}>{label}</Badge></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{t.specialty} · {t.years} ปี</CardContent>
            </Card>
          );
        })}
      </div>

      {canBook && catalog && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">จองคิวใหม่</h2>
          <form onSubmit={createBooking} className="grid grid-cols-6 items-end gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
            <label className="col-span-2 space-y-1">บริการ
              <select className="h-10 w-full rounded-md border border-line bg-white px-2" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: Number(e.target.value) })}>
                {catalog.services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.minutes} นาที)</option>)}
              </select>
            </label>
            <label className="space-y-1">หมอนวด
              <select className="h-10 w-full rounded-md border border-line bg-white px-2" value={form.therapistId} onChange={(e) => setForm({ ...form, therapistId: Number(e.target.value) })}>
                {catalog.therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">ห้อง
              <select className="h-10 w-full rounded-md border border-line bg-white px-2" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: Number(e.target.value) })}>
                {catalog.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="col-span-2 space-y-1">เวลาเริ่ม
              <Input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label className="col-span-2 space-y-1">ชื่อลูกค้า (ไม่บังคับ)
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </label>
            <label className="col-span-2 space-y-1">ช่องทางจอง
              <select className="h-10 w-full rounded-md border border-line bg-white px-2" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as typeof form.source })}>
                <option value="WALK_IN">หน้าร้าน (Walk-in)</option>
                <option value="PHONE">โทรศัพท์</option>
                <option value="LINE_OA">LINE OA</option>
                <option value="WEB">เว็บไซต์</option>
              </select>
            </label>
            <div className="col-span-2 flex justify-end"><Button type="submit">จองคิว</Button></div>
          </form>
        </>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">คิววันนี้</h2>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr><th className="p-3">เวลา</th><th>บริการ</th><th>หมอนวด</th><th>ห้อง</th><th>ลูกค้า</th><th>สถานะ</th><th /></tr>
          </thead>
          <tbody>
            {board?.bookings.length === 0 && <tr><td colSpan={7} className="p-4 text-muted-foreground">ยังไม่มีคิววันนี้</td></tr>}
            {board?.bookings.map((b: BoardBooking) => {
              const [label, v] = BOOKING_BADGE[b.status];
              return (
                <tr key={b.id} className="border-t border-line">
                  <td className="p-3 tabular-nums">{fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}</td>
                  <td>{b.service.name}</td><td>{b.therapist.name}</td><td>{b.room.name}</td>
                  <td>
                    {b.customer?.name ?? '—'}
                    {b.source && <span className="ml-1.5 text-xs text-muted-foreground">({SOURCE_LABEL[b.source]})</span>}
                  </td>
                  <td><Badge variant={v}>{label}</Badge></td>
                  <td className="flex justify-end gap-2 p-2">
                    {b.status === 'BOOKED' && <Button size="sm" variant="secondary" onClick={() => patch(`/api/bookings/${b.id}`, 'IN_SERVICE')}>เริ่มบริการ</Button>}
                    {b.status === 'IN_SERVICE' && canBook && <Button size="sm" asChild><Link href={`/pos?booking=${b.id}`}>ชำระเงิน</Link></Button>}
                    {b.status === 'IN_SERVICE' && !canBook && <Button size="sm" variant="secondary" onClick={() => patch(`/api/bookings/${b.id}`, 'DONE')}>เสร็จสิ้น</Button>}
                    {b.status === 'BOOKED' && canBook && <Button size="sm" variant="ghost" onClick={() => patch(`/api/bookings/${b.id}`, 'CANCELLED')}>ยกเลิก</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
