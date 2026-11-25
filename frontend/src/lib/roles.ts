export type Role = 'OWNER' | 'MANAGER' | 'STAFF' | 'THERAPIST';
export type CommissionType = 'PERCENT' | 'FIXED';

export const ROLE_LABEL_CLIENT: Record<Role, string> = {
  OWNER: 'เจ้าของร้าน',
  MANAGER: 'ผู้จัดการ',
  STAFF: 'พนักงานต้อนรับ',
  THERAPIST: 'หมอนวด',
};

export const ACCESS_CLIENT: Record<string, Role[]> = {
  pos: ['OWNER', 'MANAGER', 'STAFF'],
  receipt: ['OWNER', 'MANAGER', 'STAFF'],
  customers: ['OWNER', 'MANAGER', 'STAFF'],
  packages: ['OWNER', 'MANAGER', 'STAFF'],
  inventory: ['OWNER', 'MANAGER', 'STAFF'],
  queue: ['OWNER', 'MANAGER', 'STAFF', 'THERAPIST'],
  reports: ['OWNER', 'MANAGER'],
};
