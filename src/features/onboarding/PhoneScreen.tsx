'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const PhoneScreen: React.FC = () => {
  const setScreen = useAppStore((s) => s.setScreen);
  const phone = useAppStore((s) => s.phone);
  const setPhone = useAppStore((s) => s.setPhone);
  const showToast = useAppStore((s) => s.showToast);

  const handleSendOtp = () => {
    const clean = (phone || '').replace(/\D/g, '');
    if (clean.length < 10) {
      showToast('Enter a valid 10-digit mobile number');
      return;
    }
    setScreen('otp');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar x-bar--back">
        <button
          type="button"
          className="x-icon-btn"
          onClick={() => setScreen('welcome')}
          aria-label="Back"
        >
          <SvgIcon name="back" />
        </button>
      </header>

      <div className="x-body">
        <p className="x-big">What&apos;s your phone number?</p>
        <p className="x-sub">We&apos;ll text you a verification code. Your number is never shown to matches.</p>
        <div className="x-inline">
          <span className="x-prefix">+91</span>
          <input
            className="x-input"
            inputMode="tel"
            maxLength={10}
            placeholder="Enter 10-digit mobile"
            aria-label="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendOtp();
            }}
            autoFocus
          />
        </div>
      </div>

      <div className="x-foot">
        <button type="button" className="x-btn" onClick={handleSendOtp}>
          Send OTP
        </button>
      </div>
    </div>
  );
};
