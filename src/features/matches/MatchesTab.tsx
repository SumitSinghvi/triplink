'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';
import { extractJourneyKey, isPastTrip, tripTravelDate } from '@/lib/supabaseSync';
import type { IncomingRequestItem } from '@/store/useAppStore';
import { isCancelled } from '@/lib/flightLookup';
import { usePoll } from '@/lib/usePoll';

const FILTERS = ['All', 'Business', 'Social', 'Same industry'] as const;

export const MatchesTab: React.FC = () => {
  const {
    trips,
    selTripId,
    selectTrip,
    filter,
    setFilter,
    matches,
    incomingRequests,
    gone,
    req,
    openDetail,
    connectWith,
    acceptIncomingRequest,
    declineIncomingRequest,
    openChat,
    profile,
    setTab,
    refreshLiveMatches,
    syncUserRequests,
    refreshFlightTrip,
  } = useAppStore();

  const selectedTrip = trips.find((t) => t.id === selTripId) || trips[0];
  const tripId = selectedTrip?.id;
  // Past trips: load once, don't keep polling for co-travellers.
  const tripIsPast = selectedTrip ? isPastTrip(selectedTrip) : false;
  const cancelled = isCancelled(selectedTrip?.flightStatus);

  useEffect(() => {
    if (tripId) refreshFlightTrip(tripId).catch(() => {});
  }, [tripId, refreshFlightTrip]);

  useEffect(() => {
    if (tripId && !cancelled) {
      refreshLiveMatches(tripId).catch(() => {});
    }
    syncUserRequests().catch(() => {});
  }, [tripId, cancelled, refreshLiveMatches, syncUserRequests]);
  // Poll co-travellers every 15s (requests are polled app-wide in page.tsx).
  usePoll(
    () => tripId && refreshLiveMatches(tripId).catch(() => {}),
    15000,
    tripId && !tripIsPast && !cancelled ? tripId : null
  );

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

  // Requests are tied to a journey: show this trip's first, the rest under "Other trips".
  const selKey = extractJourneyKey(selectedTrip.name);
  const selDate = tripTravelDate(selectedTrip);
  const isForSelected = (r: IncomingRequestItem) => r.trainNumber === selKey && r.travelDate === selDate;
  const tripRequests = incomingRequests.filter(isForSelected);
  const otherRequests = incomingRequests.filter((r) => !isForSelected(r));
  const requestGroups = [
    { title: 'Incoming Requests', items: tripRequests },
    { title: 'Requests on your other trips', items: otherRequests },
  ].filter((g) => g.items.length > 0);
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

        <p className="x-sub" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{all.length} matches · {selectedTrip.route}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Live Co-Travelers
          </span>
        </p>

        {requestGroups.map((group) => (
          <div key={group.title} style={{ marginBottom: '16px' }}>
            <p className="x-sub" style={{ fontWeight: 600, color: 'var(--accent, #6366f1)', marginBottom: '8px' }}>
              {group.title} ({group.items.length})
            </p>
            {group.items.map((reqItem) => (
              <div key={reqItem.id} className="x-card" style={{ borderColor: 'var(--accent, #6366f1)' }}>
                <div className="x-m__top">
                  <span className="x-av">{reqItem.ini}</span>
                  <span className="x-m__name">
                    <b>{reqItem.name}</b>
                    <small>{reqItem.company} · {reqItem.industry}</small>
                  </span>
                  <span className="x-fit">{reqItem.fit}%<small>fit</small></span>
                </div>
                <p className="x-m__line" style={{ marginTop: '6px' }}>
                  Wants to connect on {reqItem.trainNumber} ({reqItem.travelDate})
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="x-btn x-btn--sm"
                    style={{ flex: 1 }}
                    onClick={() => acceptIncomingRequest(reqItem)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="x-btn x-btn--sm x-btn--subtle"
                    style={{ flex: 1 }}
                    onClick={() => declineIncomingRequest(reqItem.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {cancelled ? (
          <div className="x-note">
            <SvgIcon name="flag" size={18} />
            <span>This flight has been cancelled, so co-traveller matching is paused. Add your new flight to find people on it.</span>
          </div>
        ) : list.length > 0 ? (
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
                    {m.ticketVerified && (
                      <span className="x-ver">
                        <SvgIcon name="seal" size={16} width={0} />
                        Ticket
                      </span>
                    )}
                  </span>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (r === 'accepted') {
                        openChat(m.id);
                      } else if (r !== 'sent') {
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
            <b>No {filter === 'All' ? '' : `${filter.toLowerCase()} `}matches yet</b>
            <p style={{ color: 'var(--text-secondary,#6b7280)', fontSize: '13px', marginTop: '6px' }}>
              Matches will appear when other passengers on this train opt in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
