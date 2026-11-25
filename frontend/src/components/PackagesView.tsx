'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { baht } from '@/lib/money';
import type { Catalog } from '@/lib/types';

export type PackagePlanItem = {
  id: number;
  name: string;
  description: string | null;
  serviceId: number | null;
  service: { id: number; name: string; minutes: number } | null;
  quotaType: 'SESSIONS' | 'MINUTES';
  totalQuota: number;
  price: number;
  validDays: number;
  _count?: { customerPackages: number };
};

export type CustomerPackageItem = {
  id: number;
  customerId: number;
  planId: number;
  totalQuota: number;
  remainingQuota: number;
  expiresAt: string;
  createdAt: string;
  customer?: { id: number; name: string; phone: string | null };
  plan: PackagePlanItem;
};

export type VoucherItem = {
  id: number;
  code: string;
  initialValue: number;
  remainingValue: number;
  customerId: number | null;
  customer?: { id: number; name: string } | null;
  note: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

type CustomerBasic = { id: number; name: string; phone: string | null };

export function PackagesView({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<'packages' | 'vouchers'>('packages');
  const [plans, setPlans] = useState<PackagePlanItem[]>([]);
  const [soldPkgs, setSoldPkgs] = useState<CustomerPackageItem[]>([]);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [customers, setCustomers] = useState<CustomerBasic[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [toast, setToast] = useState('');

  // Sell package modal / inline state
  const [sellForm, setSellForm] = useState({ customerId: 0, planId: 0 });
  // Create plan state
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    serviceId: '',
    quotaType: 'SESSIONS' as 'SESSIONS' | 'MINUTES',
    totalQuota: '5',
    price: '1500',
    validDays: '180',
  });

  // Voucher create & check state
  const [voucherForm, setVoucherForm] = useState({ code: '', initialValue: '500', customerId: '', note: '', validDays: '180' });
  const [checkCode, setCheckCode] = useState('');
  const [checkedVoucher, setCheckedVoucher] = useState<VoucherItem | null>(null);
  const [checkError, setCheckError] = useState('');

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3200);
  };

  const loadAll = useCallback(async () => {
    const [p, sp, v, c, cat] = await Promise.all([
      fetch('/api/packages').then((r) => r.json()),
      fetch('/api/customer-packages').then((r) => r.json()),
      fetch('/api/vouchers').then((r) => r.json()),
      fetch('/api/customers').then((r) => r.json()),
      fetch('/api/catalog').then((r) => r.json()),
    ]);
    setPlans(p);
    setSoldPkgs(sp);
    setVouchers(v);
    setCustomers(c);
    setCatalog(cat);
    setSellForm((f) => ({
      customerId: f.customerId || c[0]?.id || 0,
      planId: f.planId || p[0]?.id || 0,
    }));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: planForm.name,
        description: planForm.description || undefined,
        serviceId: planForm.serviceId ? Number(planForm.serviceId) : null,
        quotaType: planForm.quotaType,
        totalQuota: Number(planForm.totalQuota),
        price: Number(planForm.price),
        validDays: Number(planForm.validDays),
      }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'สร้างแพ็กเกจไม่สำเร็จ');
    flash('สร้างแพ็กเกจใหม่เรียบร้อย');
    setShowPlanForm(false);
    setPlanForm({ name: '', description: '', serviceId: '', quotaType: 'SESSIONS', totalQuota: '5', price: '1500', validDays: '180' });
    loadAll();
  }

  async function handleSellPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!sellForm.customerId || !sellForm.planId) return flash('กรุณาเลือกลูกค้าและแพ็กเกจ');
    const res = await fetch('/api/customer-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: Number(sellForm.customerId), planId: Number(sellForm.planId) }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'ผูกแพ็กเกจไม่สำเร็จ');
    flash(`เปิดแพ็กเกจให้ ${data.customer?.name} เรียบร้อย`);
    loadAll();
  }

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: voucherForm.code.trim() || undefined,
        initialValue: Number(voucherForm.initialValue),
        customerId: voucherForm.customerId ? Number(voucherForm.customerId) : null,
        note: voucherForm.note || undefined,
        validDays: Number(voucherForm.validDays),
      }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'ออกบัตรกำนัลไม่สำเร็จ');
    flash(`ออกบัตรกำนัล ${data.code} (${baht(data.initialValue, false)}) แล้ว`);
    setVoucherForm({ code: '', initialValue: '500', customerId: '', note: '', validDays: '180' });
    loadAll();
  }

  async function handleCheckVoucher(e: React.FormEvent) {
    e.preventDefault();
    setCheckError('');
    setCheckedVoucher(null);
    if (!checkCode.trim()) return;
    const res = await fetch(`/api/vouchers?code=${encodeURIComponent(checkCode.trim())}`);
    const data = await res.json();
    if (!res.ok) setCheckError(data.error ?? 'ไม่พบบัตรกำนัล');
    else setCheckedVoucher(data);
  }

  const activePkgsCount = soldPkgs.filter((p) => p.remainingQuota > 0 && new Date(p.expiresAt).getTime() > Date.now()).length;
  const activeVouchersValue = vouchers
    .filter((v) => v.active && v.remainingValue > 0 && (!v.expiresAt || new Date(v.expiresAt).getTime() > Date.now()))
    .reduce((n, v) => n + v.remainingValue, 0);

  return (
    <main className="workspace">
      <header className="workspace__head">
        <div>
          <h1>แพ็กเกจและบัตรกำนัล</h1>
          <p>จัดการคอร์สสะสมครั้ง/ชั่วโมง ตรวจสอบวันหมดอายุ และออกรหัสบัตรของขวัญ (Voucher)</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`chip ${tab === 'packages' ? 'is-active' : ''}`}
            onClick={() => setTab('packages')}
          >
            แพ็กเกจคอร์สนวด ({plans.length})
          </button>
          <button
            className={`chip ${tab === 'vouchers' ? 'is-active' : ''}`}
            onClick={() => setTab('vouchers')}
          >
            บัตรกำนัล / Voucher ({vouchers.length})
          </button>
        </div>
      </header>

      {/* Summary KPI bar */}
      <section className="stats">
        <div className="stat">
          <div className="stat__label">แพ็กเกจที่เปิดขาย</div>
          <div className="stat__value">
            <strong>{plans.length}</strong>
            <span>รายการ</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">แพ็กเกจลูกค้าที่ยังใช้งานได้</div>
          <div className="stat__value">
            <strong>{activePkgsCount}</strong>
            <span>สิทธิ์คงเหลือ</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">มูลค่าบัตรกำนัลคงเหลือรวม</div>
          <div className="stat__value">
            <strong>{baht(activeVouchersValue, false)}</strong>
            <span>พร้อมใช้</span>
          </div>
        </div>
      </section>

      {tab === 'packages' ? (
        <div className="mt-7 space-y-6">
          {/* Sell Package & Create Plan Bar */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">รายการแพ็กเกจของร้าน</h2>
                {canManage && (
                  <Button size="sm" variant="secondary" onClick={() => setShowPlanForm((s) => !s)}>
                    {showPlanForm ? 'ปิดฟอร์ม' : '+ สร้างแพ็กเกจใหม่'}
                  </Button>
                )}
              </div>

              {showPlanForm && (
                <form onSubmit={handleCreatePlan} className="mb-4 grid grid-cols-6 gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
                  <label className="col-span-3 space-y-1 font-medium">
                    ชื่อแพ็กเกจ
                    <Input required placeholder="เช่น นวดไทย 10 ครั้ง" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
                  </label>
                  <label className="col-span-3 space-y-1 font-medium">
                    ผูกกับบริการ (เว้นว่าง = ใช้ได้ทุกบริการ)
                    <select className="h-10 w-full rounded-md border border-line bg-white px-2" value={planForm.serviceId} onChange={(e) => setPlanForm({ ...planForm, serviceId: e.target.value })}>
                      <option value="">ทุกบริการในร้าน</option>
                      {catalog?.services.filter((s) => s.minutes > 0).map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.minutes} นาที)</option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 space-y-1 font-medium">
                    รูปแบบการตัดสิทธิ์
                    <select className="h-10 w-full rounded-md border border-line bg-white px-2" value={planForm.quotaType} onChange={(e) => setPlanForm({ ...planForm, quotaType: e.target.value as 'SESSIONS' | 'MINUTES' })}>
                      <option value="SESSIONS">ตัดเป็นจำนวนครั้ง</option>
                      <option value="MINUTES">ตัดตามนาทีสะสม</option>
                    </select>
                  </label>
                  <label className="space-y-1 font-medium">
                    จำนวน ({planForm.quotaType === 'MINUTES' ? 'นาที' : 'ครั้ง'})
                    <Input type="number" min={1} required value={planForm.totalQuota} onChange={(e) => setPlanForm({ ...planForm, totalQuota: e.target.value })} />
                  </label>
                  <label className="space-y-1 font-medium">
                    ราคาแพ็กเกจ (฿)
                    <Input type="number" min={0} required value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
                  </label>
                  <label className="space-y-1 font-medium">
                    อายุใช้งาน (วัน)
                    <Input type="number" min={1} required value={planForm.validDays} onChange={(e) => setPlanForm({ ...planForm, validDays: e.target.value })} />
                  </label>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full">บันทึก</Button>
                  </div>
                  <label className="col-span-6 space-y-1 font-medium">
                    รายละเอียดเพิ่มเติม
                    <Input placeholder="คำอธิบายเงื่อนไขแพ็กเกจ" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
                  </label>
                </form>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {plans.map((p) => {
                  const unit = p.quotaType === 'MINUTES' ? 'นาที' : 'ครั้ง';
                  return (
                    <Card key={p.id} className="flex flex-col justify-between bg-white">
                      <CardHeader>
                        <div>
                          <Badge variant={p.quotaType === 'MINUTES' ? 'info' : 'success'}>
                            {p.quotaType === 'MINUTES' ? `สะสมเวลา ${p.totalQuota} นาที` : `คอร์ส ${p.totalQuota} ครั้ง`}
                          </Badge>
                          <CardTitle className="mt-2 text-lg">{p.name}</CardTitle>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-primary">{baht(p.price, false)}</div>
                          <div className="text-xs text-muted-foreground">อายุ {p.validDays} วัน</div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">{p.description ?? (p.service ? `ใช้กับบริการ ${p.service.name}` : 'ใช้ได้กับทุกคอร์สนวด')}</p>
                        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs text-muted-foreground">
                          <span>เฉลี่ย {baht(Math.round(p.price / p.totalQuota), false)} / {unit}</span>
                          <span>ขายแล้ว {p._count?.customerPackages ?? 0} สิทธิ์</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Quick Assign Package to Customer */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>ขาย / ผูกแพ็กเกจให้ลูกค้า</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSellPackage} className="space-y-3 text-sm">
                  <label className="block space-y-1 font-medium">
                    เลือกลูกค้าสมาชิก
                    <select
                      className="h-10 w-full rounded-md border border-line bg-white px-2"
                      value={sellForm.customerId}
                      onChange={(e) => setSellForm({ ...sellForm, customerId: Number(e.target.value) })}
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 font-medium">
                    เลือกแพ็กเกจ
                    <select
                      className="h-10 w-full rounded-md border border-line bg-white px-2"
                      value={sellForm.planId}
                      onChange={(e) => setSellForm({ ...sellForm, planId: Number(e.target.value) })}
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — {baht(p.price, false)}</option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    เมื่อบันทึกแล้ว ลูกค้าสามารถตัดยอดแพ็กเกจนี้ได้ทันทีที่หน้าขายหน้าร้าน (POS)
                  </p>
                  <Button type="submit" className="w-full">ยืนยันเปิดแพ็กเกจให้ลูกค้า</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Active Customer Packages Table */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-ink">สิทธิ์แพ็กเกจของลูกค้าทั้งหมด</h2>
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3">ลูกค้า</th>
                    <th>แพ็กเกจ</th>
                    <th>ความคืบหน้า / คงเหลือ</th>
                    <th>วันหมดอายุ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {soldPkgs.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-muted-foreground">ยังไม่มีข้อมูลแพ็กเกจลูกค้า</td></tr>
                  )}
                  {soldPkgs.map((cp) => {
                    const unit = cp.plan.quotaType === 'MINUTES' ? 'นาที' : 'ครั้ง';
                    const expired = new Date(cp.expiresAt).getTime() < Date.now();
                    const exhausted = cp.remainingQuota <= 0;
                    const pct = Math.max(0, Math.min(100, Math.round((cp.remainingQuota / cp.totalQuota) * 100)));
                    return (
                      <tr key={cp.id} className="border-t border-line">
                        <td className="p-3 font-medium">
                          {cp.customer?.name}
                          <span className="block text-xs font-normal text-muted-foreground">{cp.customer?.phone ?? ''}</span>
                        </td>
                        <td>{cp.plan.name}</td>
                        <td className="w-64 pr-4">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-primary">เหลือ {cp.remainingQuota} / {cp.totalQuota} {unit}</span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="tabular-nums text-muted-foreground">
                          {new Date(cp.expiresAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          {exhausted ? (
                            <Badge variant="muted">ใช้ครบแล้ว</Badge>
                          ) : expired ? (
                            <Badge variant="danger">หมดอายุ</Badge>
                          ) : (
                            <Badge variant="success">ใช้งานได้</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* Quick Check Voucher Balance */}
            <Card>
              <CardHeader>
                <CardTitle>ตรวจสอบรหัสบัตรกำนัล</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckVoucher} className="flex gap-2">
                  <Input
                    placeholder="กรอกรหัส เช่น LAMUN500 หรือ WELCOME200"
                    value={checkCode}
                    onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                  />
                  <Button type="submit" variant="secondary">ตรวจสอบยอด</Button>
                </form>
                {checkError && <p className="mt-2 text-sm text-red-700">{checkError}</p>}
                {checkedVoucher && (
                  <div className="mt-3 flex items-center justify-between rounded-md border border-primary bg-[#e8efdf] px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold text-primary">{checkedVoucher.code}</div>
                      <div className="text-xs text-ink">
                        {checkedVoucher.note ?? 'บัตรของขวัญ'} · หมดอายุ{' '}
                        {checkedVoucher.expiresAt ? new Date(checkedVoucher.expiresAt).toLocaleDateString('th-TH') : 'ไม่กำหนด'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">ยอดคงเหลือ</div>
                      <div className="text-xl font-semibold text-primary">{baht(checkedVoucher.remainingValue)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vouchers Table */}
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3">รหัส</th>
                    <th>มูลค่าเริ่มต้น</th>
                    <th>ยอดคงเหลือ</th>
                    <th>ผู้ถือบัตร / หมายเหตุ</th>
                    <th>วันหมดอายุ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-muted-foreground">ยังไม่มีบัตรกำนัล</td></tr>
                  )}
                  {vouchers.map((v) => {
                    const expired = v.expiresAt && new Date(v.expiresAt).getTime() < Date.now();
                    const usedUp = v.remainingValue <= 0;
                    return (
                      <tr key={v.id} className="border-t border-line">
                        <td className="p-3 font-mono font-semibold text-primary">{v.code}</td>
                        <td className="tabular-nums text-muted-foreground">{baht(v.initialValue)}</td>
                        <td className="tabular-nums font-semibold">{baht(v.remainingValue)}</td>
                        <td>
                          {v.customer?.name ?? 'ทั่วไป'}
                          {v.note && <span className="block text-xs text-muted-foreground">{v.note}</span>}
                        </td>
                        <td className="tabular-nums text-muted-foreground">
                          {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString('th-TH') : '—'}
                        </td>
                        <td>
                          {usedUp ? (
                            <Badge variant="muted">ใช้ครบแล้ว</Badge>
                          ) : expired ? (
                            <Badge variant="danger">หมดอายุ</Badge>
                          ) : (
                            <Badge variant="success">พร้อมใช้</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Issue New Voucher Form */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>ออกบัตรกำนัลใหม่ (Gift Voucher)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateVoucher} className="space-y-3 text-sm">
                <label className="block space-y-1 font-medium">
                  รหัสบัตร (เว้นว่างเพื่อสุ่มอัตโนมัติ)
                  <Input
                    placeholder="เช่น GIFT1000"
                    value={voucherForm.code}
                    onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                  />
                </label>
                <label className="block space-y-1 font-medium">
                  มูลค่าบัตร (บาท)
                  <Input
                    type="number"
                    min={50}
                    required
                    value={voucherForm.initialValue}
                    onChange={(e) => setVoucherForm({ ...voucherForm, initialValue: e.target.value })}
                  />
                </label>
                <label className="block space-y-1 font-medium">
                  ผูกกับลูกค้า (ไม่บังคับ)
                  <select
                    className="h-10 w-full rounded-md border border-line bg-white px-2"
                    value={voucherForm.customerId}
                    onChange={(e) => setVoucherForm({ ...voucherForm, customerId: e.target.value })}
                  >
                    <option value="">ไม่ระบุ (ใครนำรหัสมาใช้ก็ได้)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 font-medium">
                  อายุบัตร (วัน)
                  <Input
                    type="number"
                    min={1}
                    required
                    value={voucherForm.validDays}
                    onChange={(e) => setVoucherForm({ ...voucherForm, validDays: e.target.value })}
                  />
                </label>
                <label className="block space-y-1 font-medium">
                  หมายเหตุ
                  <Input
                    placeholder="เช่น ของขวัญวันเกิดลูกค้า"
                    value={voucherForm.note}
                    onChange={(e) => setVoucherForm({ ...voucherForm, note: e.target.value })}
                  />
                </label>
                <Button type="submit" className="w-full">ออกรหัสบัตรกำนัล</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
