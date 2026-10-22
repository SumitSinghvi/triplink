'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
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
