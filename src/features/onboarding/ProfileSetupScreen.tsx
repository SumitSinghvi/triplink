'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

const IND = ['Textiles', 'Garments', 'Packaging', 'Chemicals', 'Machinery', 'Retail'];
const LOOK = ['Buy', 'Sell', 'Partner'];
const CITIES = ['Ahmedabad', 'Mumbai'];
const INTERESTS = ['Startups', 'Cricket', 'Food', 'Music', 'Reading'];
const LANGS = ['Hindi', 'Gujarati', 'English'];

export const ProfileSetupScreen: React.FC = () => {
  const {
    setScreen,
    modes,
    profile,
    updateProfileField,
    verifyGstin,
    saveProfileAndEnter,
  } = useAppStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar x-bar--back">
        <button
          type="button"
          className="x-icon-btn"
          onClick={() => setScreen('mode')}
          aria-label="Back"
        >
          <SvgIcon name="back" />
        </button>
        <h1>Create profile</h1>
      </header>

      <div className="x-body">
        {modes.business && (
          <>
            <p className="x-h">Business</p>
            <label className="x-field">
              <span>Full Name</span>
              <input
                className="x-input"
                placeholder="e.g. Rahul Sharma"
                value={profile.name}
                onChange={(e) => updateProfileField('name', e.target.value)}
              />
            </label>
            <label className="x-field">
              <span>Company</span>
              <input
                className="x-input"
                placeholder="e.g. Sharma Textiles"
                value={profile.company}
                onChange={(e) => updateProfileField('company', e.target.value)}
              />
            </label>
            <div className="x-field">
              <span>Industry</span>
              <div className="x-chips" role="group">
                {IND.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className="x-chip"
                    aria-pressed={profile.industry === o}
                    onClick={() => updateProfileField('industry', o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div className="x-field">
              <span>I&apos;m looking to</span>
              <div className="x-chips" role="group">
                {LOOK.map((o) => {
                  const sel = profile.look.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      className="x-chip"
                      aria-pressed={sel}
                      onClick={() => {
                        const next = sel
                          ? profile.look.filter((x) => x !== o)
                          : [...profile.look, o];
                        updateProfileField('look', next);
                      }}
                    >
                      {sel && <SvgIcon name="check" size={14} width={2.2} />}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="x-field">
              <span>Cities</span>
              <div className="x-chips" role="group">
                {CITIES.map((o) => {
                  const sel = profile.cities.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      className="x-chip"
                      aria-pressed={sel}
                      onClick={() => {
                        const next = sel
                          ? profile.cities.filter((x) => x !== o)
                          : [...profile.cities, o];
                        updateProfileField('cities', next);
                      }}
                    >
                      {sel && <SvgIcon name="check" size={14} width={2.2} />}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="x-field">
              <span>GSTIN (optional)</span>
              <div className="x-inline">
                <input
                  className="x-input"
                  placeholder="15-character GSTIN"
                  aria-label="GSTIN"
                  value={profile.gstin}
                  readOnly={profile.verified}
                  onChange={(e) => updateProfileField('gstin', e.target.value.toUpperCase())}
                />
                {!profile.verified && (
                  <button
                    type="button"
                    className="x-btn x-btn--sm"
                    onClick={verifyGstin}
                  >
                    Verify
                  </button>
                )}
              </div>
              {profile.verified ? (
                <span className="x-ver">
                  <SvgIcon name="seal" size={16} width={0} />
                  Verified business
                </span>
              ) : profile.gstErr ? (
                <span className="x-err">{profile.gstErr}</span>
              ) : null}
            </div>
          </>
        )}

        {modes.social && (
          <>
            <p className="x-h">Social</p>
            <label className="x-field">
              <span>First name</span>
              <input
                className="x-input"
                placeholder="e.g. Rahul"
                value={profile.first}
                onChange={(e) => updateProfileField('first', e.target.value)}
              />
            </label>
            <div className="x-field">
              <span>Interests</span>
              <div className="x-chips" role="group">
                {INTERESTS.map((o) => {
                  const sel = profile.interests.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      className="x-chip"
                      aria-pressed={sel}
                      onClick={() => {
                        const next = sel
                          ? profile.interests.filter((x) => x !== o)
                          : [...profile.interests, o];
                        updateProfileField('interests', next);
                      }}
                    >
                      {sel && <SvgIcon name="check" size={14} width={2.2} />}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="x-field">
              <span>Languages</span>
              <div className="x-chips" role="group">
                {LANGS.map((o) => {
                  const sel = profile.langs.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      className="x-chip"
                      aria-pressed={sel}
                      onClick={() => {
                        const next = sel
                          ? profile.langs.filter((x) => x !== o)
                          : [...profile.langs, o];
                        updateProfileField('langs', next);
                      }}
                    >
                      {sel && <SvgIcon name="check" size={14} width={2.2} />}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="x-note">
          <SvgIcon name="lock" size={18} />
          <span>Matches see your name, company and what you&apos;re looking for. Never your seat, coach or phone number.</span>
        </div>
      </div>

      <div className="x-foot">
        <button type="button" className="x-btn" onClick={saveProfileAndEnter}>
          Save
        </button>
      </div>
    </div>
  );
};
