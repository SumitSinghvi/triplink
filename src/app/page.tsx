'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import {
  UserProfile,
  Trip,
  LoungeMessage,
  ConnectRequest,
  DirectMessage,
} from '@/types';
import {
  StorageStore,
  DEFAULT_CURRENT_USER,
  DEFAULT_CURRENT_TRIP,
} from '@/lib/store';
import { INITIAL_USERS } from '@/lib/mockData';
import { Navbar } from '@/components/Navbar';
import { TripHero } from '@/components/TripHero';
import { CoTravelersList } from '@/components/CoTravelersList';
import { TrainLounge } from '@/components/TrainLounge';
import { TripEntryModal } from '@/components/TripEntryModal';
import { ConnectModal } from '@/components/ConnectModal';
import { InboxDrawer } from '@/components/InboxDrawer';
import { ProfileModal } from '@/components/ProfileModal';
import { SafetyGuidelinesModal } from '@/components/SafetyGuidelinesModal';

export default function Home() {
  // Core App State initialized immediately with solid defaults
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_CURRENT_USER);
  const [currentTrip, setCurrentTrip] = useState<Trip>(DEFAULT_CURRENT_TRIP);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([
    DEFAULT_CURRENT_USER,
    ...INITIAL_USERS,
  ]);
  const [coTravelers, setCoTravelers] = useState<{ user: UserProfile; trip: Trip }[]>(() =>
    StorageStore.getCoTravelers(
      DEFAULT_CURRENT_TRIP.trainNumber,
      DEFAULT_CURRENT_TRIP.travelDate,
      DEFAULT_CURRENT_USER.id
    )
  );
  const [corridorTravelers, setCorridorTravelers] = useState<{ user: UserProfile; trip: Trip }[]>(() =>
    StorageStore.getCorridorTravelers(
      DEFAULT_CURRENT_TRIP.fromCode,
      DEFAULT_CURRENT_TRIP.toCode,
      DEFAULT_CURRENT_TRIP.travelDate,
      DEFAULT_CURRENT_TRIP.trainNumber,
      DEFAULT_CURRENT_USER.id
    )
  );
  const [loungeMessages, setLoungeMessages] = useState<LoungeMessage[]>(() =>
    StorageStore.getLoungeMessages(
      DEFAULT_CURRENT_TRIP.trainNumber,
      DEFAULT_CURRENT_TRIP.travelDate
    )
  );
  const [connectRequests, setConnectRequests] = useState<ConnectRequest[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);

  // Navigation tab
  const [activeView, setActiveView] = useState<'passengers' | 'lounge'>('passengers');

  // Modals state
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);

  // Selected targets for modal interactions
  const [connectTargetUser, setConnectTargetUser] = useState<UserProfile | null>(null);
  const [connectTargetTrip, setConnectTargetTrip] = useState<Trip | null>(null);
  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(null);

  // Reload state from Store (syncs with localStorage)
  const refreshState = useCallback(() => {
    try {
      const user = StorageStore.getCurrentUser();
      const trip = StorageStore.getCurrentTrip();
      const users = StorageStore.getAllUsers();
      setCurrentUser(user);
      setCurrentTrip(trip);
      setAllUsers(users);

      if (trip) {
        const travelers = StorageStore.getCoTravelers(
          trip.trainNumber,
          trip.travelDate,
          user.id
        );
        setCoTravelers(travelers);

        const corridors = StorageStore.getCorridorTravelers(
          trip.fromCode,
          trip.toCode,
          trip.travelDate,
          trip.trainNumber,
          user.id
        );
        setCorridorTravelers(corridors);

        const msgs = StorageStore.getLoungeMessages(trip.trainNumber, trip.travelDate);
        setLoungeMessages(msgs);
      }

      const requests = StorageStore.getConnectRequests(user.id);
      setConnectRequests(requests);

      if (activeChatRequestId) {
        const dms = StorageStore.getDirectMessages(activeChatRequestId);
        setDirectMessages(dms);
      }
    } catch (e) {
      console.error('Error refreshing state from storage', e);
    }
  }, [activeChatRequestId]);

  // Client hydration and sync
  useEffect(() => {
    refreshState();

    const handleStorageChange = () => {
      refreshState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('railmeet_storage_update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('railmeet_storage_update', handleStorageChange);
    };
  }, [refreshState]);

  // Refresh direct messages when chat request changes
  useEffect(() => {
    if (activeChatRequestId) {
      const dms = StorageStore.getDirectMessages(activeChatRequestId);
      setDirectMessages(dms);
    }
  }, [activeChatRequestId]);

  // Handlers
  const handleTripCreated = (trip: Trip) => {
    StorageStore.setCurrentTrip(trip);
    refreshState();
  };

  const handleOpenConnectModal = (user: UserProfile, trip: Trip) => {
    setConnectTargetUser(user);
    setConnectTargetTrip(trip);
    setConnectModalOpen(true);
  };

  const handleSendConnectRequest = (data: {
    toUserId: string;
    icebreaker: string;
    customMessage: string;
    shareContactOnAccept: boolean;
  }) => {
    if (!currentTrip) return;
    StorageStore.sendConnectRequest({
      fromUserId: currentUser.id,
      toUserId: data.toUserId,
      trainNumber: currentTrip.trainNumber,
      travelDate: currentTrip.travelDate,
      icebreaker: data.icebreaker,
      customMessage: data.customMessage,
      shareContactOnAccept: data.shareContactOnAccept,
    });
    refreshState();
  };

  const handleAcceptRequest = (requestId: string) => {
    StorageStore.updateConnectRequestStatus(requestId, 'accepted');
    refreshState();
  };

  const handleDeclineRequest = (requestId: string) => {
    StorageStore.updateConnectRequestStatus(requestId, 'declined');
    refreshState();
  };

  const handleSendDirectMessage = (
    requestId: string,
    toUserId: string,
    content: string
  ) => {
    StorageStore.sendDirectMessage(requestId, currentUser.id, toUserId, content);
    refreshState();
  };

  const handleSendLoungeMessage = (content: string, tag: LoungeMessage['tag']) => {
    if (!currentTrip) return;
    StorageStore.addLoungeMessage({
      trainNumber: currentTrip.trainNumber,
      travelDate: currentTrip.travelDate,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderHeadline: currentUser.headline,
      senderCoach: currentTrip.coach,
      tag,
      content,
    });
    refreshState();
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    StorageStore.setCurrentUser(updated);
    refreshState();
  };

  const handleSwitchPersona = (persona: UserProfile) => {
    StorageStore.setCurrentUser(persona);
    refreshState();
  };

  const handleResetData = () => {
    if (confirm('Reset demo data to initial defaults?')) {
      StorageStore.resetToDefaults();
      refreshState();
    }
  };

  // Calculate Metrics safely
  const sameCoachCount = coTravelers.filter(
    (item) => currentTrip.coach && item.trip.coach === currentTrip.coach
  ).length;

  const matchedInterestCount = coTravelers.filter((item) =>
    item.user.interests.some((i) => currentUser.interests.includes(i))
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentTrip={currentTrip}
        currentUser={currentUser}
        connectRequests={connectRequests}
        onOpenTripModal={() => setTripModalOpen(true)}
        onOpenInbox={() => setInboxOpen(true)}
        onOpenProfile={() => setProfileModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Journey Hero Card */}
        <TripHero
          trip={currentTrip}
          coTravelersCount={coTravelers.length}
          sameCoachCount={sameCoachCount}
          matchedInterestCount={matchedInterestCount}
          currentUser={currentUser}
          onChangeTrip={() => setTripModalOpen(true)}
        />

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('passengers')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer ${
                activeView === 'passengers'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Co-Travelers ({coTravelers.length})</span>
            </button>

            <button
              onClick={() => setActiveView('lounge')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer ${
                activeView === 'lounge'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Train Lounge Live Chat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>

          <button
            onClick={() => setSafetyModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Passenger Safety & 139 Guide</span>
          </button>
        </div>

        {/* View Content */}
        {activeView === 'passengers' ? (
          <CoTravelersList
            coTravelers={coTravelers}
            corridorTravelers={corridorTravelers}
            currentTrip={currentTrip}
            currentUser={currentUser}
            connectRequests={connectRequests}
            onOpenConnectModal={handleOpenConnectModal}
            onOpenChat={(reqId) => {
              setActiveChatRequestId(reqId);
              setInboxOpen(true);
            }}
          />
        ) : (
          <TrainLounge
            messages={loungeMessages}
            currentTrip={currentTrip}
            currentUser={currentUser}
            onSendMessage={handleSendLoungeMessage}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/80 bg-slate-950 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">RailMeet India</span>
            <span>•</span>
            <span>Privacy-first co-traveler networking for Indian Railways</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              IRCTC PNR Safe Mode
            </span>
            <button
              onClick={() => setSafetyModalOpen(true)}
              className="hover:text-slate-300 transition"
            >
              Helpline 139
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <TripEntryModal
        isOpen={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        onTripCreated={handleTripCreated}
        userId={currentUser.id}
      />

      <ConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        targetUser={connectTargetUser}
        targetTrip={connectTargetTrip}
        currentTrip={currentTrip}
        onSendRequest={handleSendConnectRequest}
      />

      <InboxDrawer
        isOpen={inboxOpen}
        onClose={() => {
          setInboxOpen(false);
          setActiveChatRequestId(null);
        }}
        currentUser={currentUser}
        connectRequests={connectRequests}
        allUsers={allUsers}
        directMessages={directMessages}
        activeChatRequestId={activeChatRequestId}
        onSelectChat={(id) => setActiveChatRequestId(id)}
        onAcceptRequest={handleAcceptRequest}
        onDeclineRequest={handleDeclineRequest}
        onSendDirectMessage={handleSendDirectMessage}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onSwitchPersona={handleSwitchPersona}
      />

      <SafetyGuidelinesModal
        isOpen={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
      />
    </div>
  );
}
