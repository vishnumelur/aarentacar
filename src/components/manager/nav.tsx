'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CarFront,
  Tags,
  Layers,
  UserCog,
  Tag,
  BarChart3,
  Settings,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  exact?: boolean;
};

const items: NavItem[] = [
  { href: '/manager', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/manager/fleet', label: 'Fleet', Icon: CarFront },
  { href: '/manager/types', label: 'Vehicle Types', Icon: Layers },
  { href: '/manager/categories', label: 'Categories', Icon: Tags },
  { href: '/manager/drivers', label: 'Drivers', Icon: UserCog },
  { href: '/manager/promos', label: 'Promotions', Icon: Tag },
  { href: '/manager/reports', label: 'Reports', Icon: BarChart3 },
  { href: '/manager/settings', label: 'Settings', Icon: Settings },
];

export function ManagerNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav className="space-y-1 p-3">
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-foreground'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
