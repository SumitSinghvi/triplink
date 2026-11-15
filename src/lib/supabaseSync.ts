// Browser-side data API. All reads/writes go through /api/db, which identifies the caller
// from the httpOnly session cookie; the browser holds no Supabase key.
import type { MatchProfile, TripData, UserProfileData } from '@/types';
import type { IncomingRequestItem } from './journey';

export {
  buildDeterministicMatchId,
  calculateCoachProximity,
  extractJourneyKey,
  isPastTrip,
  newMessageId,
  normalizeJourneyKey,
  tripKey,
  tripTravelDate,
} from './journey';
export type { IncomingRequestItem } from './journey';

let onUnauthorized: (() => void) | null = null;
// Called when the server says the session is missing/expired (e.g. logged in before sessions existed).
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function call<T>(action: string, args: unknown[], fallback: T): Promise<T> {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, args }),
    });
    if (res.status === 401) {
      onUnauthorized?.();
      return fallback;
    }
    if (!res.ok) return fallback;
    const json = (await res.json()) as { result?: T };
    return json.result ?? fallback;
  } catch {
    return fallback;
  }
}

export const syncUserProfile = (profile: UserProfileData, modes?: { business: boolean; social: boolean }) =>
  call<boolean>('syncProfile', [profile, modes], false);

export const syncUserTrip = (trip: TripData, boardingPass?: string) =>
  call<boolean>('syncTrip', [trip, boardingPass], false);

export const fetchUserTrips = () => call<TripData[]>('myTrips', [], []);

export const fetchLiveCoTravelers = (trip: TripData, currentUserIndustry?: string) =>
  call<MatchProfile[]>('coTravelers', [trip, currentUserIndustry], []);

export const sendConnectionRequest = (receiverId: string, trip: TripData, fit = 85) =>
  call<'sent' | 'accepted' | 'declined' | null>('sendRequest', [receiverId, trip, fit], null);

export const respondToConnectionRequest = (matchRowId: string, status: 'accepted' | 'declined') =>
  call<boolean>('respondRequest', [matchRowId, status], false);

export const fetchUserRequestsAndMatches = () =>
  call<{
    incoming: IncomingRequestItem[];
    reqStatus: Record<string, 'sent' | 'accepted' | 'declined'>;
    contacts: MatchProfile[];
  }>('requests', [], { incoming: [], reqStatus: {}, contacts: [] });

export const sendChatMessageToSupabase = (chatKey: string, text: string, isCard: boolean, msgId: string) =>
  call<boolean>('sendMessage', [chatKey, text, isCard, msgId], false);

export const fetchLiveChatMessages = (chatKey: string) =>
  call<{ id: string; from: 'me' | 'them'; text: string; card?: boolean; timestamp?: string }[]>(
    'messages',
    [chatKey],
    []
  );

export const deleteUserAccount = () => call<boolean>('deleteAccount', [], false);

export const blockUserInSupabase = (blockedId: string) => call<boolean>('block', [blockedId], false);

export const reportUserInSupabase = (reportedId: string, reason: string, details?: string) =>
  call<boolean>('report', [reportedId, reason, details], false);

export async function endServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
}
