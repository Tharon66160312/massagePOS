import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    service: 'lamun-pos-backend',
    status: 'ok',
    endpoints: [
      '/api/auth/login',
      '/api/catalog',
      '/api/bookings',
      '/api/rooms/[id]',
      '/api/bills',
      '/api/bills/[id]',
      '/api/customers',
      '/api/packages',
      '/api/customer-packages',
      '/api/vouchers',
      '/api/inventory',
      '/api/reports/daily',
      '/api/public/booking',
      '/api/stream',
    ],
  });
}
