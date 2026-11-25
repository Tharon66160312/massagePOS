import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { baht } from '@/lib/money';
import { PAY_LABEL, type PayMethod } from '@/lib/types';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

type ReceiptBill = {
  id: number;
  billNo: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  voucherAmount: number;
  total: number;
  tip: number;
  tipMethod: PayMethod | null;
  customer: { name: string } | null;
  voucher: { code: string } | null;
  payments: { id: number; method: PayMethod; amount: number }[];
  items: {
    id: number;
    minutes: number;
    price: number;
    quotaUsed: number;
    service: { name: string };
    therapist: { name: string } | null;
    customerPackage: { remainingQuota: number; plan: { name: string; quotaType: 'SESSIONS' | 'MINUTES' } } | null;
  }[];
};

/** 80mm thermal-style receipt fetched from the backend API. */
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const res = await fetch(`${BACKEND_URL}/api/bills/${encodeURIComponent(params.id)}`, {
    headers: {
      'x-user-role': session?.user?.role ?? 'STAFF',
      'x-user-id': session?.user?.id ?? '',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!res || !res.ok) notFound();
  const bill: ReceiptBill = await res.json();

  const row = { display: 'flex', justifyContent: 'space-between', gap: 8 } as const;
  return (
    <div style={{ width: '80mm', margin: '0 auto', padding: '8mm 4mm', fontSize: 12, color: '#000', background: '#fff' }}>
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { background: #fff } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>ละมุน</div>
        <div>LAMUN MASSAGE · สาขาอารีย์</div>
        <div style={{ marginTop: 6 }}>ใบเสร็จรับเงิน</div>
      </div>
      <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
      <div style={row}><span>เลขที่</span><span>{bill.billNo}</span></div>
      <div style={row}>
        <span>วันที่</span>
        <span>{new Date(bill.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })}</span>
      </div>
      {bill.customer && <div style={row}><span>ลูกค้า</span><span>{bill.customer.name}</span></div>}
      <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
      {bill.items.map((it) => (
        <div key={it.id} style={{ marginBottom: 4 }}>
          <div style={row}><span>{it.service.name}{it.minutes ? ` ${it.minutes} นาที` : ''}</span><span>{it.customerPackage ? 'ตัดแพ็กเกจ' : baht(it.price)}</span></div>
          {it.customerPackage && (
            <div style={{ color: '#285C48', fontSize: 11 }}>
              ใช้สิทธิ์: {it.customerPackage.plan.name} (-{it.quotaUsed} {it.customerPackage.plan.quotaType === 'MINUTES' ? 'นาที' : 'ครั้ง'} · คงเหลือ {it.customerPackage.remainingQuota})
            </div>
          )}
          {it.therapist && <div style={{ color: '#444', fontSize: 11 }}>หมอนวด: {it.therapist.name}</div>}
        </div>
      ))}
      <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
      <div style={row}><span>รวมค่าบริการ</span><span>{baht(bill.subtotal)}</span></div>
      {bill.discount > 0 && <div style={row}><span>ส่วนลด</span><span>-{baht(bill.discount)}</span></div>}
      {bill.voucherAmount > 0 && (
        <div style={row}>
          <span>บัตรกำนัล ({bill.voucher?.code})</span>
          <span>-{baht(bill.voucherAmount)}</span>
        </div>
      )}
      <div style={{ ...row, fontWeight: 600, fontSize: 15 }}><span>ยอดสุทธิ</span><span>{baht(bill.total)}</span></div>
      {bill.payments.map((p) => (
        <div key={p.id} style={row}><span>ชำระ{PAY_LABEL[p.method]}</span><span>{baht(p.amount)}</span></div>
      ))}
      {bill.tip > 0 && <div style={row}><span>ทิป ({bill.tipMethod ? PAY_LABEL[bill.tipMethod] : ''})</span><span>{baht(bill.tip)}</span></div>}
      <hr style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />
      <div style={{ textAlign: 'center' }}>ขอบคุณที่ใช้บริการ</div>
      <PrintButton />
    </div>
  );
}
