'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SvgIcon } from '@/shared/icons';
import { ActiveChatView } from './ActiveChatView';

export const ChatsTab: React.FC = () => {
  const { chats, unread, matches, openChat, activeChatId } = useAppStore();

  if (activeChatId) {
    return <ActiveChatView />;
  }

  const activeChatIds = Object.keys(chats);

  const lastText = (id: string) => {
    const list = chats[id] || [];
    const m = list.filter((x) => x.from !== 'sys').pop();
    return m ? (m.card ? 'Business card shared' : (m.from === 'me' ? 'You: ' : '') + (m.text || '')) : '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="x-bar">
        <h1 className="x-bar__big">Chats</h1>
      </header>

      <div className="x-body">
        {activeChatIds.length > 0 ? (
          <>
            <div className="x-list">
              {activeChatIds.map((id) => {
                const m = matches.find((item) => item.id === id);
                if (!m) return null;

                const hasUnread = unread[id];

                return (
                  <button
                    key={id}
                    type="button"
                    className="x-li"
                    onClick={() => openChat(id)}
                  >
                    <span className="x-av">{m.ini}</span>
                    <span className="x-li__main">
                      <b>{m.name}{hasUnread ? ' ·' : ''}</b>
                      <small>{lastText(id)}</small>
                    </span>
                    {hasUnread ? (
                      <span className="x-badge" style={{ position: 'static' }}>
                        1
                      </span>
                    ) : (
                      <span className="x-chev">
                        <SvgIcon name="chev" size={18} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="fineprint">Chats open only after both of you accept.</p>
          </>
        ) : (
          <div className="x-empty" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <SvgIcon name="chat" size={36} />
            <b style={{ display: 'block', marginTop: '12px' }}>No chats yet</b>
            <p style={{ color: 'var(--text-secondary,#6b7280)', fontSize: '13px', marginTop: '6px' }}>
              Connect with verified co-passengers on your train. Chats open once both accept.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
