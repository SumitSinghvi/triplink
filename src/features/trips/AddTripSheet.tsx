'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const AddTripSheet: React.FC = () => {
  const { add, closeAddTrip, updateAddTrip, confirmAddTrip } = useAppStore();

  if (!add) return null;

  const handleFetch = async () => {
    if (add.kind === 'train') {
      const cleanPnr = add.pnr.replace(/\s/g, '');
      if (!/^\d{10}$/.test(cleanPnr)) {
        updateAddTrip({ err: 'Enter the 10-digit PNR from your ticket' });
        return;
      }
      updateAddTrip({ err: '', loading: true });

      try {
        const res = await fetch('/api/pnr/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pnr: cleanPnr }),
        });
        const json = await res.json();
        if (json && json.success && json.data) {
          const d = json.data;
          updateAddTrip({
            loading: false,
            found: {
              kind: 'train',
              name: `${d.trainName} (${d.trainNumber})`,
              route: `${d.fromName || d.fromCode} → ${d.toName || d.toCode}`,
              when: d.travelDate ? `${d.travelDate}` : 'Today',
              coach: d.coach,
              berth: d.berthNumber ? `Berth ${d.berthNumber} (${d.berthType || 'Confirmed'})` : '',
              pnrMasked: d.maskedPnr,
            },
          });
        } else {
          updateAddTrip({
            loading: false,
            err: `Not found: ${json?.error || json?.reason || 'Ticket not found in IRCTC database'}`,
          });
        }
      } catch {
        updateAddTrip({
          loading: false,
          err: 'Verification failed. Check network connection.',
        });
      }
    } else {
      if (!add.flight.trim()) {
        updateAddTrip({ err: 'Enter a flight number' });
        return;
      }
      updateAddTrip({ loading: true, err: '' });
      setTimeout(() => {
        updateAddTrip({
          loading: false,
          found: {
            kind: 'flight',
            name: add.flight.trim().toUpperCase(),
            route: 'Ahmedabad (AMD) → Mumbai (BOM)',
            when: add.date || 'Today',
          },
        });
      }, 500);
    }
  };

  const isStep2 = add.step === 2;
  const isTrain = add.kind === 'train';

  return (
    <>
      <div className="x-scrim" onClick={closeAddTrip} />
      <div className="x-sheet" style={{ zIndex: 35 }}>
        <div className="x-grab" />

        <header className="x-bar x-bar--back" style={{ padding: '0 0 10px' }}>
          <button
            type="button"
            className="x-icon-btn"
            onClick={isStep2 ? () => updateAddTrip({ step: 1 }) : closeAddTrip}
            aria-label={isStep2 ? 'Back' : 'Close'}
          >
            <SvgIcon name={isStep2 ? 'back' : 'close'} />
          </button>
          <h1>{isStep2 ? 'Visibility' : 'Add trip'}</h1>
        </header>

        <div className="x-steps" aria-label={`Step ${add.step} of 2`}>
          <span className="on" />
          <span className={isStep2 ? 'on' : ''} />
        </div>

        {isStep2 && add.found ? (
          <>
            <div className="x-card">
              <span className="x-trip__top">
                <span className="x-trip__ic">
                  <SvgIcon name={add.found.kind === 'flight' ? 'plane' : 'train'} size={20} />
                </span>
                <span>
                  <b>{add.found.name}</b>
                  <small>{add.found.route} · {add.found.when}</small>
                </span>
              </span>
            </div>

            <p className="x-h">Who can see you on this trip</p>
            <div className="x-list">
              <label className="x-li">
                <span className="x-li__main">Visible to Business matches</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="x-switch"
                  checked={add.vis.business}
                  onChange={(e) => updateAddTrip({ vis: { ...add.vis, business: e.target.checked } })}
                />
              </label>

              <label className="x-li">
                <span className="x-li__main">Visible to Social matches</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="x-switch"
                  checked={add.vis.social}
                  onChange={(e) => updateAddTrip({ vis: { ...add.vis, social: e.target.checked } })}
                />
              </label>

              <label className="x-li">
                <span className="x-li__main">
                  Women-only visibility
                  <small>Social matches only</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="x-switch"
                  disabled={!add.vis.social}
                  checked={add.vis.women && add.vis.social}
                  onChange={(e) => updateAddTrip({ vis: { ...add.vis, women: e.target.checked } })}
                />
              </label>

              <label className="x-li">
                <span className="x-li__main">Show me 2 hours before departure only</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="x-switch"
                  checked={add.vis.twoh}
                  onChange={(e) => updateAddTrip({ vis: { ...add.vis, twoh: e.target.checked } })}
                />
              </label>
            </div>

            <div className="x-note">
              <SvgIcon name="lock" size={18} />
              <span>We never show your seat, coach or phone number. Trip data is deleted after your journey.</span>
            </div>

            <div className="x-foot" style={{ padding: '14px 0 0' }}>
              <button type="button" className="x-btn" onClick={confirmAddTrip}>
                Confirm
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="x-seg" role="group" aria-label="Trip type">
              <button
                type="button"
                aria-pressed={isTrain}
                onClick={() => updateAddTrip({ kind: 'train', found: null, err: '' })}
              >
                Train
              </button>
              <button
                type="button"
                aria-pressed={!isTrain}
                onClick={() => updateAddTrip({ kind: 'flight', found: null, err: '' })}
              >
                Flight
              </button>
            </div>

            {isTrain ? (
              <label className="x-field">
                <span>PNR (10 digits)</span>
                <input
                  className="x-input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="e.g. 8655220078"
                  value={add.pnr}
                  onChange={(e) => updateAddTrip({ pnr: e.target.value.replace(/\D/g, ''), found: null, err: '' })}
                />
              </label>
            ) : (
              <>
                <label className="x-field">
                  <span>Flight number</span>
                  <input
                    className="x-input"
                    placeholder="e.g. 6E 214"
                    value={add.flight}
                    onChange={(e) => updateAddTrip({ flight: e.target.value, found: null, err: '' })}
                  />
                </label>
                <label className="x-field">
                  <span>Date</span>
                  <input
                    className="x-input"
                    type="date"
                    value={add.date}
                    onChange={(e) => updateAddTrip({ date: e.target.value })}
                  />
                </label>
              </>
            )}

            {add.err && (
              <span
                className="x-err"
                style={{
                  color: '#b91c1c',
                  background: '#fef2f2',
                  padding: '9px 12px',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '12px',
                  display: 'block',
                  lineHeight: '1.4',
                }}
              >
                {add.err}
              </span>
            )}

            {add.found && (
              <div className="x-card x-found">
                <span className="x-ver">
                  <SvgIcon name="seal" size={16} width={0} />
                  Trip found
                </span>
                <span className="x-trip__top">
                  <span className="x-trip__ic">
                    <SvgIcon name={add.found.kind === 'flight' ? 'plane' : 'train'} size={20} />
                  </span>
                  <span>
                    <b>{add.found.name}</b>
                    <small>{add.found.route}</small>
                  </span>
                </span>
                <span className="x-trip__when">{add.found.when}</span>
                {add.found.coach && (
                  <small style={{ display: 'block', marginTop: '6px', color: '#475569' }}>
                    Coach: <b>{add.found.coach}</b>{add.found.berth ? ` · ${add.found.berth}` : ''}
                  </small>
                )}
              </div>
            )}

            <div className="x-foot" style={{ padding: '14px 0 0' }}>
              {add.found ? (
                <button
                  type="button"
                  className="x-btn"
                  onClick={() => updateAddTrip({ step: 2 })}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="x-btn"
                  disabled={add.loading}
                  onClick={handleFetch}
                >
                  {add.loading ? 'Finding your trip…' : isTrain ? 'Fetch trip' : 'Find flight'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};
