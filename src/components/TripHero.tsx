'use client';

import React from 'react';
import {
  Train,
  Calendar,
  Users,
  Compass,
  Sparkles,
  Lock,
  ArrowRight,
  Share2,
  CheckCircle,
} from 'lucide-react';
import { Trip, UserProfile } from '@/types';

interface TripHeroProps {
  trip: Trip;
  coTravelersCount: number;
  sameCoachCount: number;
  matchedInterestCount: number;
  currentUser: UserProfile;
  onChangeTrip: () => void;
}

export const TripHero: React.FC<TripHeroProps> = ({
  trip,
  coTravelersCount,
  sameCoachCount,
  matchedInterestCount,
  currentUser,
  onChangeTrip,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(
        `I'm traveling on ${trip.trainNumber} ${trip.trainName} on ${trip.travelDate}! Connect with me on RailMeet: ${window.location.origin}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formattedDate = new Date(trip.travelDate).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-900/40 p-6 sm:p-8 shadow-xl text-white">
      {/* Background railway glow effect */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Top bar: live status + masked PNR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Active Journey Active Co-Travelers Match
            </span>
          </div>

          <div className="flex items-center gap-3">
            {trip.pnrHash && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700 text-xs text-slate-300">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>PNR:</span>
                <span className="font-mono text-white font-medium">{trip.pnrHash}</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                  Private
                </span>
              </div>
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition"
              title="Share train link"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Route & Train Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-6">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold tracking-wide">
              <Train className="w-4 h-4" />
              <span>{trip.trainNumber}</span>
              <span>•</span>
              <span className="text-white">{trip.trainName}</span>
            </div>

            {/* Station Route visualization */}
            <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-6">
              <div>
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {trip.fromCode}
                </span>
                <p className="text-xs text-slate-400">{trip.fromName}</p>
              </div>

              <div className="flex items-center gap-2 text-slate-500">
                <div className="h-0.5 w-8 sm:w-16 bg-slate-700" />
                <ArrowRight className="w-5 h-5 text-amber-400" />
                <div className="h-0.5 w-8 sm:w-16 bg-slate-700" />
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {trip.toCode}
                </span>
                <p className="text-xs text-slate-400">{trip.toName}</p>
              </div>

              <div className="sm:ml-6 flex items-center gap-2 text-xs text-slate-300 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{formattedDate}</span>
              </div>
            </div>

            {/* Coach & Berth tags */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                Class: {trip.travelClass}
              </span>
              {trip.coach && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium font-mono">
                  Coach: {trip.coach}
                </span>
              )}
              {trip.berthType && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  Berth: {trip.berthType}
                </span>
              )}
              <button
                onClick={onChangeTrip}
                className="text-xs text-slate-400 hover:text-amber-400 underline underline-offset-4 ml-2 transition"
              >
                Change Train or Date
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="lg:col-span-4 grid grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-center">
              <div className="flex items-center justify-center text-blue-400 mb-1">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {coTravelersCount}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                Co-Travelers
              </div>
            </div>

            <div className="text-center border-x border-slate-800">
              <div className="flex items-center justify-center text-amber-400 mb-1">
                <Compass className="w-5 h-5" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-amber-400">
                {sameCoachCount}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                In Coach {trip.coach || 'Nearby'}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center text-emerald-400 mb-1">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                {matchedInterestCount}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                Interest Matches
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
