'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { baht } from '@/lib/money';
import type { CustomerPackageItem, PackagePlanItem, VoucherItem } from './PackagesView';

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  member: boolean;
  notes: string | null;
  allergies: string | null;
  packages?: CustomerPackageItem[];
};
type Detail = Customer & {
  visits: number;
  totalSpent: number;
  packages: CustomerPackageItem[];
  vouchers: VoucherItem[];
  bills: { id: number; billNo: string; total: number; createdAt: string; items: { id: number; minutes: number; service: { name: string }; therapist: { name: string } | null }[] }[];
};

export function CustomersView() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<PackagePlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number>(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState({ notes: '', allergies: '' });
  const [form, setForm] = useState({ name: '', phone: '' });
  const [toast, setToast] = useState('');
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(() => fetch(`/api/customers?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setList), [q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch('/api/packages')
      .then((r) => r.json())
      .then((p: PackagePlanItem[]) => {
        setPlans(p);
        if (p[0]) setSelectedPlanId(p[0].id);
      })
      .catch(() => {});
  }, []);

  async function open(id: number) {
    const d: Detail = await fetch(`/api/customers/${id}`).then((r) => r.json());
    setDetail(d);
    setDraft({ notes: d.notes ?? '', allergies: d.allergies ?? '' });
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, phone: form.phone || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'บันทึกไม่สำเร็จ');
    setForm({ name: '', phone: '' });
    load();
    open(data.id);
  }
  async function save() {
    if (!detail) return;
    const res = await fetch(`/api/customers/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: draft.notes || null, allergies: draft.allergies || null }),
    });
    flash(res.ok ? 'บันทึกแล้ว' : 'บันทึกไม่สำเร็จ');
    load();
  }
  async function assignPackage() {
    if (!detail || !selectedPlanId) return;
    const res = await fetch('/api/customer-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: detail.id, planId: selectedPlanId }),
    });
    if (!res.ok) return flash('เพิ่มแพ็กเกจไม่สำเร็จ');
    flash('เปิดแพ็กเกจให้ลูกค้าเรียบร้อย');
    open(detail.id);
    load();
  }

  return (
    <main className="workspace">
      <header className="workspace__head">
        <div>
          <h1>ลูกค้าและสมาชิก</h1>
          <p>ประวัติการใช้บริการ แพ็กเกจสะสม จุดที่ปวด และอาการแพ้</p>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-[380px_1fr] gap-4">
        <div className="space-y-3">
          <Input placeholder="ค้นหาชื่อหรือเบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} />
          <form onSubmit={create} className="flex gap-2">
            <Input placeholder="ชื่อ" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="เบอร์โทร" className="w-36" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Button type="submit">เพิ่ม</Button>
          </form>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">ไม่พบลูกค้า</p>}
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c.id)}
                className={`flex w-full items-center justify-between border-b border-line p-3 text-left last:border-0 hover:bg-muted ${detail?.id === c.id ? 'bg-muted' : ''}`}
              >
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.phone ?? '—'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {c.packages && c.packages.length > 0 && <Badge variant="info">{c.packages.length} แพ็กเกจ</Badge>}
                  {c.allergies && <Badge variant="danger">แพ้</Badge>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {detail ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-xl">{detail.name}</CardTitle>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {detail.phone ?? 'ไม่มีเบอร์โทร'} · มาใช้บริการ {detail.visits} ครั้ง · ยอดสะสม {baht(detail.totalSpent)}
                  </div>
                </div>
                {detail.member && <Badge variant="success">สมาชิก</Badge>}
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="block space-y-1 font-medium">
                    อาการแพ้ (น้ำมัน/สมุนไพร)
                    <textarea
                      className="h-20 w-full rounded-md border border-line bg-white p-2 font-normal"
                      placeholder="เช่น แพ้น้ำมันยูคาลิปตัส, แพ้พิมเสน"
                      value={draft.allergies}
                      onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 font-medium">
                    จุดที่ปวด / อาการบาดเจ็บ / ความชอบ
                    <textarea
                      className="h-20 w-full rounded-md border border-line bg-white p-2 font-normal"
                      placeholder="เช่น เน้นคอ บ่า ไหล่ น้ำหนักมือปานกลาง"
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตาม PDPA เก็บเท่าที่จำเป็นและได้รับความยินยอม</span>
                  <Button onClick={save}>บันทึกข้อมูลสุขภาพ</Button>
                </div>
              </CardContent>
            </Card>

            {/* Customer Packages Card */}
            <Card>
              <CardHeader>
                <CardTitle>แพ็กเกจสะสมของลูกค้า</CardTitle>
                {plans.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-line bg-white px-2 text-xs"
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({baht(p.price, false)})
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="secondary" onClick={assignPackage}>
                      + เปิดแพ็กเกจ
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {detail.packages.length === 0 && <p className="text-muted-foreground">ลูกค้ายังไม่มีแพ็กเกจสะสม</p>}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {detail.packages.map((cp) => {
                    const unit = cp.plan.quotaType === 'MINUTES' ? 'นาที' : 'ครั้ง';
                    const expired = new Date(cp.expiresAt).getTime() < Date.now();
                    const pct = Math.max(0, Math.min(100, Math.round((cp.remainingQuota / cp.totalQuota) * 100)));
                    return (
                      <div key={cp.id} className="rounded-md border border-line bg-white p-3">
                        <div className="flex items-start justify-between">
                          <div className="font-semibold text-ink">{cp.plan.name}</div>
                          {cp.remainingQuota <= 0 ? (
                            <Badge variant="muted">ใช้ครบแล้ว</Badge>
                          ) : expired ? (
                            <Badge variant="danger">หมดอายุ</Badge>
                          ) : (
                            <Badge variant="success">คงเหลือ {cp.remainingQuota} {unit}</Badge>
                          )}
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                          <span>ทั้งหมด {cp.totalQuota} {unit}</span>
                          <span>หมดอายุ {new Date(cp.expiresAt).toLocaleDateString('th-TH')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Visit History */}
            <Card>
              <CardHeader>
                <CardTitle>ประวัติการใช้บริการ</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {detail.bills.length === 0 && <p className="text-muted-foreground">ยังไม่มีประวัติ</p>}
                {detail.bills.map((b) => (
                  <div key={b.id} className="flex justify-between border-t border-line py-2 first:border-0">
                    <span>
                      <span className="text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString('th-TH')} · {b.billNo}
                      </span>
                      <span className="block">
                        {b.items.map((i) => `${i.service.name}${i.therapist ? ` (${i.therapist.name})` : ''}`).join(', ')}
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">{baht(b.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="pt-4 text-sm text-muted-foreground">เลือกลูกค้าจากรายการทางซ้ายเพื่อดูรายละเอียดและแพ็กเกจคงเหลือ</p>
        )}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
