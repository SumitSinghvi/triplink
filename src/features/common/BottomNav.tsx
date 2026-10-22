'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const BottomNav: React.FC = () => {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const unreadCount = useAppStore((s) => Object.keys(s.unread).length);

  const TABS = [
    { key: 'trips' as const, label: 'Trips', icon: 'train' as const },
    { key: 'matches' as const, label: 'Matches', icon: 'people' as const },
    { key: 'chats' as const, label: 'Chats', icon: 'chat' as const, badge: unreadCount },
    { key: 'profile' as const, label: 'Profile', icon: 'user' as const },
  ];

  return (
    <nav className="x-tabs" aria-label="Tabs">
      {TABS.map((t) => {
        const isActive = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            className="x-tab"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setTab(t.key)}
          >
            <SvgIcon name={t.icon} size={24} width={1.8} />
            <span>{t.label}</span>
            {t.badge ? <span className="x-badge">{t.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
};
