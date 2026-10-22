'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  Coffee,
  Check,
  Compass,
  Sparkles,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { UserProfile, Trip, InterestCategory, ConnectRequest } from '@/types';

interface CoTravelersListProps {
  coTravelers: { user: UserProfile; trip: Trip }[];
  corridorTravelers: { user: UserProfile; trip: Trip }[];
  currentTrip: Trip;
  currentUser: UserProfile;
  connectRequests: ConnectRequest[];
  onOpenConnectModal: (user: UserProfile, trip: Trip) => void;
  onOpenChat: (requestId: string) => void;
}

const INTERESTS: ('All' | InterestCategory)[] = [
  'All',
  'Tech & AI',
  'Startups & Business',
  'Finance & Crypto',
  'Career & Mentorship',
  'UPSC & Govt Exams',
  'Casual & Chai',
  'Books & Ideas',
  'Travel & Photography',
];

export const CoTravelersList: React.FC<CoTravelersListProps> = ({
  coTravelers,
  corridorTravelers,
  currentTrip,
  currentUser,
  connectRequests,
  onOpenConnectModal,
  onOpenChat,
}) => {
  const [selectedInterest, setSelectedInterest] = useState<'All' | InterestCategory>('All');
  const [onlySameCoach, setOnlySameCoach] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCorridor, setShowCorridor] = useState(false);

  // Filter logic
  const filtered = coTravelers.filter(({ user, trip }) => {
    // Interest filter
    if (selectedInterest !== 'All' && !user.interests.includes(selectedInterest)) {
      return false;
    }
    // Coach filter
    if (onlySameCoach && trip.coach !== currentTrip.coach) {
      return false;
    }
    // Women only filter
    if (womenOnly && user.gender !== 'female') {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = user.name.toLowerCase().includes(q);
      const matchRole = user.role.toLowerCase().includes(q);
      const matchCompany = user.companyOrOrg?.toLowerCase().includes(q);
      const matchBio = user.bio.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchCompany && !matchBio) return false;
    }
    return true;
  });

  const getRequestForUser = (userId: string) => {
    return connectRequests.find(
      (r) =>
        (r.fromUserId === currentUser.id && r.toUserId === userId) ||
        (r.fromUserId === userId && r.toUserId === currentUser.id)
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search co-travelers by name, company, or keyword..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Toggle pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Same coach toggle */}
            {currentTrip.coach && (
              <button
                onClick={() => setOnlySameCoach(!onlySameCoach)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 ${
                  onlySameCoach
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Coach {currentTrip.coach} Only</span>
              </button>
            )}

            {/* Women travelers toggle */}
            <button
              onClick={() => setWomenOnly(!womenOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 ${
                womenOnly
                  ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Women Only</span>
            </button>
          </div>
        </div>

        {/* Interests Pills Scrollable */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-400 flex items-center gap-1 pr-1 font-medium flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {INTERESTS.map((interest) => {
            const isSelected = selectedInterest === interest;
            return (
              <button
                key={interest}
                onClick={() => setSelectedInterest(interest)}
                className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Co-travelers Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">
              Passengers on {currentTrip.trainNumber} ({filtered.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Verified travel date: {currentTrip.travelDate}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-300">No co-travelers found for current filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Try changing your interest filter, clearing coach constraint, or check the Corridor Travelers tab below!
            </p>
            <button
              onClick={() => {
                setSelectedInterest('All');
                setOnlySameCoach(false);
                setWomenOnly(false);
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(({ user, trip }) => {
              const req = getRequestForUser(user.id);
              const isSameCoach = currentTrip.coach && trip.coach === currentTrip.coach;
              const mutualInterests = user.interests.filter((i) =>
                currentUser.interests.includes(i)
              );

              return (
                <div
                  key={user.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: avatar + details + coach */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                          />
                          {user.isVerifiedPNR && (
                            <div
                              className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5"
                              title="Verified PNR Passenger"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition">
                              {user.name}
                            </h4>
                            {isSameCoach && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                                Same Coach
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">{user.headline}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                            {user.companyOrOrg && <span>{user.companyOrOrg}</span>}
                            <span>•</span>
                            <span className="font-mono text-slate-300">
                              {trip.fromCode} ➔ {trip.toCode}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Coach badge */}
                      {trip.coach && (
                        <div className="text-right flex-shrink-0">
                          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200">
                            {trip.coach}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {trip.travelClass}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bio */}
                    <p className="text-xs text-slate-300 mt-3 line-clamp-2 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                      &quot;{user.bio}&quot;
                    </p>

                    {/* Interests tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {user.interests.map((interest) => {
                        const isMutual = currentUser.interests.includes(interest);
                        return (
                          <span
                            key={interest}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition ${
                              isMutual
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                            }`}
                          >
                            {isMutual ? '★ ' : ''}
                            {interest}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mutual interest indicator & Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      {mutualInterests.length > 0 && (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-400 font-medium">
                            {mutualInterests.length} mutual interests
                          </span>
                        </>
                      )}
                    </div>

                    {/* Connect status buttons */}
                    {req ? (
                      req.status === 'accepted' ? (
                        <button
                          onClick={() => onOpenChat(req.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat (Connected)</span>
                        </button>
                      ) : req.status === 'pending' ? (
                        <span className="text-xs px-3 py-1 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" />
                          <span>Invite Sent</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Declined</span>
                      )
                    ) : (
                      <button
                        onClick={() => onOpenConnectModal(user, trip)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm shadow-blue-600/20"
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        <span>Say Hi / Chai</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Corridor Match Fallback Section (Solves Cold Start Density) */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-sm font-bold text-white">
                Corridor Travelers ({currentTrip.fromCode} ➔ {currentTrip.toCode} Route)
              </h4>
              <p className="text-xs text-slate-400">
                Co-travelers on the same route on other trains today
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCorridor(!showCorridor)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {showCorridor ? 'Hide Corridor' : `Show (${corridorTravelers.length})`}
          </button>
        </div>

        {showCorridor && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
            {corridorTravelers.length === 0 ? (
              <p className="text-xs text-slate-500 col-span-2">
                No corridor travelers on alternative trains today.
              </p>
            ) : (
              corridorTravelers.map(({ user, trip }) => (
                <div
                  key={user.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-bold text-white">{user.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Train {trip.trainNumber} ({trip.trainName})
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenConnectModal(user, trip)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition text-[11px]"
                  >
                    Connect
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
