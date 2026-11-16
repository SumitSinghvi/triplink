'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { setUnauthorizedHandler } from '@/lib/supabaseSync';
import { usePoll } from '@/lib/usePoll';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { TripsTab } from '@/features/trips/TripsTab';
import { MatchesTab } from '@/features/matches/MatchesTab';
import { ChatsTab } from '@/features/chats/ChatsTab';
import { ProfileTab } from '@/features/profile/ProfileTab';
import { BottomNav } from '@/features/common/BottomNav';
import { Toast } from '@/features/common/Toast';
import { AddTripSheet } from '@/features/trips/AddTripSheet';
import { MatchDetailSheet } from '@/features/matches/MatchDetailSheet';
import { SafetySheet } from '@/features/safety/SafetySheet';

export default function Home() {
  const screen = useAppStore((s) => s.screen);
  const tab = useAppStore((s) => s.tab);
  const userId = useAppStore((s) => s.userId);
  const syncUserRequests = useAppStore((s) => s.syncUserRequests);

  // Server session missing/expired while the app thinks it's signed in -> sign out cleanly.
  useEffect(() => {
    if (screen !== 'main') return;
    setUnauthorizedHandler(() => {
      setUnauthorizedHandler(null);
      useAppStore.getState().logout();
      useAppStore.getState().showToast('Session expired. Please log in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [screen]);

  // App-wide polling: one inbox request (requests + all chats, for unread badges).
  // The open chat polls itself faster in ActiveChatView.
  const inboxKey = screen === 'main' ? userId : null;
  useEffect(() => {
    if (inboxKey !== null) syncUserRequests().catch(() => {});
  }, [inboxKey, syncUserRequests]);
  usePoll(() => syncUserRequests().catch(() => {}), 20000, inboxKey);

  return (
    <main className="x-stage">
      <div className="x-phone">
        <div className="x-app">
          {screen !== 'main' ? (
            <OnboardingFlow />
          ) : (
            <>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {tab === 'trips' && <TripsTab />}
                {tab === 'matches' && <MatchesTab />}
                {tab === 'chats' && <ChatsTab />}
                {tab === 'profile' && <ProfileTab />}
              </div>
              <BottomNav />
            </>
          )}

          {/* Overlays inside phone container */}
          <AddTripSheet />
          <MatchDetailSheet />
          <SafetySheet />
          <Toast />
        </div>
      </div>

      <aside className="x-caption">
        <div className="hero">
          <div className="hero__body">
            <h2>TripLink</h2>
            <p>Meet who&apos;s on your train or flight before boarding.</p>
          </div>
        </div>
        <div className="x-caption__body">
          <p className="x-body-strong">Pilot corridor: Ahmedabad &ndash; Mumbai</p>
          <p className="x-sub">
            Connect with co-travellers on Tejas Rajdhani Express and flights. Network with verified business contacts or find travel company.
          </p>
        </div>
      </aside>
    </main>
  );
}
