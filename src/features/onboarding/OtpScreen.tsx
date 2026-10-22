'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const OtpScreen: React.FC = () => {
  const setScreen = useAppStore((s) => s.setScreen);
  const phone = useAppStore((s) => s.phone);
  const showToast = useAppStore((s) => s.showToast);

  const [digits, setDigits] = useState<string[]>(['1', '2', '3', '4']);
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3];

  useEffect(() => {
    // Focus first input safely after mount
    const timer = setTimeout(() => {
      ref0.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleVerify = () => {
    setScreen('mode');
  };

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < 3) {
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const chars = pasted.split('');
    const next = [...digits];
    chars.forEach((c, i) => {
      if (i < 4) next[i] = c;
    });
    setDigits(next);

    const focusIdx = Math.min(chars.length, 3);
    refs[focusIdx].current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden' }}>
      <header className="x-bar x-bar--back">
        <button
          type="button"
          className="x-icon-btn"
          onClick={() => setScreen('phone')}
          aria-label="Back"
        >
          <SvgIcon name="back" />
        </button>
      </header>

      <div className="x-body" style={{ overflowX: 'hidden' }}>
        <p className="x-big">Enter the 4-digit code</p>
        <p className="x-sub">
          Sent to +91 {phone || 'your mobile'}. Demo OTP <b>1234</b> is pre-filled.
        </p>

        <div
          className="x-otp"
          onPaste={handlePaste}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '10px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoComplete="one-time-code"
              style={{
                width: '100%',
                minWidth: 0,
                maxWidth: '100%',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          className="x-btn x-btn--sm x-btn--ghost"
          style={{ justifySelf: 'start', marginTop: '12px' }}
          onClick={() => {
            setDigits(['1', '2', '3', '4']);
            showToast('OTP code 1234 filled');
          }}
        >
          Fill demo code (1234)
        </button>
      </div>

      <div className="x-foot">
        <button type="button" className="x-btn" onClick={handleVerify}>
          Verify
        </button>
      </div>
    </div>
  );
};
