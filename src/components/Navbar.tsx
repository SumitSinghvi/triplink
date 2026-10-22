'use client';

import React from 'react';
import { Train, Bell, User, PlusCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { Trip, UserProfile, ConnectRequest } from '@/types';

interface NavbarProps {
  currentTrip: Trip | null;
  currentUser: UserProfile;
  connectRequests: ConnectRequest[];
  onOpenTripModal: () => void;
  onOpenInbox: () => void;
  onOpenProfile: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTrip,
  currentUser,
  connectRequests,
  onOpenTripModal,
  onOpenInbox,
  onOpenProfile,
  onResetData,
}) => {
  const pendingCount = connectRequests.filter(
    (r) => r.toUserId === currentUser.id && r.status === 'pending'
  ).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-blue-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Train className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-400 bg-clip-text text-transparent">
                RailMeet
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Connect with co-travelers on your train
            </p>
          </div>
        </div>

        {/* Current Trip Pill */}
        {currentTrip && (
          <div
            onClick={onOpenTripModal}
            className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 hover:border-amber-500/50 hover:bg-slate-800 transition cursor-pointer text-xs"
            title="Click to change train or enter new PNR"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">
              {currentTrip.trainNumber} {currentTrip.trainName}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-amber-400 font-medium">
              {currentTrip.fromCode} ➔ {currentTrip.toCode}
            </span>
            {currentTrip.coach && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px]">
                {currentTrip.coach}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* New Trip / PNR Button */}
          <button
            onClick={onOpenTripModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium transition shadow-sm hover:shadow"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Add PNR / Trip</span>
            <span className="sm:hidden">PNR</span>
          </button>

          {/* Inbox / Requests Bell */}
          <button
            onClick={onOpenInbox}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title="View Connect Requests & Chats"
          >
            <Bell className="w-4 h-4" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center justify-center animate-bounce">
                {pendingCount}
              </span>
            )}
          </button>

          {/* User Profile Pill */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition text-xs"
          >
            {currentUser.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-amber-400/50"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="font-semibold text-slate-200 leading-tight flex items-center gap-1">
                {currentUser.name}
                <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
              </div>
              <span className="text-[10px] text-slate-400">Edit Profile</span>
            </div>
          </button>

          {/* Reset Demo button */}
          <button
            onClick={onResetData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Reset demo data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
