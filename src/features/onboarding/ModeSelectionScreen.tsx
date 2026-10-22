'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const ModeSelectionScreen: React.FC = () => {
  const { setScreen, modes, toggleMode } = useAppStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar x-bar--back">
        <button
          type="button"
          className="x-icon-btn"
          onClick={() => setScreen('otp')}
          aria-label="Back"
        >
          <SvgIcon name="back" />
        </button>
      </header>

      <div className="x-body">
        <p className="x-big">How do you travel?</p>
        <p className="x-sub">Pick at least one mode. You can switch any time in profile.</p>

        <button
          type="button"
          className="x-mode"
          aria-pressed={modes.business}
          onClick={() => toggleMode('business')}
        >
          <span className="x-modeicon">
            <SvgIcon name="brief" />
          </span>
          <span>
            <h3>Business</h3>
            <p>Find buyers, suppliers and partners on your trip</p>
          </span>
          <span className="x-tick">
            <SvgIcon name="check" size={16} width={2.4} />
          </span>
        </button>

        <button
          type="button"
          className="x-mode"
          aria-pressed={modes.social}
          onClick={() => toggleMode('social')}
        >
          <span className="x-modeicon">
            <SvgIcon name="smile" />
          </span>
          <span>
            <h3>Social</h3>
            <p>Share a cab, find travel company</p>
          </span>
          <span className="x-tick">
            <SvgIcon name="check" size={16} width={2.4} />
          </span>
        </button>
      </div>

      <div className="x-foot">
        <button
          type="button"
          className="x-btn"
          disabled={!modes.business && !modes.social}
          onClick={() => setScreen('create')}
        >
          Continue
        </button>
      </div>
    </div>
  );
};
