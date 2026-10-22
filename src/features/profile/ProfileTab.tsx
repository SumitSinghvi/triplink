'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const ProfileTab: React.FC = () => {
  const {
    profile,
    phone,
    modes,
    toggleMode,
    pro,
    togglePro,
    openSheet,
    setScreen,
    resetAll,
    showToast,
  } = useAppStore();

  const displayName = profile.name || profile.first || 'Your Profile';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ME';

  const subtitle =
    [profile.company, profile.industry].filter(Boolean).join(' · ') ||
    (phone ? `+91 ${phone}` : 'No details added');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar">
        <h1 className="x-bar__big">Profile</h1>
      </header>

      <div className="x-body">
        <div className="x-card">
          <div className="x-m__top">
            <span className="x-av x-av--lg">{initials}</span>
            <span className="x-m__name">
              <b>{displayName}</b>
              <small>{subtitle}</small>
              {profile.verified ? (
                <span className="x-ver">
                  <SvgIcon name="seal" size={16} width={0} /> Verified business
                </span>
              ) : (
                <small style={{ color: 'var(--text-secondary,#6b7280)' }}>Not verified yet</small>
              )}
            </span>
          </div>

          <div className="x-m__tags">
            {(profile.cities || []).map((c) => (
              <span key={c} className="pill">
                {c}
              </span>
            ))}
            {(profile.look || []).map((l) => (
              <span key={l} className="pill">
                {l}
              </span>
            ))}
          </div>

          <div className="x-row2">
            <button
              type="button"
              className="x-btn x-btn--sm x-btn--line"
              style={{ width: '100%' }}
              onClick={() => setScreen('create')}
            >
              Edit profile
            </button>
            {!profile.verified && (
              <button
                type="button"
                className="x-btn x-btn--sm"
                style={{ width: '100%' }}
                onClick={() => setScreen('create')}
              >
                Verify GSTIN
              </button>
            )}
          </div>
        </div>

        <p className="x-h">Modes</p>
        <div className="x-list">
          <label className="x-li">
            <span className="x-li__main">
              Business<small>Buyers, suppliers, partners</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="x-switch"
              checked={modes.business}
              onChange={() => toggleMode('business')}
            />
          </label>
          <label className="x-li">
            <span className="x-li__main">
              Social<small>Cab shares, travel company</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="x-switch"
              checked={modes.social}
              onChange={() => toggleMode('social')}
            />
          </label>
        </div>

        <div className="x-card x-card--dark">
          <span className="x-ver">
            <SvgIcon name="star" size={16} width={1.8} /> TripLink Pro
          </span>
          <p style={{ font: 'var(--type-heading)' }}>
            See matches before you book, advanced filters, unlimited chats
          </p>
          <p className="x-sub">₹149/month</p>
          <button
            type="button"
            className="x-btn"
            disabled={pro}
            onClick={togglePro}
          >
            {pro ? 'Free trial active' : 'Try free for 7 days'}
          </button>
        </div>

        <p className="x-h">Privacy</p>
        <div className="x-list">
          <label className="x-li">
            <span className="x-li__main">
              Delete trip data after travel<small>Always on</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="x-switch"
              checked={true}
              disabled={true}
            />
          </label>
          <button
            type="button"
            className="x-li"
            onClick={() => showToast('Your data export is being prepared')}
          >
            <SvgIcon name="down" size={20} />
            <span className="x-li__main">Download my data</span>
            <span className="x-chev">
              <SvgIcon name="chev" size={18} />
            </span>
          </button>
          <button
            type="button"
            className="x-li x-li--danger"
            onClick={() => openSheet({ kind: 'delete' })}
          >
            <SvgIcon name="trash" size={20} />
            <span className="x-li__main">Delete account</span>
          </button>
        </div>

        <div className="x-list">
          <button
            type="button"
            className="x-li"
            onClick={() => openSheet({ kind: 'safety' })}
          >
            <SvgIcon name="shield" size={20} />
            <span className="x-li__main">
              Safety centre<small>Tips, blocking and reporting</small>
            </span>
            <span className="x-chev">
              <SvgIcon name="chev" size={18} />
            </span>
          </button>
        </div>

        <button
          type="button"
          className="x-btn x-btn--line"
          onClick={resetAll}
        >
          <SvgIcon name="out" size={18} /> Log out
        </button>
      </div>
    </div>
  );
};
