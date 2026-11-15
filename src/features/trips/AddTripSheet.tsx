'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';
import { DEMO_PRESET_PNRS } from '@/lib/mockData';
import { julianToIso, nameMatches, parseBcbp } from '@/lib/bcbp';
import { todayIso } from '@/lib/travelDate';
import type { AddTripModalState } from '@/types';

type FoundTrip = NonNullable<AddTripModalState['found']>;
type FlightLookup = { ok: true; found: FoundTrip } | { ok: false; status: number; error?: string };

// Server flight lookup (AeroDataBox). 404 = unknown flight -> manual entry is offered.
async function lookupFlight(flightNumber: string, date: string): Promise<FlightLookup> {
  const res = await fetch('/api/flights/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flightNumber, date }),
  });
  const json = await res.json();
  if (!json?.success || !json.data) return { ok: false, status: res.status, error: json?.error };
  const d = json.data;
  const fromTerm = d.fromTerminal ? ` (${d.fromTerminal})` : '';
  const toTerm = d.toTerminal ? ` (${d.toTerminal})` : '';
  return {
    ok: true,
    found: {
      kind: 'flight',
      name: `${d.airlineName} ${d.flightNumber}`,
      route: `${d.fromCity} (${d.fromCode})${fromTerm} → ${d.toCity} (${d.toCode})${toTerm}`,
      when: `${d.travelDate} · ${d.departureTime} - ${d.arrivalTime} (${d.duration})`,
      travelDate: d.travelDate,
      fromCode: d.fromCode,
      toCode: d.toCode,
      // ponytail: assumes IST departure (domestic corridor); use airport tz for international.
      departsAt: d.departureTime ? `${d.travelDate}T${d.departureTime}:00+05:30` : undefined,
    },
  };
}

// Boarding-pass barcode text from a photo/screenshot. Native BarcodeDetector (Android Chrome) when it
// supports PDF417, else the zxing-wasm ponyfill (iOS, desktop), loaded only when someone scans.
async function readBoardingPassBarcode(file: File): Promise<string | null> {
  const formats: ('pdf417' | 'aztec' | 'qr_code' | 'data_matrix')[] = ['pdf417', 'aztec', 'qr_code', 'data_matrix'];
  type Detector = typeof import('barcode-detector/ponyfill').BarcodeDetector;
  const Native = (globalThis as { BarcodeDetector?: Detector }).BarcodeDetector;
  const Impl: Detector =
    Native && (await Native.getSupportedFormats()).includes('pdf417')
      ? Native
      : (await import('barcode-detector/ponyfill')).BarcodeDetector;
  const codes = await new Impl({ formats }).detect(await createImageBitmap(file));
  return codes.find((c) => parseBcbp(c.rawValue))?.rawValue ?? null;
}

export const AddTripSheet: React.FC = () => {
  const { add, closeAddTrip, updateAddTrip, confirmAddTrip, profile } = useAppStore();

  if (!add) return null;

  const handleScan = async (file: File) => {
    updateAddTrip({ err: '', loading: true, found: null, manual: false });
    try {
      const raw = await readBoardingPassBarcode(file);
      const pass = raw ? parseBcbp(raw) : null;
      if (!raw || !pass) {
        updateAddTrip({
          loading: false,
          err: 'No boarding-pass barcode found. Use a clear photo or screenshot of the barcode.',
        });
        return;
      }
      const myName = profile.name || profile.first;
      if (myName && !nameMatches(pass.passengerName, myName)) {
        updateAddTrip({
          loading: false,
          err: `This pass is for ${pass.passengerName}, which doesn't match your profile name.`,
        });
        return;
      }
      const leg = pass.legs[0];
      const date = julianToIso(leg.julianDay, todayIso());
      const flight = `${leg.carrier} ${leg.flightNumber}`;
      const lookup = await lookupFlight(flight, date).catch(() => null);
      // The pass is the source of truth for the route; use lookup only for times/cities when it agrees.
      const base: FoundTrip =
        lookup?.ok && lookup.found.fromCode === leg.fromCode && lookup.found.toCode === leg.toCode
          ? lookup.found
          : {
              kind: 'flight',
              name: `Flight ${flight}`,
              route: `${leg.fromCode} → ${leg.toCode}`,
              when: date,
              travelDate: date,
              fromCode: leg.fromCode,
              toCode: leg.toCode,
            };
      updateAddTrip({
        loading: false,
        flight,
        date,
        found: { ...base, ticketVerified: true, boardingPass: raw },
      });
    } catch {
      updateAddTrip({ loading: false, err: 'Could not read that image. Try another photo or screenshot.' });
    }
  };

  const handleManual = () => {
    const m = add.flight.replace(/[\s-]/g, '').toUpperCase().match(/^([A-Z0-9]{2})(\d{1,4})$/);
    const from = add.manualFrom.trim().toUpperCase();
    const to = add.manualTo.trim().toUpperCase();
    if (!m) {
      updateAddTrip({ err: 'Enter a flight number like 6E 214' });
      return;
    }
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to) {
      updateAddTrip({ err: 'Enter both 3-letter airport codes, e.g. AMD and BOM' });
      return;
    }
    updateAddTrip({
      err: '',
      found: {
        kind: 'flight',
        name: `Flight ${m[1]} ${m[2]}`,
        route: `${from} → ${to}`,
        when: add.date,
        travelDate: add.date,
        fromCode: from,
        toCode: to,
      },
    });
  };

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
              when: d.travelDate,
              travelDate: d.travelDate,
              fromCode: d.fromCode || undefined,
              toCode: d.toCode || undefined,
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
      const cleanFlight = add.flight.trim();
      if (!cleanFlight) {
        updateAddTrip({ err: 'Enter a flight number (e.g. 6E 214 or AI 887)' });
        return;
      }
      updateAddTrip({ loading: true, err: '' });

      try {
        const r = await lookupFlight(cleanFlight, add.date);
        if (r.ok) {
          updateAddTrip({ loading: false, found: r.found });
        } else {
          updateAddTrip({
            loading: false,
            // Unknown flight: let them add it by hand instead of blocking.
            manual: r.status === 404,
            err:
              r.status === 404
                ? "We couldn't look this flight up. Add the airports below, or scan your boarding pass."
                : r.error || 'Flight not found. Please check flight number and date.',
          });
        }
      } catch {
        updateAddTrip({
          loading: false,
          err: 'Flight verification failed. Check network connection.',
        });
      }
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
              <>
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
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary,#6b7280)', fontWeight: 600 }}>Demo PNR chips:</span>
                  <div className="x-chips" style={{ marginTop: '4px', gap: '6px' }}>
                    {DEMO_PRESET_PNRS.map((p) => (
                      <button
                        key={p.pnr}
                        type="button"
                        className="x-chip"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => updateAddTrip({ pnr: p.pnr, found: null, err: '' })}
                      >
                        {p.pnr} ({p.trainName.split(' ')[0]})
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <label className="x-field">
                  <span>Flight number</span>
                  <input
                    className="x-input"
                    placeholder="e.g. 6E 214, AI 887, QP 1354"
                    value={add.flight}
                    onChange={(e) => updateAddTrip({ flight: e.target.value, found: null, err: '', manual: false })}
                  />
                </label>
                <label className="x-field">
                  <span>Date</span>
                  <input
                    className="x-input"
                    type="date"
                    value={add.date}
                    onChange={(e) => updateAddTrip({ date: e.target.value, found: null, manual: false })}
                  />
                </label>
                {add.manual && !add.found && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label className="x-field" style={{ flex: 1 }}>
                      <span>From airport</span>
                      <input
                        className="x-input"
                        placeholder="AMD"
                        maxLength={3}
                        autoCapitalize="characters"
                        value={add.manualFrom}
                        onChange={(e) => updateAddTrip({ manualFrom: e.target.value.replace(/[^a-z]/gi, ''), err: '' })}
                      />
                    </label>
                    <label className="x-field" style={{ flex: 1 }}>
                      <span>To airport</span>
                      <input
                        className="x-input"
                        placeholder="BOM"
                        maxLength={3}
                        autoCapitalize="characters"
                        value={add.manualTo}
                        onChange={(e) => updateAddTrip({ manualTo: e.target.value.replace(/[^a-z]/gi, ''), err: '' })}
                      />
                    </label>
                  </div>
                )}
                {!add.found && (
                  <label className="x-btn x-btn--line" style={{ marginTop: '10px', cursor: add.loading ? 'default' : 'pointer' }}>
                    <SvgIcon name="seal" size={18} width={0} />
                    Scan boarding pass (verified)
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={add.loading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = ''; // same file can be picked again
                        if (f) handleScan(f);
                      }}
                    />
                  </label>
                )}
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
                  {add.found.ticketVerified
                    ? 'Boarding pass verified'
                    : add.found.name.startsWith('Flight ')
                    ? 'Added manually · scan your boarding pass later to verify'
                    : 'Trip found'}
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
              ) : add.manual && !isTrain ? (
                <button type="button" className="x-btn" disabled={add.loading} onClick={handleManual}>
                  Add flight
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
