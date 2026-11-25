'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { baht } from '@/lib/money';

type PublicService = { id: number; name: string; description: string | null; minutes: number; price: number; category: string; tint: string | null };
type PublicTherapist = { id: number; name: string; specialty: string | null; years: number };
type Confirmed = {
  bookingNo: string;
  startsAt: string;
  endsAt: string;
  service: { name: string; minutes: number; price: number };
  therapist: string;
  room: string;
};

const defaultSlot = () => {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function PublicBookingPage() {
  const [services, setServices] = useState<PublicService[]>([]);
  const [therapists, setTherapists] = useState<PublicTherapist[]>([]);
  const [serviceId, setServiceId] = useState<number>(0);
  const [therapistId, setTherapistId] = useState<string>(''); // '' = auto-assign
  const [startsAt, setStartsAt] = useState(defaultSlot());
  const [source, setSource] = useState<'WEB' | 'LINE_OA'>('LINE_OA');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  useEffect(() => {
    fetch('/api/public/booking')
      .then((r) => r.json())
      .then((d: { services: PublicService[]; therapists: PublicTherapist[] }) => {
        setServices(d.services);
        setTherapists(d.therapists);
        if (d.services[0]) setServiceId(d.services[0].id);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await fetch('/api/public/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId,
        therapistId: therapistId ? Number(therapistId) : undefined,
        startsAt: new Date(startsAt).toISOString(),
        customerName,
        customerPhone,
        source,
        note: note || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'จองคิวไม่สำเร็จ');
    setConfirmed(data);
  }

  return (
    <div className="min-h-screen bg-secondary px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="text-4xl font-semibold text-primary">ละมุน</div>
          <div className="text-xs tracking-widest text-muted-foreground">LAMUN MASSAGE · สาขาอารีย์</div>
          <h1 className="mt-3 text-2xl font-semibold text-ink">จองคิวนวดออนไลน์</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            เลือกคอร์สที่ต้องการ ระบบจะเช็คห้องและหมอนวดว่างแบบ Real-time ทันที
          </p>
        </div>

        {confirmed ? (
          <Card className="mx-auto max-w-lg bg-white p-2">
            <CardHeader>
              <CardTitle className="text-xl text-primary">จองคิวสำเร็จแล้ว</CardTitle>
              <Badge variant="success">{confirmed.bookingNo}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg bg-secondary p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">คอร์สบริการ</span>
                  <span className="font-semibold">{confirmed.service.name} ({confirmed.service.minutes} นาที)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันและเวลา</span>
                  <span className="font-semibold">
                    {new Date(confirmed.startsAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">หมอนวด / ห้อง</span>
                  <span>{confirmed.therapist} · {confirmed.room}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted-foreground">ราคาโดยประมาณ</span>
                  <span className="text-base font-semibold text-primary">{baht(confirmed.service.price)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                กรุณามาถึงร้านก่อนเวลานัด 10 นาที หากต้องการเลื่อนนัดสามารถแจ้งรหัส {confirmed.bookingNo} กับหน้าร้านได้เลยครับ
              </p>
              <Button className="w-full" onClick={() => setConfirmed(null)}>
                จองคิวเพิ่มอีกรายการ
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>1. เลือกคอร์สนวด</CardTitle>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`chip !h-8 !px-3 !text-xs ${source === 'LINE_OA' ? 'is-active' : ''}`}
                    onClick={() => setSource('LINE_OA')}
                  >
                    จองผ่าน LINE OA
                  </button>
                  <button
                    type="button"
                    className={`chip !h-8 !px-3 !text-xs ${source === 'WEB' ? 'is-active' : ''}`}
                    onClick={() => setSource('WEB')}
                  >
                    จองผ่านเว็บไซต์
                  </button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {services.map((s) => {
                  const active = s.id === serviceId;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setServiceId(s.id)}
                      className={`flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all ${active ? 'border-2 border-primary bg-[#f5f7f0]' : 'border-line bg-white hover:bg-muted'}`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink">{s.name}</span>
                          <Badge variant={active ? 'default' : 'muted'}>{s.minutes} นาที</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                      </div>
                      <div className="mt-3 text-base font-semibold text-primary">{baht(s.price, false)}</div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>2. เลือกวันเวลาและหมอนวด</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                <label className="space-y-1.5 font-medium">
                  วันและเวลาที่ต้องการเข้ารับบริการ
                  <Input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </label>
                <label className="space-y-1.5 font-medium">
                  เลือกหมอนวด
                  <select
                    className="h-10 w-full rounded-md border border-line bg-white px-3"
                    value={therapistId}
                    onChange={(e) => setTherapistId(e.target.value)}
                  >
                    <option value="">ให้ทางร้านจัดคิวหมอนวดที่ว่างให้ (แนะนำ)</option>
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (ถนัด{t.specialty} · ประสบการณ์ {t.years} ปี)
                      </option>
                    ))}
                  </select>
                </label>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>3. ข้อมูลผู้จอง</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 font-medium">
                    ชื่อ - นามสกุล (หรือชื่อเล่น)
                    <Input required placeholder="คุณศิริพร" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </label>
                  <label className="space-y-1.5 font-medium">
                    เบอร์โทรศัพท์ติดต่อ
                    <Input required placeholder="081-234-5678" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  </label>
                </div>
                <label className="block space-y-1.5 font-medium">
                  หมายเหตุถึงหมอนวด (จุดที่ต้องการเน้น หรืออาการแพ้)
                  <Input
                    placeholder="เช่น เน้นคอ บ่า ไหล่ / แพ้น้ำมันกลิ่นยูคาลิปตัส"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-md bg-[#f6dcd8] px-3 py-2 text-sm text-[#7a1f15]">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? 'กำลังตรวจสอบคิวว่าง…' : 'ยืนยันการจองคิว'}
                </Button>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </div>
  );
}
