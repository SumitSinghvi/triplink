'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';

export const MatchDetailSheet: React.FC = () => {
  const { sheet, closeSheet, matches, req, connectWith, openChat, blockPerson, openSheet } = useAppStore();

  if (!sheet || sheet.kind !== 'detail' || !sheet.id) return null;

  const m = matches.find((item) => item.id === sheet.id);
  if (!m) return null;

  const r = req[m.id];
  const tags = m.type === 'Business' ? [m.industry] : [...(m.tags || [])];

  return (
    <>
      <div className="x-scrim" onClick={closeSheet} />
      <div className="x-sheet" style={{ zIndex: 35 }}>
        <div className="x-grab" />

        <div className="x-m__top">
          <span className={`x-av x-av--lg ${m.type === 'Social' ? 'x-av--soc' : ''}`}>
            {m.ini}
          </span>
          <span className="x-m__name">
            <b>{m.name}</b>
            <small>{m.company}</small>
            {m.verified && (
              <span className="x-ver">
                <SvgIcon name="seal" size={16} width={0} />
                Verified business
              </span>
            )}
          </span>
        </div>

        {m.line && <p style={{ font: 'var(--type-heading)' }}>{m.line}</p>}

        <div className="x-m__tags">
          {tags.map((t) => (
            <span key={t} className="pill">
              {t}
            </span>
          ))}
        </div>

        {m.bio && <p className="x-sub">{m.bio}</p>}

        <div className="x-list">
          {m.coach && (
            <div className="x-li">
              <span className="x-li__main">
                <b>{m.coach}</b>
                <small>Same train</small>
              </span>
            </div>
          )}
          <button
            type="button"
            className="x-li"
            onClick={() => openSheet({ kind: 'report', id: m.id })}
          >
            <SvgIcon name="flag" size={20} />
            <span className="x-li__main">Report</span>
          </button>
          <button
            type="button"
            className="x-li x-li--danger"
            onClick={() => blockPerson(m.id)}
          >
            <SvgIcon name="block" size={20} />
            <span className="x-li__main">Block</span>
          </button>
        </div>

        <div className="x-foot" style={{ padding: 0, background: 'transparent' }}>
          {r === 'accepted' ? (
            <button
              type="button"
              className="x-btn"
              onClick={() => openChat(m.id)}
            >
              Message
            </button>
          ) : r === 'sent' ? (
            <span className="chip" style={{ width: '100%', textAlign: 'center', padding: '12px' }}>
              Request sent
            </span>
          ) : (
            <button
              type="button"
              className="x-btn"
              onClick={() => connectWith(m.id)}
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </>
  );
};
