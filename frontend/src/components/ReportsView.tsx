'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { baht } from '@/lib/money';
import { PAY_LABEL, type PayMethod } from '@/lib/types';

type Report = {
  period: 'day' | 'month';
  label: string;
  bills: number;
  revenue: number;
  discounts: number;
  totalCommissions: number;
  grossProfit: number;
  packageSalesCount: number;
  packageSalesRevenue: number;
  packageRedemptions: number;
  voucherIssuedCount: number;
  voucherSalesRevenue: number;
  voucherRedeemedAmount: number;
  byMethod: Record<PayMethod, number>;
  tipByMethod: Record<PayMethod, number>;
  services: { name: string; count: number; revenue: number; commission: number }[];
  byHour: number[];
  therapists: { name: string; services: number; minutes: number; revenue: number; commission: number; tips: number; payout: number }[];
};

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const currentMonth = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

export function ReportsView() {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(currentMonth());
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const qs = period === 'month' ? `period=month&month=${month}` : `period=day&date=${date}`;
    fetch(`/api/reports/daily?${qs}`)
      .then(async (res) => (res.ok ? setR(await res.json()) : setError((await res.json()).error)))
      .catch(() => setError('โหลดรายงานไม่สำเร็จ'));
  }, [period, date, month]);

  const peak = r ? Math.max(1, ...r.byHour) : 1;

  return (
    <main className="workspace">
      <header className="workspace__head">
        <div>
          <h1>รายงานและปิดกะ</h1>
          <p>สรุปยอดขาย กำไรขั้นต้น ค่ามือหมอนวด และยอดแพ็กเกจ/บัตรกำนัล (รายวัน / รายเดือน)</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button className={`chip ${period === 'day' ? 'is-active' : ''}`} onClick={() => setPeriod('day')}>
            รายวัน (ปิดกะ)
          </button>
          <button className={`chip ${period === 'month' ? 'is-active' : ''}`} onClick={() => setPeriod('month')}>
            สรุปรายเดือน
          </button>
          {period === 'day' ? (
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          ) : (
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          )}
          <Button variant="outline" onClick={() => window.print()}>
            พิมพ์รายงาน
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="mt-6 text-red-700">
          {error}
        </p>
      )}
      {r && (
        <>
          <div className="mt-8 grid grid-cols-4 gap-3">
            {[
              ['ยอดขายบิลหน้าร้าน', baht(r.revenue), `${r.bills} บิล · ส่วนลด ${baht(r.discounts, false)}`],
              ['รายได้ขายแพ็กเกจใหม่', baht(r.packageSalesRevenue), `ขาย ${r.packageSalesCount} แพ็กเกจ · ตัดใช้ ${r.packageRedemptions} ครั้ง`],
              ['ต้นทุนค่ามือหมอนวดรวม', baht(r.totalCommissions), `ไม่รวมทิป ${baht(Object.values(r.tipByMethod).reduce((a, b) => a + b, 0), false)}`],
              ['กำไรขั้นต้น (หักค่ามือ)', baht(r.grossProfit), 'ยอดบิล + ขายแพ็กเกจ − ค่ามือ'],
            ].map(([k, v, sub]) => (
              <Card key={k}>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">{k}</div>
                  <div className="mt-1 text-2xl font-semibold text-primary">{v}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle>ยอดตามช่องทางชำระ</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th>ช่องทาง</th>
                      <th className="text-right">ค่าบริการ</th>
                      <th className="text-right">ทิป</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(PAY_LABEL) as PayMethod[]).map((m) => (
                      <tr key={m} className="border-t border-line">
                        <td className="py-2">{PAY_LABEL[m]}</td>
                        <td className="text-right tabular-nums">{baht(r.byMethod[m])}</td>
                        <td className="text-right tabular-nums">{baht(r.tipByMethod[m])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>สรุปแพ็กเกจและบัตรกำนัล</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ขายแพ็กเกจใหม่</span>
                  <span className="font-medium">{r.packageSalesCount} รายการ ({baht(r.packageSalesRevenue)})</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted-foreground">ลูกค้ามาตัดสิทธิ์แพ็กเกจ</span>
                  <Badge variant="info">{r.packageRedemptions} รายการบริการ</Badge>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted-foreground">ออกบัตรกำนัลใหม่</span>
                  <span className="font-medium">{r.voucherIssuedCount} ใบ ({baht(r.voucherSalesRevenue)})</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted-foreground">ยอดใช้บัตรกำนัลหักบิล</span>
                  <span className="font-medium text-primary">{baht(r.voucherRedeemedAmount)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ยอดขายและกำไรแยกบริการ</CardTitle>
              </CardHeader>
              <CardContent>
                {r.services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th>บริการ</th>
                        <th className="text-right">ครั้ง</th>
                        <th className="text-right">รับ</th>
                        <th className="text-right">กำไร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.services.map((s) => (
                        <tr key={s.name} className="border-t border-line">
                          <td className="py-1.5">{s.name}</td>
                          <td className="text-right text-muted-foreground">{s.count}</td>
                          <td className="text-right tabular-nums">{baht(s.revenue, false)}</td>
                          <td className="text-right tabular-nums font-medium text-primary">
                            {baht(s.revenue - s.commission, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-3">
            <CardHeader>
              <CardTitle>ตารางสรุปค่ามือหมอนวด</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th>หมอนวด</th>
                    <th className="text-right">งาน</th>
                    <th className="text-right">นาที</th>
                    <th className="text-right">ยอดบริการ</th>
                    <th className="text-right">ค่ามือ</th>
                    <th className="text-right">ทิป</th>
                    <th className="text-right">รวมจ่ายหมอ</th>
                  </tr>
                </thead>
                <tbody>
                  {r.therapists.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-3 text-muted-foreground">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                  {r.therapists.map((t) => (
                    <tr key={t.name} className="border-t border-line tabular-nums">
                      <td className="py-2 font-medium">{t.name}</td>
                      <td className="text-right">{t.services}</td>
                      <td className="text-right">{t.minutes}</td>
                      <td className="text-right">{baht(t.revenue)}</td>
                      <td className="text-right">{baht(t.commission)}</td>
                      <td className="text-right">{baht(t.tips)}</td>
                      <td className="text-right font-semibold text-primary">{baht(t.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="mt-3">
            <CardHeader>
              <CardTitle>ช่วงเวลาพีค (Peak Hours 00:00 – 23:00)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-1">
                {r.byHour.map((v, h) => (
                  <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${h}:00 — ${baht(v)}`}>
                    <div className="w-full rounded-t bg-primary" style={{ height: `${(v / peak) * 100}%`, minHeight: v ? 2 : 0 }} />
                    <span className="text-[10px] text-muted-foreground">{h}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
