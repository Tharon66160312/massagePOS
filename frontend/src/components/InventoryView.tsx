'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { baht } from '@/lib/money';

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  kind: 'RETAIL' | 'CONSUMABLE';
  unit: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
};

type Movement = {
  id: number;
  type: 'RESTOCK' | 'ISSUE' | 'SALE' | 'ADJUST';
  delta: number;
  note: string | null;
  createdAt: string;
  item: { name: string; sku: string; unit: string };
};

const MOVE_LABEL: Record<Movement['type'], { label: string; variant: 'success' | 'warning' | 'info' | 'muted' }> = {
  RESTOCK: { label: 'รับเข้าสต็อก', variant: 'success' },
  ISSUE: { label: 'เบิกใช้ในร้าน', variant: 'warning' },
  SALE: { label: 'ตัดขายหน้าร้าน', variant: 'info' },
  ADJUST: { label: 'ปรับยอด', variant: 'muted' },
};

export function InventoryView({ canManage }: { canManage: boolean }) {
  const [filter, setFilter] = useState<'ALL' | 'RETAIL' | 'CONSUMABLE' | 'LOW'>('ALL');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');

  const [moveForm, setMoveForm] = useState({
    itemId: 0,
    type: 'ISSUE' as 'ISSUE' | 'RESTOCK',
    quantity: '1',
    note: '',
  });
  const [newForm, setNewForm] = useState({
    sku: '',
    name: '',
    kind: 'CONSUMABLE' as 'RETAIL' | 'CONSUMABLE',
    unit: 'ชิ้น',
    stock: '10',
    minStock: '5',
    cost: '50',
    price: '0',
  });

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    const res = await fetch('/api/inventory');
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items);
    setMovements(data.movements);
    setMoveForm((f) => ({ ...f, itemId: f.itemId || data.items[0]?.id || 0 }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockItems = items.filter((i) => i.stock <= i.minStock);
  const visible = items.filter((i) => {
    if (filter === 'LOW') return i.stock <= i.minStock;
    if (filter === 'RETAIL' || filter === 'CONSUMABLE') return i.kind === filter;
    return true;
  });

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: Number(moveForm.itemId),
        type: moveForm.type,
        quantity: Number(moveForm.quantity),
        note: moveForm.note || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'ทำรายการไม่สำเร็จ');
    flash(moveForm.type === 'ISSUE' ? 'บันทึกเบิกของใช้แล้ว' : 'บันทึกรับของเข้าสต็อกแล้ว');
    setMoveForm({ ...moveForm, quantity: '1', note: '' });
    load();
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: newForm.sku,
        name: newForm.name,
        kind: newForm.kind,
        unit: newForm.unit,
        stock: Number(newForm.stock),
        minStock: Number(newForm.minStock),
        cost: Number(newForm.cost),
        price: newForm.kind === 'RETAIL' ? Number(newForm.price) : 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) return flash(data.error ?? 'เพิ่มสินค้าไม่สำเร็จ');
    flash('เพิ่มรายการสต็อกเรียบร้อย');
    setShowAdd(false);
    setNewForm({ sku: '', name: '', kind: 'CONSUMABLE', unit: 'ชิ้น', stock: '10', minStock: '5', cost: '50', price: '0' });
    load();
  }

  return (
    <main className="workspace">
      <header className="workspace__head">
        <div>
          <h1>สต็อกและวัสดุสิ้นเปลือง</h1>
          <p>ควบคุมสินค้าขายปลีกหน้าร้าน การเบิกของใช้ในห้องนวด และแจ้งเตือนเมื่อใกล้หมด</p>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'ปิดฟอร์ม' : '+ เพิ่มรายการสต็อกใหม่'}
          </Button>
        )}
      </header>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div
          role="alert"
          className="mt-6 flex items-center justify-between rounded-lg border border-[#c0392b] bg-[#f6dcd8] px-4 py-3 text-sm text-[#7a1f15]"
        >
          <div>
            <strong>⚠ แจ้งเตือนของใกล้หมด ({lowStockItems.length} รายการ):</strong>{' '}
            {lowStockItems.map((i) => `${i.name} (เหลือ ${i.stock} ${i.unit})`).join(' · ')}
          </div>
          <button className="font-semibold underline" onClick={() => setFilter('LOW')}>
            ดูเฉพาะที่ใกล้หมด
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="chips">
        {[
          ['ALL', `ทั้งหมด (${items.length})`],
          ['RETAIL', `สินค้าขายปลีก (${items.filter((i) => i.kind === 'RETAIL').length})`],
          ['CONSUMABLE', `วัสดุสิ้นเปลืองในร้าน (${items.filter((i) => i.kind === 'CONSUMABLE').length})`],
          ['LOW', `ใกล้หมดสต็อก (${lowStockItems.length})`],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`chip ${filter === k ? 'is-active' : ''}`}
            onClick={() => setFilter(k as typeof filter)}
          >
            {label}
          </button>
        ))}
      </div>

      {showAdd && (
        <form onSubmit={submitCreate} className="mt-4 grid grid-cols-6 gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
          <label className="space-y-1 font-medium">
            รหัส SKU
            <Input required placeholder="RET-001" value={newForm.sku} onChange={(e) => setNewForm({ ...newForm, sku: e.target.value })} />
          </label>
          <label className="col-span-2 space-y-1 font-medium">
            ชื่อสินค้า / วัสดุ
            <Input required placeholder="เช่น สครับกาแฟขัดผิว" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
          </label>
          <label className="space-y-1 font-medium">
            ประเภท
            <select
              className="h-10 w-full rounded-md border border-line bg-white px-2"
              value={newForm.kind}
              onChange={(e) => setNewForm({ ...newForm, kind: e.target.value as 'RETAIL' | 'CONSUMABLE' })}
            >
              <option value="CONSUMABLE">วัสดุสิ้นเปลืองในร้าน</option>
              <option value="RETAIL">สินค้าขายปลีก (ขึ้นหน้า POS)</option>
            </select>
          </label>
          <label className="space-y-1 font-medium">
            หน่วยนับ
            <Input required value={newForm.unit} onChange={(e) => setNewForm({ ...newForm, unit: e.target.value })} />
          </label>
          <label className="space-y-1 font-medium">
            สต็อกเริ่มต้น
            <Input type="number" min={0} required value={newForm.stock} onChange={(e) => setNewForm({ ...newForm, stock: e.target.value })} />
          </label>
          <label className="space-y-1 font-medium">
            จุดเตือนขั้นต่ำ
            <Input type="number" min={0} required value={newForm.minStock} onChange={(e) => setNewForm({ ...newForm, minStock: e.target.value })} />
          </label>
          <label className="space-y-1 font-medium">
            ต้นทุนต่อหน่วย (฿)
            <Input type="number" min={0} required value={newForm.cost} onChange={(e) => setNewForm({ ...newForm, cost: e.target.value })} />
          </label>
          {newForm.kind === 'RETAIL' && (
            <label className="space-y-1 font-medium">
              ราคาขายหน้าร้าน (฿)
              <Input type="number" min={0} required value={newForm.price} onChange={(e) => setNewForm({ ...newForm, price: e.target.value })} />
            </label>
          )}
          <div className="col-span-2 flex items-end">
            <Button type="submit">บันทึกรายการใหม่</Button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-3">SKU</th>
                  <th>รายการ</th>
                  <th>ประเภท</th>
                  <th className="text-right">ต้นทุน</th>
                  <th className="text-right">ราคาขาย</th>
                  <th className="text-right">คงเหลือ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => {
                  const low = it.stock <= it.minStock;
                  return (
                    <tr key={it.id} className="border-t border-line">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{it.sku}</td>
                      <td className="font-medium">{it.name}</td>
                      <td>
                        <Badge variant={it.kind === 'RETAIL' ? 'info' : 'muted'}>
                          {it.kind === 'RETAIL' ? 'ขายปลีก' : 'ของใช้ในร้าน'}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">{baht(it.cost, false)}</td>
                      <td className="text-right tabular-nums">{it.kind === 'RETAIL' ? baht(it.price, false) : '—'}</td>
                      <td className={`text-right tabular-nums font-semibold ${low ? 'text-[#9a2f22]' : 'text-ink'}`}>
                        {it.stock} {it.unit}
                      </td>
                      <td>
                        {it.stock === 0 ? (
                          <Badge variant="danger">หมดสต็อก</Badge>
                        ) : low ? (
                          <Badge variant="warning">ใกล้หมด (≤{it.minStock})</Badge>
                        ) : (
                          <Badge variant="success">ปกติ</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stock Movements History */}
          <Card>
            <CardHeader>
              <CardTitle>ประวัติการเบิกและเคลื่อนไหวสต็อกล่าสุด</CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการเคลื่อนไหว</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {movements.map((m) => {
                      const b = MOVE_LABEL[m.type];
                      return (
                        <tr key={m.id} className="border-t border-line first:border-0">
                          <td className="py-2 text-xs text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="font-medium">{m.item.name}</td>
                          <td>
                            <Badge variant={b.variant}>{b.label}</Badge>
                          </td>
                          <td className="text-xs text-muted-foreground">{m.note ?? '—'}</td>
                          <td className={`text-right tabular-nums font-semibold ${m.delta < 0 ? 'text-[#9a2f22]' : 'text-primary'}`}>
                            {m.delta > 0 ? `+${m.delta}` : m.delta} {m.item.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Issue / Restock Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>เบิกของใช้ / เติมสต็อก</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitMovement} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`h-9 rounded-md border text-center text-xs font-medium ${moveForm.type === 'ISSUE' ? 'border-primary bg-tint text-primary' : 'border-line bg-white'}`}
                  onClick={() => setMoveForm({ ...moveForm, type: 'ISSUE' })}
                >
                  เบิกใช้งาน (- หักออก)
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-md border text-center text-xs font-medium ${moveForm.type === 'RESTOCK' ? 'border-primary bg-tint text-primary' : 'border-line bg-white'}`}
                  onClick={() => setMoveForm({ ...moveForm, type: 'RESTOCK' })}
                >
                  รับของเข้า (+ เติมสต็อก)
                </button>
              </div>
              <label className="block space-y-1 font-medium">
                เลือกรายการ
                <select
                  className="h-10 w-full rounded-md border border-line bg-white px-2"
                  value={moveForm.itemId}
                  onChange={(e) => setMoveForm({ ...moveForm, itemId: Number(e.target.value) })}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (เหลือ {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 font-medium">
                จำนวน
                <Input
                  type="number"
                  min={1}
                  required
                  value={moveForm.quantity}
                  onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })}
                />
              </label>
              <label className="block space-y-1 font-medium">
                หมายเหตุการเบิก / รับเข้า
                <Input
                  placeholder="เช่น เบิกเข้าห้องนวด 01, ซื้อเพิ่มล็อตใหม่"
                  value={moveForm.note}
                  onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })}
                />
              </label>
              <Button type="submit" className="w-full">
                {moveForm.type === 'ISSUE' ? 'ยืนยันเบิกของใช้' : 'ยืนยันรับเข้าสต็อก'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
