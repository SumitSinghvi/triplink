'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const OtpScreen: React.FC = () => {
  const setScreen = useAppStore((s) => s.setScreen);
  const phone = useAppStore((s) => s.phone);
  const showToast = useAppStore((s) => s.showToast);
  const loginUser = useAppStore((s) => s.loginUser);

  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3];

  useEffect(() => {
    const timer = setTimeout(() => {
      ref0.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleVerify = async () => {
    const entered = digits.join('').trim();
    if (entered.length < 4) {
      showToast('Enter the 4-digit code');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: entered }),
      });
      const data = await res.json();

      if (data?.success) {
        showToast('Phone verified successfully');
        if (data.userId) {
          if (data.profile) {
            loginUser(data.userId, {
              name: data.profile.name || '',
              company: data.profile.company || '',
              industry: data.profile.industry || 'Textiles',
              look: data.profile.intent ? [data.profile.intent] : ['Sell'],
              cities: data.profile.cities || ['Ahmedabad', 'Mumbai'],
              gstin: data.profile.gstin || '',
              verified: data.profile.is_verified || false,
              first: data.profile.first_name || '',
              interests: data.profile.interests || [],
              langs: data.profile.langs || [],
            }, {
              business: data.profile.mode_business ?? true,
              social: data.profile.mode_social ?? false,
            });
            setScreen('main');
          } else {
            loginUser(data.userId);
            setScreen('mode');
          }
        } else {
          setScreen('mode');
        }
      } else {
        showToast(data?.error || 'Incorrect OTP.');
      }
    } catch {
      showToast('Verification failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data?.success) {
        showToast('New OTP sent via SMS');
      } else {
        showToast(data?.error || 'Failed to resend OTP');
      }
    } catch {
      showToast('Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    let typed = value.replace(/\D/g, '');
    // Typing over a filled box gives "old+new": keep the new digit. Longer input is
    // SMS autofill / fast typing: spread it across this and the following boxes.
    if (digits[index] && typed.length === 2) typed = typed.slice(-1);
    typed = typed.slice(0, 4 - index);
    // Functional update: rapid change events must not overwrite each other's digits.
    setDigits((prev) => {
      const next = [...prev];
      if (!typed) next[index] = '';
      typed.split('').forEach((c, i) => (next[index + i] = c));
      return next;
    });
    if (typed) refs[Math.min(index + typed.length, 3)].current?.focus();
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
          Sent to +91 {phone || 'your mobile'}. Enter the code received via SMS.
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

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            className="x-btn x-btn--sm x-btn--ghost"
            disabled={resending}
            onClick={handleResend}
          >
            {resending ? 'Sending...' : 'Resend code'}
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <button
              type="button"
              className="x-btn x-btn--sm x-btn--ghost"
              onClick={() => {
                setDigits(['1', '2', '3', '4']);
                showToast('Demo OTP 1234 filled');
              }}
            >
              Demo code (1234)
            </button>
          )}
        </div>
      </div>

      <div className="x-foot">
        <button type="button" className="x-btn" disabled={loading} onClick={handleVerify}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
};
