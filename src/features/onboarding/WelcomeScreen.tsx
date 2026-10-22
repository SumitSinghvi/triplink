'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';

export const WelcomeScreen: React.FC = () => {
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <div className="x-welcome">
      <div>
        <p className="x-word">
          Trip<i>Link</i>
        </p>
        <p className="x-tagline">Meet the right people on your journey.</p>
      </div>

      <svg className="x-route" viewBox="0 0 340 170" aria-hidden="true" fill="none">
        <path
          d="M40 40 C 140 40, 120 130, 300 130"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <circle cx="40" cy="40" r="8" fill="currentColor" />
        <circle cx="300" cy="130" r="8" style={{ fill: 'var(--fill-system-green)' }} />
        <text x="40" y="20" textAnchor="middle" fill="currentColor" style={{ font: 'var(--type-tag)' }}>
          Ahmedabad
        </text>
        <text x="300" y="160" textAnchor="middle" fill="currentColor" style={{ font: 'var(--type-tag)' }}>
          Mumbai
        </text>
        <g transform="translate(150 70)">
          <rect x="-26" y="-14" width="52" height="28" rx="14" style={{ fill: 'var(--fill-primary)' }} />
          <circle cx="-8" cy="0" r="5" style={{ fill: 'var(--text-primary-on)' }} />
          <circle cx="8" cy="0" r="5" style={{ fill: 'var(--fill-system-green)' }} />
        </g>
      </svg>

      <div style={{ display: 'grid', gap: '12px' }}>
        <button
          type="button"
          className="x-btn"
          onClick={() => setScreen('phone')}
        >
          Get started
        </button>
        <p className="x-sub" style={{ textAlign: 'center' }}>
          Pilot corridor: Ahmedabad–Mumbai
        </p>
      </div>
    </div>
  );
};
