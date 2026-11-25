'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ACCESS_CLIENT, ROLE_LABEL_CLIENT, type Role } from '@/lib/roles';

const NAV = [
  { area: 'pos', href: '/pos', label: 'ขายหน้าร้าน', icon: 'grid' },
  { area: 'queue', href: '/queue', label: 'การจองและคิว', icon: 'calendar' },
  { area: 'customers', href: '/customers', label: 'ลูกค้าและสมาชิก', icon: 'users' },
  { area: 'packages', href: '/packages', label: 'แพ็กเกจและบัตรกำนัล', icon: 'card' },
  { area: 'inventory', href: '/inventory', label: 'สต็อกและของใช้ในร้าน', icon: 'grid' },
  { area: 'reports', href: '/reports', label: 'รายงานและปิดกะ', icon: 'receipt' },
];

export function Sidebar({ name, role }: { name: string; role: Role }) {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__name">ละมุน</div>
        <div className="brand__sub">LAMUN MASSAGE</div>
      </div>
      <div className="branch">
        <div className="branch__name">สาขาอารีย์</div>
        <div className="branch__meta">สาขาหลัก · เปิดให้บริการ</div>
      </div>
      <div className="eyebrow">WORKSPACE</div>
      <nav className="nav">
        {NAV.filter((n) => ACCESS_CLIENT[n.area].includes(role)).map((n) => (
          <Link key={n.href} href={n.href} className={`nav__item ${path.startsWith(n.href) ? 'is-active' : ''}`}>
            <img src={`/icons/${n.icon}.svg`} alt="" width={20} height={20} />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar__spacer" />
      <div className="card--soft role">
        <div className="role__title">สิทธิ์ {ROLE_LABEL_CLIENT[role]}</div>
        <div className="role__note">ตามบทบาทที่ได้รับมอบหมาย</div>
        <Link href="/book" target="_blank" className="link" style={{ display: 'inline-block', marginTop: 8 }}>
          เปิดหน้าจองคิวลูกค้า ↗
        </Link>
      </div>
      <div className="user">
        <div>
          <div className="user__name">{name}</div>
          <button className="user__logout" onClick={() => signOut({ callbackUrl: '/login' })}>
            ออกจากระบบ
          </button>
        </div>
        <img src="/icons/logout.svg" alt="" width={20} height={20} />
      </div>
    </aside>
  );
}
