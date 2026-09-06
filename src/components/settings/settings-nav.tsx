'use client';

// ============================================================================
// src/components/settings/settings-nav.tsx
//
// The settings sidebar: small-caps group labels, quiet icons, one highlighted
// row. Grouping is the whole point — a flat list of twelve settings pages is
// a list you scan; four groups of three is a thing you navigate.
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  CreditCard,
  Palette,
  Plug,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Rendered dimmed and unclickable until the screen exists. */
  ready?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [
      { label: 'Profile', href: '/settings/profile', icon: User },
      { label: 'Preferences', href: '/settings/preferences', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { label: 'Members', href: '/settings/members', icon: Users },
      { label: 'Roles & permissions', href: '/settings/roles', icon: ShieldCheck },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Plan', href: '/settings/plan', icon: Receipt },
      { label: 'Payment', href: '/settings/payment', icon: CreditCard },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Integrations', href: '/settings/integrations', icon: Plug, ready: true },
      { label: 'Notifications', href: '/settings/notifications', icon: Bell },
      { label: 'Appearance', href: '/settings/appearance', icon: Palette },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings"
      style={{
        width: 232,
        flexShrink: 0,
        padding: '28px 12px',
        borderRight: '1px solid var(--hairline)',
        background: 'var(--surface-canvas)',
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          marginBottom: 22,
          fontSize: 13,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Winback
      </Link>

      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 22 }}>
          <p
            style={{
              margin: '0 0 6px',
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 0.3,
              color: 'var(--text-disabled)',
            }}
          >
            {group.label}
          </p>

          {group.items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            // Unbuilt screens read as present but not yet reachable — a link
            // that 404s is worse than a row that says "not yet".
            if (!item.ready) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title="Not built yet"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 14,
                    color: 'var(--text-disabled)',
                    cursor: 'default',
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 14,
                  textDecoration: 'none',
                  color: active ? 'var(--text-display)' : 'var(--text-primary)',
                  background: active ? 'var(--surface-sunken)' : 'transparent',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
