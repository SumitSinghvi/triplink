'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Coffee,
  Briefcase,
  Utensils,
  Repeat,
  Sparkles,
  Users,
} from 'lucide-react';
import { LoungeMessage, Trip, UserProfile } from '@/types';

interface TrainLoungeProps {
  messages: LoungeMessage[];
  currentTrip: Trip;
  currentUser: UserProfile;
  onSendMessage: (content: string, tag: LoungeMessage['tag']) => void;
}

const TAG_CONFIG: Record<
  LoungeMessage['tag'],
  { label: string; icon: React.FC<{ className?: string }>; color: string }
> = {
  general: { label: 'General', icon: MessageSquare, color: 'text-slate-400 bg-slate-800' },
  chai: { label: 'Chai Meet', icon: Coffee, color: 'text-amber-400 bg-amber-500/20' },
  networking: {
    label: 'Networking',
    icon: Briefcase,
    color: 'text-blue-400 bg-blue-500/20',
  },
  food: { label: 'Food & Pantry', icon: Utensils, color: 'text-orange-400 bg-orange-500/20' },
  'seat-swap': {
    label: 'Seat Swap',
    icon: Repeat,
    color: 'text-purple-400 bg-purple-500/20',
  },
};

export const TrainLounge: React.FC<TrainLoungeProps> = ({
  messages,
  currentTrip,
  currentUser,
  onSendMessage,
}) => {
  const [selectedTag, setSelectedTag] = useState<'all' | LoungeMessage['tag']>('all');
  const [inputText, setInputText] = useState('');
  const [activeSendTag, setActiveSendTag] = useState<LoungeMessage['tag']>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), activeSendTag);
    setInputText('');
  };

  const filteredMessages =
    selectedTag === 'all'
      ? messages
      : messages.filter((m) => m.tag === selectedTag);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[650px] shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm">
                Train {currentTrip.trainNumber} Lounge
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Live Chat
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Only verified passengers on {currentTrip.travelDate}
            </p>
          </div>
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              selectedTag === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            #All
          </button>
          <button
            onClick={() => setSelectedTag('chai')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              selectedTag === 'chai'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-amber-400 bg-slate-800/60'
            }`}
          >
            <Coffee className="w-3 h-3" />
            <span>#Chai</span>
          </button>
          <button
            onClick={() => setSelectedTag('networking')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              selectedTag === 'networking'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-indigo-400 bg-slate-800/60'
            }`}
          >
            <Briefcase className="w-3 h-3" />
            <span>#Network</span>
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No messages in this topic yet. Be the first to start a conversation!
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            const tagCfg = TAG_CONFIG[msg.tag] || TAG_CONFIG.general;
            const TagIcon = tagCfg.icon;

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                />

                <div
                  className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-xs ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{msg.senderName}</span>
                      {msg.senderCoach && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isMe ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-amber-300'
                          }`}
                        >
                          Coach {msg.senderCoach}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] opacity-75">{msg.timestamp}</span>
                  </div>

                  {msg.tag !== 'general' && (
                    <div className="mb-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-medium">
                      <TagIcon className="w-3 h-3" />
                      <span>#{tagCfg.label}</span>
                    </div>
                  )}

                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none">
        <span className="text-slate-500 font-medium flex items-center gap-1 flex-shrink-0">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Quick:
        </span>
        <button
          type="button"
          onClick={() => {
            setInputText('Anyone up for evening chai near the vestibule? ☕');
            setActiveSendTag('chai');
          }}
          className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition"
        >
          ☕ Chai Meetup
        </button>
        <button
          type="button"
          onClick={() => {
            setInputText('Any devs/founders here building with AI or Next.js?');
            setActiveSendTag('networking');
          }}
          className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition"
        >
          💼 Tech/Founders Talk
        </button>
        <button
          type="button"
          onClick={() => {
            setInputText('Looking to swap from Middle berth to Lower berth if possible!');
            setActiveSendTag('seat-swap');
          }}
          className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition"
        >
          🔄 Seat Swap Request
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        {/* Tag Picker */}
        <select
          value={activeSendTag}
          onChange={(e) => setActiveSendTag(e.target.value as LoungeMessage['tag'])}
          className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="general">#General</option>
          <option value="chai">#Chai</option>
          <option value="networking">#Network</option>
          <option value="seat-swap">#SeatSwap</option>
          <option value="food">#Food</option>
        </select>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message train co-travelers in coach ${currentTrip.coach || '...'}`}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
