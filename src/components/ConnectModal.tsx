'use client';

import React, { useState } from 'react';
import { X, Coffee, Briefcase, BookOpen, Repeat, Send, ShieldCheck } from 'lucide-react';
import { UserProfile, Trip } from '@/types';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  targetTrip: Trip | null;
  currentTrip: Trip;
  onSendRequest: (data: {
    toUserId: string;
    icebreaker: string;
    customMessage: string;
    shareContactOnAccept: boolean;
  }) => void;
}

const ICEBREAKERS = [
  {
    icon: Coffee,
    text: 'Up for a cup of tea/coffee around the next big station?',
    label: 'Chai Meetup',
  },
  {
    icon: Briefcase,
    text: 'Saw your profile in Tech/Business! Would love to chat about ideas and projects during the ride.',
    label: 'Networking',
  },
  {
    icon: BookOpen,
    text: 'Traveling solo! Looking for someone to chat about books, travel, or just pass the time.',
    label: 'Casual Chat',
  },
  {
    icon: Repeat,
    text: 'Hey! Are you open to discussing a mutually convenient seat/berth swap?',
    label: 'Seat Swap',
  },
];

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  targetTrip,
  currentTrip,
  onSendRequest,
}) => {
  const [selectedIcebreaker, setSelectedIcebreaker] = useState(ICEBREAKERS[0].text);
  const [customNote, setCustomNote] = useState('');
  const [shareContact, setShareContact] = useState(true);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendRequest({
      toUserId: targetUser.id,
      icebreaker: selectedIcebreaker,
      customMessage: customNote.trim(),
      shareContactOnAccept: shareContact,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={targetUser.avatar}
              alt={targetUser.name}
              className="w-10 h-10 rounded-full object-cover border border-amber-400"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-white text-base">{targetUser.name}</h3>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400">
                {targetUser.role} {targetTrip?.coach ? `• Coach ${targetTrip.coach}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Choose an Icebreaker / Purpose:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ICEBREAKERS.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedIcebreaker === item.text;
                return (
                  <div
                    key={item.label}
                    onClick={() => setSelectedIcebreaker(item.text)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition text-xs ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/40 text-slate-200'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg mt-0.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">{item.label}</div>
                      <div className="text-[11px] mt-0.5">{item.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Add Personal Note (Optional)
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. I am in coach B4, seat 12. Let me know if you want to catch up!"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <input
              type="checkbox"
              id="shareContact"
              checked={shareContact}
              onChange={(e) => setShareContact(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
            />
            <label htmlFor="shareContact" className="text-xs text-slate-300 cursor-pointer">
              Share my contact info (WhatsApp / LinkedIn) automatically once accepted
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Connection Invite</span>
          </button>
        </form>
      </div>
    </div>
  );
};
