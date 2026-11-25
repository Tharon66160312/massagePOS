'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden"
      style={{ marginTop: 16, width: '100%', height: 40, borderRadius: 8, background: '#285C48', color: '#fff', fontWeight: 500 }}
    >
      พิมพ์ใบเสร็จ
    </button>
  );
}
