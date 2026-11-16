'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore, TripData } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';
import { extractJourneyKey, isPastTrip, tripTravelDate } from '@/lib/supabaseSync';
import { julianToIso, parseBcbp } from '@/lib/bcbp';
import { readBoardingPassBarcode } from '@/lib/boardingPassScan';
import { isCancelled, isDelayed } from '@/lib/flightLookup';
import { PassPicker } from './PassPicker';

export const TripsTab: React.FC = () => {
  const { trips, openAddTrip, selectTrip, matches, gone, verifyTrip, showToast, refreshFlightTrip, removeTrip } =
    useAppStore();
  const [verifying, setVerifying] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TripData | null>(null);

  // Re-check upcoming flights when the list is viewed (store skips >7 days out and throttles).
  const flightIds = trips.filter((t) => t.kind === 'flight').map((t) => t.id).join(',');
  useEffect(() => {
    flightIds.split(',').filter(Boolean).forEach((id) => refreshFlightTrip(id).catch(() => {}));
  }, [flightIds, refreshFlightTrip]);

  const getMatchCount = (tripId: string) => {
    return matches.filter((m) => m.tripId === tripId && !gone[m.id]).length;
  };

  const upcoming = trips.filter((t) => !isPastTrip(t));
  const past = trips.filter(isPastTrip);

  const visLabel = (v: TripData['vis']) => {
    const on = [v.business && 'Business', v.social && 'Social'].filter(Boolean);
    return on.length ? 'Visible: ' + on.join(', ') : 'Hidden';
  };

  // Scan a boarding pass for an already-added flight. Checks here give clear errors; the server re-checks.
  const handleVerify = async (t: TripData, file: File) => {
    setVerifying(t.id);
    try {
      const raw = await readBoardingPassBarcode(file);
      const pass = raw ? parseBcbp(raw) : null;
      if (!raw || !pass) {
        showToast('No boarding-pass barcode found. Use a clear photo or screenshot of the barcode.');
        return;
      }
      const date = tripTravelDate(t);
      const key = extractJourneyKey(t.name);
      const leg = pass.legs.find((l) => `${l.carrier}${l.flightNumber}` === key);
      if (!leg || !date || julianToIso(leg.julianDay, date) !== date) {
        const l = pass.legs[0];
        showToast(`This pass is for ${l.carrier} ${l.flightNumber}, not ${t.name} on ${date ?? 'this date'}.`);
        return;
      }
      showToast((await verifyTrip(t.id, raw)) ? 'Boarding pass verified' : 'Could not verify this pass. Try again.');
    } catch (err) {
      console.warn('Boarding pass scan failed:', err);
      showToast('Could not read that image. Try another photo or screenshot.');
    } finally {
      setVerifying(null);
    }
  };

  const renderTrip = (t: TripData) => (
    <React.Fragment key={t.id}>
      <div className="x-trip">
        <button
          type="button"
          className="x-card"
          onClick={() => selectTrip(t.id)}
        >
          <span className="x-trip__top">
            <span className="x-trip__ic">
              <SvgIcon name={t.kind === 'flight' ? 'plane' : 'train'} size={20} />
            </span>
            <span>
              <b>{t.name}</b>
              <small>{t.route}</small>
            </span>
          </span>
          <span className="x-trip__when">{t.when}</span>
          <span className="x-trip__foot">
            <span className="x-m__tags">
              <span className="pill">{visLabel(t.vis)}</span>
              {t.vis.twoh && <span className="pill">2 h before only</span>}
              {t.ticketVerified && <span className="pill">Ticket verified</span>}
              {isCancelled(t.flightStatus) && (
                <span className="pill" style={{ color: 'var(--fill-system-red)' }}>Flight cancelled</span>
              )}
              {isDelayed(t.flightStatus) && <span className="pill">{t.flightStatus}</span>}
            </span>
            <span className="x-count">
              {getMatchCount(t.id)} matches{' '}
              <SvgIcon name="chev" size={16} />
            </span>
          </span>
        </button>
        <button
          type="button"
          className="x-trip__rm"
          onClick={() => setRemoving(t)}
          aria-label={`Remove trip ${t.name}`}
        >
          <SvgIcon name="trash" size={18} />
        </button>
      </div>
      {t.kind === 'flight' && !t.ticketVerified && !isPastTrip(t) && !isCancelled(t.flightStatus) && (
        <PassPicker
          small
          label={verifying === t.id ? 'Checking boarding pass...' : 'Verify with boarding pass'}
          disabled={!!verifying}
          style={{ marginTop: '-4px' }}
          onFile={(f) => handleVerify(t, f)}
        />
      )}
    </React.Fragment>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar">
        <h1 className="x-bar__big">Trips</h1>
        <button
          type="button"
          className="x-icon-btn x-icon-btn--fill"
          onClick={openAddTrip}
          aria-label="Add trip"
        >
          <SvgIcon name="plus" size={20} />
        </button>
      </header>

      <div className="x-body">
        <p className="x-h">Upcoming</p>

        {upcoming.length > 0 ? (
          upcoming.map((t) => renderTrip(t))
        ) : (
          <div className="x-empty" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>🚆</span>
            <b style={{ display: 'block', fontSize: '16px', marginBottom: '6px' }}>No upcoming trips</b>
            <p style={{ color: 'var(--text-secondary,#6b7280)', fontSize: '13px', marginBottom: '16px' }}>
              Add your journey by 10-digit PNR to connect with passengers on board.
            </p>
          </div>
        )}

        {past.length > 0 && (
          <>
            <p className="x-h">Past</p>
            {past.map((t) => renderTrip(t))}
          </>
        )}

        <button
          type="button"
          className="x-btn x-btn--line"
          onClick={openAddTrip}
        >
          <SvgIcon name="plus" size={18} /> Add trip
        </button>

        <div className="x-note">
          <SvgIcon name="shield" size={18} />
          <span>Only opted-in travellers on the same train or flight can see you, and both of you must accept before chatting.</span>
        </div>
      </div>

      {removing && (
        <>
          <div className="x-scrim" onClick={() => setRemoving(null)} />
          <div className="x-sheet" style={{ zIndex: 35 }} role="dialog" aria-label="Remove trip">
            <div className="x-grab" />
            <h3>Remove this trip?</h3>
            <div className="x-card" style={{ background: 'var(--fill-tertiary)' }}>
              <span className="x-trip__top">
                <span className="x-trip__ic">
                  <SvgIcon name={removing.kind === 'flight' ? 'plane' : 'train'} size={20} />
                </span>
                <span>
                  <b>{removing.name}</b>
                  <small>{removing.route} · {removing.when}</small>
                </span>
              </span>
            </div>
            <p className="x-sub">
              You&apos;ll stop showing up for co-travellers on this journey. Existing chats stay in Chats.
            </p>
            <button
              type="button"
              className="x-btn x-btn--danger"
              onClick={() => {
                removeTrip(removing.id);
                setRemoving(null);
              }}
            >
              <SvgIcon name="trash" size={18} /> Remove trip
            </button>
            <button type="button" className="x-btn" onClick={() => setRemoving(null)}>
              Keep trip
            </button>
          </div>
        </>
      )}
    </div>
  );
};
