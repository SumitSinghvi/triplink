'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';
import { usePoll } from '@/lib/usePoll';

const QUICK = ['Share catalogue', 'Meet at station?', "Let's connect after the trip"];

export const ActiveChatView: React.FC = () => {
  const {
    activeChatId,
    closeChat,
    matches,
    chats,
    req,
    sendMessage,
    shareBusinessCard,
    profile,
    phone,
    blockPerson,
    openSheet,
    syncChatMessages,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const m = matches.find((item) => item.id === activeChatId);
  const msgs = useMemo(
    () => (activeChatId ? chats[activeChatId] || [] : []),
    [chats, activeChatId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    if (activeChatId) syncChatMessages(activeChatId).catch(() => {});
  }, [activeChatId, syncChatMessages]);
  // Poll every 5s instead of Realtime WebSocket (avoids page hang)
  usePoll(() => activeChatId && syncChatMessages(activeChatId).catch(() => {}), 5000, activeChatId);

  if (!m) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const meName = profile.name || profile.first || 'You';
  const meSub = [profile.company, profile.industry].filter(Boolean).join(' · ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <header className="x-bar x-bar--back">
        <button
          type="button"
          className="x-icon-btn"
          onClick={closeChat}
          aria-label="Back"
        >
          <SvgIcon name="back" />
        </button>

        <span className="x-chathead">
          <span className="x-av x-av--sm">{m.ini}</span>
          <span style={{ minWidth: 0 }}>
            <b>{m.name}</b>
            <small>{m.company}</small>
          </span>
        </span>

        <button
          type="button"
          className="x-icon-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          <SvgIcon name="more" />
        </button>
      </header>

      {/* Menu overlay */}
      {menuOpen && (
        <div className="x-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              shareBusinessCard();
              setMenuOpen(false);
            }}
          >
            <SvgIcon name="card" size={20} /> Share business card
          </button>
          <button
            type="button"
            role="menuitem"
            className="x-li--danger"
            onClick={() => {
              blockPerson(m.id);
              setMenuOpen(false);
            }}
          >
            <SvgIcon name="block" size={20} /> Block
          </button>
          <button
            type="button"
            role="menuitem"
            className="x-li--danger"
            onClick={() => {
              openSheet({ kind: 'report', id: m.id });
              setMenuOpen(false);
            }}
          >
            <SvgIcon name="flag" size={20} /> Report
          </button>
        </div>
      )}

      {/* Chat messages */}
      <div className="x-body" id="msgs">
        <div className="x-msgs">
          {req[m.id] === 'accepted' && (
            <p className="x-sys">You and {m.name} are connected.</p>
          )}
          {msgs.map((x, idx) => {
            if (x.from === 'sys') {
              return (
                <p key={idx} className="x-sys">
                  {x.text}
                </p>
              );
            }

            const delivery =
              x.status === 'failed' ? (
                <small style={{ display: 'block', color: '#b91c1c' }}>Not sent</small>
              ) : x.status === 'pending' ? (
                <small style={{ display: 'block', opacity: 0.6 }}>Sending…</small>
              ) : null;

            if (x.card) {
              // A card shows the sender's details: mine for my cards, the partner's for theirs.
              const mine = x.from === 'me';
              return (
                <div key={x.id || idx} className={`x-msg x-msg--${x.from}`}>
                  <div className="x-msg__card">
                    <b>{mine ? meName : m.name}</b>
                    <span>{mine ? meSub : [m.company, m.industry].filter(Boolean).join(' · ')}</span>
                    {mine && <small>+91 {phone || 'shared by you'}</small>}
                  </div>
                  {delivery}
                </div>
              );
            }

            return (
              <div key={x.id || idx} className={`x-msg x-msg--${x.from}`}>
                {x.text}
                {delivery}
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer with quick chips */}
      <div className="x-composer">
        <div className="x-chips x-chips--scroll">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              className="x-chip"
              onClick={() => sendMessage(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="x-input"
            id="draft"
            placeholder="Message"
            aria-label="Message"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="x-send"
            aria-label="Send"
            disabled={!input.trim()}
          >
            <SvgIcon name="send" size={20} width={2} />
          </button>
        </form>
      </div>
    </div>
  );
};
