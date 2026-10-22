'use client';

import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle,
  XCircle,
  Phone,
  Send,
  ExternalLink,
  Clock,
  ArrowLeft,
  Coffee,
} from 'lucide-react';
import { ConnectRequest, DirectMessage, UserProfile, Trip } from '@/types';

interface InboxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  connectRequests: ConnectRequest[];
  allUsers: UserProfile[];
  directMessages: DirectMessage[];
  activeChatRequestId: string | null;
  onSelectChat: (requestId: string | null) => void;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  onSendDirectMessage: (requestId: string, toUserId: string, content: string) => void;
}

export const InboxDrawer: React.FC<InboxDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  connectRequests,
  allUsers,
  directMessages,
  activeChatRequestId,
  onSelectChat,
  onAcceptRequest,
  onDeclineRequest,
  onSendDirectMessage,
}) => {
  const [replyText, setReplyText] = useState('');

  if (!isOpen) return null;

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Incoming pending requests
  const pendingRequests = connectRequests.filter(
    (r) => r.toUserId === currentUser.id && r.status === 'pending'
  );

  // Active / accepted connections
  const acceptedRequests = connectRequests.filter(
    (r) =>
      (r.fromUserId === currentUser.id || r.toUserId === currentUser.id) &&
      r.status === 'accepted'
  );

  // Active chat session
  const activeRequest = activeChatRequestId
    ? connectRequests.find((r) => r.id === activeChatRequestId)
    : null;

  const activePeer = activeRequest
    ? userMap.get(
        activeRequest.fromUserId === currentUser.id
          ? activeRequest.toUserId
          : activeRequest.fromUserId
      )
    : null;

  const currentChatMessages = activeRequest
    ? directMessages.filter((m) => m.requestId === activeRequest.id)
    : [];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeRequest || !activePeer) return;
    onSendDirectMessage(activeRequest.id, activePeer.id, replyText.trim());
    setReplyText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeChatRequestId ? (
              <button
                onClick={() => onSelectChat(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white mr-1 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <MessageSquare className="w-5 h-5 text-blue-400" />
            )}
            <div>
              <h3 className="font-bold text-white text-sm">
                {activeChatRequestId && activePeer
                  ? activePeer.name
                  : 'Messages & Invites'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {activeChatRequestId && activePeer
                  ? activePeer.role
                  : `${pendingRequests.length} pending • ${acceptedRequests.length} connected`}
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

        {/* Content area */}
        {activeChatRequestId && activePeer && activeRequest ? (
          // 1-on-1 Direct Chat View
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Peer info strip */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePeer.avatar}
                  alt={activePeer.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <span className="font-bold text-white block">{activePeer.name}</span>
                  <span className="text-[10px] text-emerald-400">Connected for Trip</span>
                </div>
              </div>

              {/* Shared contact handles */}
              <div className="flex items-center gap-2">
                {activePeer.linkedinUrl && (
                  <a
                    href={activePeer.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-blue-900/40 hover:bg-blue-800 text-blue-300 border border-blue-700/50"
                    title="View LinkedIn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {activePeer.phoneOrWhatsapp && (
                  <a
                    href={`https://wa.me/${activePeer.phoneOrWhatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/50"
                    title="Chat on WhatsApp"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Icebreaker note banner */}
            <div className="p-3 m-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-xs text-blue-200 flex items-start gap-2">
              <Coffee className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white block mb-0.5">Invite Note:</strong>
                <p className="text-[11px] text-slate-300">{activeRequest.icebreaker}</p>
                {activeRequest.customMessage && (
                  <p className="text-[11px] text-slate-400 mt-1 italic">
                    &quot;{activeRequest.customMessage}&quot;
                  </p>
                )}
              </div>
            </div>

            {/* Direct messages feed */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {currentChatMessages.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Connection accepted! Say hello or agree on a coach to meet for chai.
                </div>
              ) : (
                currentChatMessages.map((msg) => {
                  const isMe = msg.fromUserId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply box */}
            <form onSubmit={handleSendReply} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Message ${activePeer.name}...`}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          // Requests and Conversations List
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Pending Invites */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Invites ({pendingRequests.length})</span>
              </h4>

              {pendingRequests.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
                  No pending invites right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => {
                    const sender = userMap.get(req.fromUserId);
                    if (!sender) return null;

                    return (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sender.avatar}
                            alt={sender.name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          <div>
                            <span className="font-bold text-white block">
                              {sender.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {sender.role}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-900 p-2 rounded-lg text-[11px] text-slate-300">
                          <p className="font-medium text-amber-300">{req.icebreaker}</p>
                          {req.customMessage && (
                            <p className="text-slate-400 mt-1">&quot;{req.customMessage}&quot;</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => onAcceptRequest(req.id)}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => onDeclineRequest(req.id)}
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center justify-center gap-1 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Connections */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Connected Co-Travelers ({acceptedRequests.length})</span>
              </h4>

              {acceptedRequests.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
                  No active connections yet. Send an invite to co-passengers on your train!
                </div>
              ) : (
                <div className="space-y-2">
                  {acceptedRequests.map((req) => {
                    const peerId =
                      req.fromUserId === currentUser.id ? req.toUserId : req.fromUserId;
                    const peer = userMap.get(peerId);
                    if (!peer) return null;

                    return (
                      <div
                        key={req.id}
                        onClick={() => onSelectChat(req.id)}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={peer.avatar}
                            alt={peer.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <span className="font-bold text-white block">{peer.name}</span>
                            <span className="text-[10px] text-slate-400">{peer.role}</span>
                          </div>
                        </div>

                        <button className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-medium hover:bg-blue-600 hover:text-white transition">
                          Open Chat
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
