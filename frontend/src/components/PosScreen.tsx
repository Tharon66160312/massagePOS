'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { baht, linePrice } from '@/lib/money';
import { PAY_ICON, PAY_LABEL, type BoardBooking, type Catalog, type PayMethod, type Service } from '@/lib/types';
import type { CustomerPackageItem, VoucherItem } from './PackagesView';

const CATEGORIES = ['ทั้งหมด', 'นวดไทย', 'นวดน้ำมัน', 'นวดเฉพาะจุด', 'บริการเสริม', 'สินค้าปลีก', 'แพ็กเกจ'];
const OFFLINE_QUEUE_KEY = 'lamun_pos_offline_bills_v1';
const DURATIONS = [30, 60, 90, 120];
const METHODS: PayMethod[] = ['CASH', 'PROMPTPAY', 'CARD'];

type Line = {
  uid: number;
  service: Service;
  minutes: number;
  therapistId?: number;
  roomId?: number;
  bookingId?: number;
  customerPackageId?: number;
  note: string;
};
let uid = 1;

type Picked = {
  id: number;
  name: string;
  phone: string | null;
  allergies: string | null;
  notes: string | null;
  packages?: CustomerPackageItem[];
};
type HeldBill = {
  id: number;
  billNo: string;
  discount: number;
  customer: Picked | null;
  items: {
    serviceId: number;
    minutes: number;
    therapistId: number | null;
    roomId: number | null;
    bookingId: number | null;
    customerPackageId: number | null;
    note: string | null;
  }[];
};

const Icon = ({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) => (
  <img src={`/icons/${name}.svg`} alt="" width={size} height={size} className={className} />
);

function Select({
  value,
  onChange,
  children,
  className = '',
  extra,
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`select ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      {extra}
      <Icon name="chevron" size={17} className="select__chev" />
    </div>
  );
}

export function PosScreen() {
  const params = useSearchParams();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const [billNo, setBillNo] = useState('…');
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [split, setSplit] = useState(false);
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [amounts, setAmounts] = useState<Record<PayMethod, string>>({ CASH: '', PROMPTPAY: '', CARD: '' });
  const [tip, setTip] = useState('');
  const [tipMethod, setTipMethod] = useState<PayMethod>('CASH');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [lastBillId, setLastBillId] = useState<number | null>(null);
  const [discount, setDiscount] = useState('');
  const [held, setHeld] = useState<HeldBill[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [matches, setMatches] = useState<Picked[]>([]);

  // Voucher state
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherItem | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<Record<string, unknown>[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? '[]');
      if (Array.isArray(saved)) setOfflineQueue(saved);
    } catch { /* ignore */ }
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function syncOfflineBills() {
    if (!offlineQueue.length) return;
    setBusy(true);
    const remaining: Record<string, unknown>[] = [];
    let synced = 0;
    for (const payload of offlineQueue) {
      try {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) synced++;
        else remaining.push(payload);
      } catch {
        remaining.push(payload);
      }
    }
    setOfflineQueue(remaining);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    setBusy(false);
    refreshBillNo();
    loadHeld();
    flash(synced > 0 ? `ซิงก์บิลออฟไลน์สำเร็จ ${synced} บิล` : 'ยังไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
  }

  const loadHeld = () =>
    fetch('/api/bills?status=HELD')
      .then((r) => r.json())
      .then(setHeld)
      .catch(() => {});

  // customer search-as-you-type (name or phone)
  useEffect(() => {
    const q = customer.name || customer.phone;
    if (picked || q.length < 2) return setMatches([]);
    const t = setTimeout(
      () =>
        fetch(`/api/customers?q=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then(setMatches)
          .catch(() => {}),
      250,
    );
    return () => clearTimeout(t);
  }, [customer.name, customer.phone, picked]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 8000);
  };
  const refreshBillNo = () =>
    fetch('/api/bills?next=1')
      .then((r) => r.json())
      .then((d) => setBillNo(d.billNo))
      .catch(() => {});

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then(setCatalog);
    refreshBillNo();
    loadHeld();
  }, []);

  // Open from the queue board: /pos?booking=ID pre-fills the bill.
  const bookingId = Number(params.get('booking')) || undefined;
  useEffect(() => {
    if (!bookingId || !catalog) return;
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((b: { bookings: BoardBooking[] }) => {
        const bk = b.bookings.find((x) => x.id === bookingId);
        const svc = bk && catalog.services.find((s) => s.id === bk.serviceId);
        if (!bk || !svc) return;
        const minutes = Math.round((new Date(bk.endsAt).getTime() - new Date(bk.startsAt).getTime()) / 60000);
        setLines([{ uid: uid++, service: svc, minutes, therapistId: bk.therapistId, roomId: bk.roomId, bookingId: bk.id, note: '' }]);
        if (bk.customer) setCustomer((c) => ({ ...c, name: bk.customer!.name }));
      });
  }, [bookingId, catalog]);

  const services = useMemo(
    () =>
      (catalog?.services ?? []).filter(
        (s) => (category === 'ทั้งหมด' || s.category === category) && (!query || s.name.includes(query)),
      ),
    [catalog, category, query],
  );
  const selected = new Set(lines.map((l) => l.service.id));

  // Packages compatible with a given service line
  const eligiblePackages = (l: Line) =>
    (picked?.packages ?? []).filter(
      (cp) =>
        cp.remainingQuota > 0 &&
        new Date(cp.expiresAt).getTime() > Date.now() &&
        (!cp.plan.serviceId || cp.plan.serviceId === l.service.id),
    );

  const effectiveLinePrice = (l: Line) => (l.customerPackageId ? 0 : linePrice(l.service, l.minutes));
  const subtotal = lines.reduce((n, l) => n + effectiveLinePrice(l), 0);
  const discountNum = Math.min(Number(discount) || 0, subtotal);
  const afterDiscount = subtotal - discountNum;
  const voucherDeduction = appliedVoucher ? Math.min(appliedVoucher.remainingValue, afterDiscount) : 0;
  const total = afterDiscount - voucherDeduction;
  const tipNum = Number(tip) || 0;
  const splitSum = METHODS.reduce((n, m) => n + (Number(amounts[m]) || 0), 0);
  const splitRemaining = total - splitSum;

  async function applyVoucherCode() {
    if (!voucherInput.trim()) return;
    const res = await fetch(`/api/vouchers?code=${encodeURIComponent(voucherInput.trim())}`);
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'รหัสบัตรกำนัลไม่ถูกต้อง');
    setAppliedVoucher(data);
    setVoucherInput('');
  }

  function resume(h: HeldBill) {
    if (!catalog) return;
    setLines(
      h.items.flatMap((it) => {
        const service = catalog.services.find((s) => s.id === it.serviceId);
        return service
          ? [
              {
                uid: uid++,
                service,
                minutes: it.minutes,
                therapistId: it.therapistId ?? undefined,
                roomId: it.roomId ?? undefined,
                bookingId: it.bookingId ?? undefined,
                customerPackageId: it.customerPackageId ?? undefined,
                note: it.note ?? '',
              },
            ]
          : [];
      }),
    );
    setDiscount(h.discount ? String(h.discount) : '');
    if (h.customer) {
      setPicked(h.customer);
      setCustomer({ name: h.customer.name, phone: h.customer.phone ?? '' });
    }
    setResumeId(h.id);
    setShowHeld(false);
  }

  const toggleService = (s: Service) =>
    setLines((ls) =>
      ls.some((l) => l.service.id === s.id)
        ? ls.filter((l) => l.service.id !== s.id)
        : [
            ...ls,
            {
              uid: uid++,
              service: s,
              minutes: s.minutes,
              therapistId: catalog?.therapists[0]?.id,
              roomId: catalog?.rooms[0]?.id,
              note: '',
            },
          ],
    );
  const update = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.uid === id ? { ...l, ...patch } : l)));

  async function submit(status: 'PAID' | 'HELD') {
    if (busy || !lines.length) return;
    const payments =
      status === 'HELD' || total === 0
        ? []
        : split
          ? METHODS.filter((m) => Number(amounts[m]) > 0).map((m) => ({ method: m, amount: Number(amounts[m]) }))
          : [{ method, amount: total }];
    if (status === 'PAID' && total > 0 && split && splitRemaining !== 0)
      return flash(`ยอดแบ่งจ่ายยังไม่ครบ (เหลือ ${baht(splitRemaining)})`);
    setBusy(true);
    const payload = {
      status,
      customerId: picked?.id,
      resumeBillId: resumeId ?? undefined,
      discount: discountNum,
      voucherCode: appliedVoucher?.code,
      customerName: picked ? undefined : customer.name || undefined,
      customerPhone: picked ? undefined : customer.phone || undefined,
      tip: status === 'PAID' ? tipNum : 0,
      tipMethod: tipNum > 0 ? tipMethod : undefined,
      payments,
      items: lines.map((l) => ({
        serviceId: l.service.id,
        minutes: l.minutes,
        therapistId: l.therapistId,
        roomId: l.roomId,
        bookingId: l.bookingId,
        customerPackageId: l.customerPackageId,
        note: l.note || undefined,
      })),
    };
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) return flash(data.error ?? 'บันทึกไม่สำเร็จ');
      flash(status === 'PAID' ? `รับชำระ ${baht(total)} เรียบร้อย (${data.billNo})` : `พักบิลแล้ว (${data.billNo})`);
      setLastBillId(status === 'PAID' ? data.id : null);
    } catch {
      // Network offline fallback: queue bill locally in browser storage
      const nextQ = [...offlineQueue, payload];
      setOfflineQueue(nextQ);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(nextQ));
      setBusy(false);
      flash('อินเทอร์เน็ตหลุด — บันทึกบิลไว้ในเครื่องแล้ว (รอซิงก์เมื่อออนไลน์)');
    }
    setLines([]);
    setAmounts({ CASH: '', PROMPTPAY: '', CARD: '' });
    setTip('');
    setCustomer({ name: '', phone: '' });
    setPicked(null);
    setDiscount('');
    setAppliedVoucher(null);
    setResumeId(null);
    refreshBillNo();
    loadHeld();
  }

  if (!catalog)
    return (
      <main className="workspace">
        <p style={{ color: 'var(--muted)' }}>กำลังโหลด…</p>
      </main>
    );

  return (
    <>
      <main className="workspace">
        <header className="workspace__head">
          <div>
            <h1>ขายหน้าร้าน</h1>
            <p>ให้ทุกการพักผ่อน เริ่มต้นอย่างราบรื่น</p>
          </div>
          <div className="workspace__actions">
            {(isOffline || offlineQueue.length > 0) && (
              <button
                className="btn-chip"
                style={{ background: '#f7eccf', color: '#8a5a00' }}
                onClick={syncOfflineBills}
              >
                {isOffline ? '● โหมดออฟไลน์' : `รอซิงก์ ${offlineQueue.length} บิล (กดเพื่อซิงก์)`}
              </button>
            )}
            <div className="date-pill">
              <Icon name="calendar" />
              {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        <label className="search" style={{ marginTop: 30 }}>
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาบริการ หรือรหัสบริการ" />
        </label>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${category === c ? 'is-active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="section-head">
          <h2>บริการแนะนำ</h2>
          <span>{services.length} บริการ</span>
        </div>
        <div className="grid-3">
          {services.map((s) => {
            const on = selected.has(s.id);
            return (
              <article key={s.id} className={`service ${on ? 'is-selected' : ''}`}>
                <div className="service__top">
                  <span className="service__no" style={{ background: s.tint ?? '#e9eedf' }}>
                    {String(s.id).padStart(2, '0')}
                  </span>
                  {on && <span className="tag">เลือกแล้ว</span>}
                </div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <div className="service__time">
                  <Icon name="clock-sm" size={14} />
                  {s.minutes ? `${s.minutes} นาที` : 'บริการเสริม'}
                </div>
                <div className="service__bottom">
                  <strong>{baht(s.price, false)}</strong>
                  <button className={`add ${on ? 'add--on' : ''}`} aria-label={`เพิ่ม ${s.name}`} onClick={() => toggleService(s)}>
                    <Icon name={on ? 'plus-light' : 'plus'} size={19} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="section-head section-head--lg">
          <h2>หมอนวด</h2>
        </div>
        <div className="grid-3">
          {catalog.therapists.map((t) => (
            <div key={t.id} className="therapist">
              <div>
                <div className="therapist__name">{t.name}</div>
                <div className="therapist__meta">
                  {t.specialty} · {t.years} ปี
                </div>
              </div>
              <span className="tag tag--pill">
                {t.status === 'AVAILABLE' ? '● ว่าง' : t.status === 'IN_SERVICE' ? '● กำลังนวด' : '● พัก'}
              </span>
            </div>
          ))}
        </div>
      </main>

      <aside className="checkout">
        <div className="checkout__head">
          <h2>รายการขาย</h2>
          <span className="count">{lines.length}</span>
          <Icon name="receipt" className="checkout__receipt" />
        </div>
        <div className="checkout__bill">
          <span>บิล #{billNo}</span>
          <span style={{ display: 'flex', gap: 10 }}>
            <button className="link" onClick={() => setShowHeld((s) => !s)}>
              บิลที่พัก ({held.length})
            </button>
            <span className="accent">{resumeId ? 'บิลที่พักไว้' : 'บิลใหม่'}</span>
          </span>
        </div>
        {showHeld && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, marginBottom: 10, maxHeight: 150, overflowY: 'auto' }}>
            {held.length === 0 && (
              <p className="empty" style={{ padding: 10 }}>
                ไม่มีบิลที่พักไว้
              </p>
            )}
            {held.map((h) => (
              <button
                key={h.id}
                onClick={() => resume(h)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 13,
                }}
              >
                <span>
                  {h.billNo} · {h.customer?.name ?? 'ไม่ระบุลูกค้า'}
                </span>
                <span>{h.items.length} รายการ</span>
              </button>
            ))}
          </div>
        )}
        <hr />
        <div className="customer" style={{ position: 'relative' }}>
          <Icon name="user" size={22} />
          <div style={{ display: 'grid', gap: 4 }}>
            {picked ? (
              <>
                <div className="customer__name">{picked.name}</div>
                <div className="customer__meta">
                  {picked.phone ?? 'ไม่มีเบอร์โทร'}
                  {picked.packages && picked.packages.length > 0 ? ` · ${picked.packages.length} แพ็กเกจ` : ''}
                </div>
              </>
            ) : (
              <>
                <input
                  className="note"
                  style={{ margin: 0, height: 28, fontSize: 13 }}
                  placeholder="ชื่อลูกค้า (พิมพ์ค้นหาสมาชิก)"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                />
                <input
                  className="note"
                  style={{ margin: 0, height: 28, fontSize: 12 }}
                  placeholder="เบอร์โทร"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                />
              </>
            )}
          </div>
          {picked && (
            <button
              className="link"
              onClick={() => {
                setPicked(null);
                setCustomer({ name: '', phone: '' });
                setLines((ls) => ls.map((l) => ({ ...l, customerPackageId: undefined })));
              }}
            >
              เปลี่ยน
            </button>
          )}
          {!picked && matches.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                zIndex: 5,
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: 8,
                boxShadow: '0 8px 20px rgb(0 0 0 / 10%)',
              }}
            >
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPicked(m);
                    setMatches([]);
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 12px', fontSize: 13 }}
                >
                  <span>{m.name}</span>
                  <span style={{ color: 'var(--muted)' }}>
                    {m.phone} {m.packages?.length ? `(${m.packages.length} แพ็กเกจ)` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {picked && (picked.allergies || picked.notes) && (
          <div
            role="note"
            style={{
              marginTop: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: picked.allergies ? '#f6dcd8' : '#f4f5ef',
              fontSize: 12,
            }}
          >
            {picked.allergies && (
              <div>
                <strong>⚠ แพ้:</strong> {picked.allergies}
              </div>
            )}
            {picked.notes && (
              <div>
                <strong>หมายเหตุ:</strong> {picked.notes}
              </div>
            )}
          </div>
        )}

        <div className="checkout__scroll">
          <div className="cols">
            <span>บริการ</span>
            <span>ราคา</span>
          </div>
          {lines.length === 0 && <p className="empty">ยังไม่มีรายการ เลือกบริการจากด้านซ้าย</p>}
          {lines.map((l) => {
            const availPkgs = eligiblePackages(l);
            const activePkg = availPkgs.find((p) => p.id === l.customerPackageId);
            return (
              <div key={l.uid} className="line">
                <div className="line__row">
                  <h3>{l.service.name}</h3>
                  <strong>{activePkg ? 'ตัดแพ็กเกจ (฿0)' : baht(linePrice(l.service, l.minutes), false)}</strong>
                </div>
                <div className="line__row">
                  <span className="line__meta">{l.minutes ? `${l.minutes} นาที · 1 ท่าน` : 'บริการเสริม'}</span>
                  <button
                    className="icon-btn"
                    aria-label="ลบรายการ"
                    onClick={() => setLines((ls) => ls.filter((x) => x.uid !== l.uid))}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>

                {/* Package Quota Redemption Picker */}
                {availPkgs.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: activePkg ? '#e8efdf' : '#f5f7f0',
                      border: activePkg ? '1px solid var(--primary)' : '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: 'var(--primary)', fontWeight: 500 }}>ใช้สิทธิ์แพ็กเกจ</span>
                    <select
                      style={{ background: 'transparent', border: 0, outline: 'none', fontWeight: 500, color: 'var(--ink)' }}
                      value={l.customerPackageId ?? ''}
                      onChange={(e) =>
                        update(l.uid, { customerPackageId: e.target.value ? Number(e.target.value) : undefined })
                      }
                    >
                      <option value="">ไม่ใช้แพ็กเกจ (คิดราคาปกติ)</option>
                      {availPkgs.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.plan.name} (เหลือ {cp.remainingQuota}{' '}
                          {cp.plan.quotaType === 'MINUTES' ? 'นาที' : 'ครั้ง'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {l.minutes > 0 && (
                  <div className="duration">
                    <span>ระยะเวลา</span>
                    <Select className="select--bare" value={l.minutes} onChange={(v) => update(l.uid, { minutes: Number(v) })}>
                      {[...new Set([...DURATIONS, l.minutes])]
                        .sort((a, b) => a - b)
                        .map((d) => (
                          <option key={d} value={d}>
                            {d} นาที
                          </option>
                        ))}
                    </Select>
                  </div>
                )}
                <div className="pair">
                  <label>
                    <span className="label">หมอนวด</span>
                    <Select value={l.therapistId ?? ''} onChange={(v) => update(l.uid, { therapistId: Number(v) })}>
                      {catalog.therapists.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    <span className="label">ห้อง / เตียง</span>
                    <Select value={l.roomId ?? ''} onChange={(v) => update(l.uid, { roomId: Number(v) })}>
                      {catalog.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <input
                  className="note"
                  value={l.note}
                  onChange={(e) => update(l.uid, { note: e.target.value })}
                  placeholder="หมายเหตุ"
                />
              </div>
            );
          })}
        </div>

        <div className="summary">
          <hr />
          <div className="summary__row">
            <span>รวมค่าบริการ</span>
            <strong>{baht(subtotal)}</strong>
          </div>
          <div className="summary__row">
            <span>ส่วนลด (บาท)</span>
            <input
              className="note"
              style={{ margin: 0, height: 30, width: 90, textAlign: 'right' }}
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
          </div>

          {/* Gift Voucher Row */}
          <div className="summary__row">
            <span>บัตรกำนัล (Voucher)</span>
            {appliedVoucher ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: 'var(--primary)' }}>
                  {appliedVoucher.code} (-{baht(voucherDeduction)})
                </strong>
                <button className="link" onClick={() => setAppliedVoucher(null)}>
                  เอาออก
                </button>
              </span>
            ) : (
              <span style={{ display: 'flex', gap: 6 }}>
                <input
                  className="note"
                  style={{ margin: 0, height: 30, width: 110 }}
                  placeholder="รหัส เช่น LAMUN500"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                />
                <button className="link" onClick={applyVoucherCode}>
                  ใช้รหัส
                </button>
              </span>
            )}
          </div>

          <div className="summary__row">
            <span>ทิปหมอนวด</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <input
                className="note"
                style={{ margin: 0, height: 30, width: 70, textAlign: 'right' }}
                inputMode="numeric"
                value={tip}
                onChange={(e) => setTip(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
              />
              <select
                className="note"
                style={{ margin: 0, height: 30, width: 90 }}
                value={tipMethod}
                onChange={(e) => setTipMethod(e.target.value as PayMethod)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAY_LABEL[m]}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="total">
            <span>ยอดชำระทั้งหมด</span>
            <strong>{baht(total)}</strong>
          </div>

          {total > 0 && (
            <>
              <div className="pay-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>วิธีชำระเงิน</span>
                <button className="link" onClick={() => setSplit((s) => !s)}>
                  {split ? 'จ่ายวิธีเดียว' : 'แบ่งจ่าย'}
                </button>
              </div>
              {!split ? (
                <div className="pay">
                  {METHODS.map((m) => (
                    <button key={m} className={`pay__opt ${method === m ? 'is-active' : ''}`} onClick={() => setMethod(m)}>
                      <Icon name={PAY_ICON[m]} size={22} />
                      {PAY_LABEL[m]}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {METHODS.map((m) => (
                    <label key={m} className="summary__row" style={{ margin: 0 }}>
                      <span>{PAY_LABEL[m]}</span>
                      <input
                        className="note"
                        style={{ margin: 0, height: 32, width: 110, textAlign: 'right' }}
                        inputMode="numeric"
                        placeholder="0"
                        value={amounts[m]}
                        onChange={(e) => setAmounts({ ...amounts, [m]: e.target.value.replace(/\D/g, '') })}
                      />
                    </label>
                  ))}
                  <div className="summary__note" style={{ color: splitRemaining === 0 ? 'var(--primary)' : '#9a2f22' }}>
                    {splitRemaining === 0 ? 'ยอดครบแล้ว' : `ยอดคงเหลือ ${baht(splitRemaining)}`}
                  </div>
                </div>
              )}
            </>
          )}

          <button className="cta" disabled={!lines.length || busy} onClick={() => submit('PAID')}>
            <span>{total === 0 ? 'ยืนยันตัดแพ็กเกจ / บัตรกำนัล' : `รับชำระเงิน ${baht(total)}`}</span>
            <Icon name="arrow" />
          </button>
          <div className="foot">
            <button className="link" disabled={!lines.length || busy} onClick={() => submit('HELD')}>
              พักบิล
            </button>
            <button
              className="muted"
              onClick={() => {
                setLines([]);
                setPicked(null);
                setDiscount('');
                setAppliedVoucher(null);
                setResumeId(null);
                flash('ยกเลิกบิลแล้ว');
              }}
            >
              ยกเลิกบิล
            </button>
          </div>
        </div>
      </aside>
      {toast && (
        <div className="toast" role="status">
          {toast}
          {lastBillId && (
            <a
              href={`/receipt/${lastBillId}`}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 14, textDecoration: 'underline' }}
            >
              พิมพ์ใบเสร็จ
            </a>
          )}
        </div>
      )}
    </>
  );
}
