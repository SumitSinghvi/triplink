'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

const REASONS = ['Spam', 'Harassment', 'Fake profile', 'Other'];

export const SafetySheet: React.FC = () => {
  const { sheet, closeSheet, blockPerson, resetAll, showToast } = useAppStore();

  if (!sheet || sheet.kind === 'detail' || sheet.kind === 'addTrip') return null;

  if (sheet.kind === 'safety') {
    return (
      <>
        <div className="x-scrim" onClick={closeSheet} />
        <div className="x-sheet" style={{ zIndex: 35 }}>
          <div className="x-grab" />
          <h3>Safety centre</h3>
          <p className="x-sub">TripLink is built around consent and verification.</p>
          <div className="x-list">
            <div className="x-li">
              <span className="x-li__main">
                <b>Privacy first</b>
                <small>Seat, coach and phone numbers are never shared.</small>
              </span>
            </div>
            <div className="x-li">
              <span className="x-li__main">
                <b>Mutual opt-in</b>
                <small>Chats only open when both travelers accept.</small>
              </span>
            </div>
            <div className="x-li">
              <span className="x-li__main">
                <b>Verified identities</b>
                <small>Look for the Verified badge for GST-registered profiles.</small>
              </span>
            </div>
            <div className="x-li">
              <span className="x-li__main">
                <b>Railway helpline 139</b>
                <small>Available 24x7 for security and passenger assistance.</small>
              </span>
            </div>
          </div>
          <button type="button" className="x-btn" onClick={closeSheet}>
            Done
          </button>
        </div>
      </>
    );
  }

  if (sheet.kind === 'report') {
    return (
      <>
        <div className="x-scrim" onClick={closeSheet} />
        <div className="x-sheet" style={{ zIndex: 35 }}>
          <div className="x-grab" />
          <h3>Report member</h3>
          <p className="x-sub">Tell us why you&apos;re reporting this profile. Reports are reviewed within 2 hours.</p>
          <div className="x-list">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="x-li"
                onClick={() => {
                  if (sheet.id) blockPerson(sheet.id);
                  closeSheet();
                  showToast('Thank you. Report received and user blocked.');
                }}
              >
                <span className="x-li__main">{r}</span>
                <SvgIcon name="chev" size={18} />
              </button>
            ))}
          </div>
          <button type="button" className="x-btn x-btn--line" onClick={closeSheet}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  if (sheet.kind === 'delete') {
    return (
      <>
        <div className="x-scrim" onClick={closeSheet} />
        <div className="x-sheet" style={{ zIndex: 35 }}>
          <div className="x-grab" />
          <h3>Delete account?</h3>
          <p className="x-sub">This immediately removes all your trips, chats and personal details from TripLink.</p>
          <button
            type="button"
            className="x-btn x-btn--line"
            style={{ color: 'var(--fill-system-red)', borderColor: 'var(--fill-system-red)' }}
            onClick={() => {
              resetAll();
              closeSheet();
            }}
          >
            Delete everything
          </button>
          <button type="button" className="x-btn" onClick={closeSheet}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  return null;
};
