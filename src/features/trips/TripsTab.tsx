'use client';

import React from 'react';
import { useAppStore, TripData } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';
import { isPastTrip } from '@/lib/supabaseSync';

export const TripsTab: React.FC = () => {
  const { trips, openAddTrip, selectTrip, matches, gone } = useAppStore();

  const getMatchCount = (tripId: string) => {
    return matches.filter((m) => m.tripId === tripId && !gone[m.id]).length;
  };

  const upcoming = trips.filter((t) => !isPastTrip(t));
  const past = trips.filter(isPastTrip);

  const visLabel = (v: TripData['vis']) => {
    const on = [v.business && 'Business', v.social && 'Social'].filter(Boolean);
    return on.length ? 'Visible: ' + on.join(', ') : 'Hidden';
  };

  const renderTrip = (t: TripData) => (
    <button
      key={t.id}
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
        </span>
        <span className="x-count">
          {getMatchCount(t.id)} matches{' '}
          <SvgIcon name="chev" size={16} />
        </span>
      </span>
    </button>
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
    </div>
  );
};
