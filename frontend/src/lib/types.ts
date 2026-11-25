export type Service = { id: number; name: string; description: string | null; minutes: number; price: number; category: string; tint: string | null };
export type Therapist = { id: number; name: string; specialty: string | null; years: number; status: 'AVAILABLE' | 'IN_SERVICE' | 'OFF_SHIFT' };
export type Room = { id: number; name: string; status: 'AVAILABLE' | 'IN_USE' | 'RESERVED' | 'CLEANING' };
export type Catalog = { services: Service[]; therapists: Therapist[]; rooms: Room[] };

export type BoardBooking = {
  id: number;
  startsAt: string;
  endsAt: string;
  status: 'BOOKED' | 'IN_SERVICE' | 'DONE' | 'CANCELLED';
  source?: 'WALK_IN' | 'PHONE' | 'LINE_OA' | 'WEB';
  note?: string | null;
  serviceId: number;
  therapistId: number;
  roomId: number;
  service: { name: string; minutes: number };
  therapist: { name: string };
  room: { name: string };
  customer: { name: string } | null;
};
export type Board = { now: string; rooms: Room[]; therapists: Therapist[]; bookings: BoardBooking[] };

export type PayMethod = 'CASH' | 'PROMPTPAY' | 'CARD';
export const PAY_LABEL: Record<PayMethod, string> = { CASH: 'เงินสด', PROMPTPAY: 'พร้อมเพย์', CARD: 'บัตร' };
export const PAY_ICON: Record<PayMethod, string> = { CASH: 'cash', PROMPTPAY: 'qr', CARD: 'card' };
