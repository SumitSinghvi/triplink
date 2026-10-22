'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

const FILTERS = ['All', 'Business', 'Social', 'Same industry'] as const;

export const MatchesTab: React.FC = () => {
  const {
    trips,
    selTripId,
    selectTrip,
    filter,
    setFilter,
    matches,
    gone,
    req,
    openDetail,
    connectWith,
    openChat,
    profile,
    setTab,
  } = useAppStore();

  const selectedTrip = trips.find((t) => t.id === selTripId) || trips[0];

  if (!selectedTrip) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header className="x-bar">
          <h1 className="x-bar__big">Matches</h1>
        </header>
        <div className="x-body">
          <div className="x-empty" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>👥</span>
            <b style={{ display: 'block', fontSize: '16px', marginBottom: '6px' }}>No trips active</b>
            <p style={{ color: 'var(--text-secondary,#6b7280)', fontSize: '13px', marginBottom: '16px' }}>
              Add your upcoming train or flight to see matching co-travelers.
            </p>
            <button
              type="button"
              className="x-btn x-btn--sm"
              onClick={() => setTab('trips')}
            >
              Go to Trips
            </button>
          </div>
        </div>
      </div>
    );
  }

  const all = matches.filter((m) => m.tripId === selectedTrip.id && !gone[m.id]);
  const list = all.filter((m) => {
    if (filter === 'All') return true;
    if (filter === 'Same industry') return m.industry.toLowerCase() === profile.industry.toLowerCase();
    return m.type === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar">
        <h1 className="x-bar__big">Matches</h1>
      </header>

      <div className="x-body">
        <label className="x-field">
          <span>Trip</span>
          <select
            className="x-select"
            value={selectedTrip.id}
            onChange={(e) => selectTrip(e.target.value)}
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.when}
              </option>
            ))}
          </select>
        </label>

        <div className="x-chips x-chips--scroll" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="x-chip"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <p className="x-sub">
          {all.length} matches · {selectedTrip.route}
        </p>

        {list.length > 0 ? (
          list.map((m) => {
            const r = req[m.id];
            const tags = m.type === 'Business' ? [m.industry] : [...(m.tags || [])];

            return (
              <div
                key={m.id}
                className="x-card"
                role="button"
                tabIndex={0}
                onClick={() => openDetail(m.id)}
              >
                <div className="x-m__top">
                  <span className={`x-av ${m.type === 'Social' ? 'x-av--soc' : ''}`}>
                    {m.ini}
                  </span>
                  <span className="x-m__name">
                    <b>{m.name}</b>
                    <small>{m.company}</small>
                  </span>
                  {m.fit ? (
                    <span className="x-fit">
                      {m.fit}%<small>fit</small>
                    </span>
                  ) : null}
                </div>

                {m.line && <p className="x-m__line">{m.line}</p>}

                <div className="x-m__foot">
                  <span className="x-m__tags">
                    <span className="pill">{m.type}</span>
                    {tags.map((t) => (
                      <span key={t} className="pill">
                        {t}
                      </span>
                    ))}
                    {m.verified && (
                      <span className="x-ver">
                        <SvgIcon name="seal" size={16} width={0} />
                        Verified
                      </span>
                    )}
                  </span>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (r === 'accepted') {
                        openChat(m.id);
                      } else if (!r) {
                        connectWith(m.id);
                      }
                    }}
                  >
                    {r === 'accepted' ? (
                      <button type="button" className="x-btn x-btn--sm">
                        Message
                      </button>
                    ) : r === 'sent' ? (
                      <span className="chip">Request sent</span>
                    ) : (
                      <button type="button" className="x-btn x-btn--sm">
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="x-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <b>No {filter.toLowerCase()} matches yet</b>
            <p style={{ color: 'var(--text-secondary,#6b7280)', fontSize: '13px', marginTop: '6px' }}>
              Matches will appear when other passengers on this train opt in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
