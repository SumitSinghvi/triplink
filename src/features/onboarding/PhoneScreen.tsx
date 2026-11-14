'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const PhoneScreen: React.FC = () => {
  const setScreen = useAppStore((s) => s.setScreen);
  const phone = useAppStore((s) => s.phone);
  const setPhone = useAppStore((s) => s.setPhone);
  const showToast = useAppStore((s) => s.showToast);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const clean = (phone || '').replace(/\D/g, '');
    if (clean.length < 10) {
      showToast('Enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();

      if (data?.success) {
        showToast(data.message || 'OTP sent to mobile');
        setScreen('otp');
      } else {
        showToast(data?.error || 'Failed to send OTP. Try again.');
      }
    } catch {
      showToast('Network error while sending OTP');
    } finally {
      setLoading(false);
    }
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
        <button type="button" className="x-btn" disabled={loading} onClick={handleSendOtp}>
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </div>
    </div>
  );
};
