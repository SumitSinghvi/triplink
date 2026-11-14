'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  TripData,
  MatchProfile,
  ChatMessage,
  UserProfileData,
  AddTripModalState,
  INITIAL_USER_PROFILE,
  DEFAULT_TRIPS,
  DEFAULT_MATCHES,
  INITIAL_CHATS,
} from './initialData';
import {
  syncUserProfile,
  syncUserTrip,
  fetchLiveCoTravelers,
  sendConnectionRequest,
  respondToConnectionRequest,
  fetchUserRequestsAndMatches,
  sendChatMessageToSupabase,
  fetchLiveChatMessages,
  IncomingRequestItem,
  deleteUserAccount,
  blockUserInSupabase,
  reportUserInSupabase,
  fetchUserTrips,
  tripKey,
  newMessageId,
} from '@/lib/supabaseSync';
import { mergeChat, countNewIncoming } from '@/lib/chatMerge';
import { todayIso } from '@/lib/travelDate';

// Replace a trip's co-travellers. Contact-only entries (tripId '') for the same people are
// dropped so lookups by id find the richer trip entry (fit, line, trip for Connect).
function withTripMatches(matches: MatchProfile[], tripId: string, fresh: MatchProfile[]): MatchProfile[] {
  const freshIds = new Set(fresh.map((m) => m.id));
  return [
    ...matches.filter((m) => m.tripId !== tripId && !(m.tripId === '' && freshIds.has(m.id))),
    ...fresh,
  ];
}

// Clears or flags a local message's delivery status after the send settles.
function withDelivery(
  chats: Record<string, ChatMessage[]>,
  chatId: string,
  msgId: string,
  ok: boolean
): Record<string, ChatMessage[]> {
  const list = chats[chatId];
  if (!list) return chats;
  return {
    ...chats,
    [chatId]: list.map((m) => (m.id === msgId ? { ...m, status: ok ? undefined : 'failed' } : m)),
  };
}

export type {
  TripData,
  MatchProfile,
  ChatMessage,
  UserProfileData,
  AddTripModalState,
  IncomingRequestItem,
};

function newAnonUserId(): string {
  const id = `user_${Math.random().toString(36).substring(2, 10)}`;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('triplink_user_id', id);
    } catch {}
  }
  return id;
}

// User-scoped data that must not leak between accounts on the same device.
function blankUserData() {
  return {
    profile: INITIAL_USER_PROFILE,
    trips: [] as TripData[],
    selTripId: null,
    filter: 'All' as const,
    matches: [] as MatchProfile[],
    incomingRequests: [] as IncomingRequestItem[],
    req: {},
    gone: {},
    chats: {},
    unread: {},
    add: null,
    activeChatId: null,
    sheet: null,
    pro: false,
  };
}

function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'user_server';
  try {
    let id = localStorage.getItem('triplink_user_id');
    if (!id) {
      id = `user_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('triplink_user_id', id);
    }
    return id;
  } catch {
    return 'user_client';
  }
}

export interface AppState {
  userId: string;
  // Navigation / Screen
  screen: 'welcome' | 'phone' | 'otp' | 'mode' | 'create' | 'main';
  tab: 'trips' | 'matches' | 'chats' | 'profile';
  activeChatId: string | null;
  sheet: { kind: 'detail' | 'safety' | 'report' | 'delete' | 'addTrip'; id?: string } | null;

  // Onboarding / Auth
  phone: string;
  otp: string[];
  modes: { business: boolean; social: boolean };
  profile: UserProfileData;
  pro: boolean;

  // Trips & Discovery
  trips: TripData[];
  selTripId: string | null;
  filter: 'All' | 'Business' | 'Social' | 'Same industry';
  matches: MatchProfile[];
  incomingRequests: IncomingRequestItem[];

  // Connects & Chats
  req: Record<string, 'sent' | 'accepted' | 'declined'>;
  gone: Record<string, boolean>;
  chats: Record<string, ChatMessage[]>;
  unread: Record<string, boolean>;

  // Add Trip Flow
  add: AddTripModalState | null;

  // Toast
  toastMessage: { id: number; text: string; actionLabel?: string; onAction?: () => void } | null;

  // Actions
  setUserId: (userId: string) => void;
  loginUser: (
    userId: string,
    profile?: Partial<UserProfileData>,
    modes?: { business: boolean; social: boolean }
  ) => void;
  setScreen: (screen: AppState['screen']) => void;
  setTab: (tab: AppState['tab']) => void;
  setPhone: (phone: string) => void;
  setOtpDigit: (idx: number, digit: string) => void;
  setFullOtp: (otpArr: string[]) => void;
  toggleMode: (m: 'business' | 'social') => void;
  updateProfileField: <K extends keyof UserProfileData>(k: K, v: UserProfileData[K]) => void;
  verifyGstin: () => void;
  saveProfileAndEnter: () => void;

  // Trips & Matches
  openAddTrip: () => void;
  closeAddTrip: () => void;
  updateAddTrip: (partial: Partial<AddTripModalState>) => void;
  confirmAddTrip: () => void;
  selectTrip: (id: string) => void;
  refreshLiveMatches: (tripId?: string) => Promise<void>;
  syncUserRequests: () => Promise<void>;
  acceptIncomingRequest: (reqItem: IncomingRequestItem) => Promise<void>;
  declineIncomingRequest: (requestId: string) => Promise<void>;

  // Matches & Connect
  setFilter: (f: AppState['filter']) => void;
  openDetail: (matchId: string) => void;
  closeSheet: () => void;
  openSheet: (sheet: AppState['sheet']) => void;
  connectWith: (matchId: string) => void;
  blockPerson: (matchId: string) => void;
  reportPerson: (matchId: string, reason: string, details?: string) => void;

  // Messaging
  openChat: (matchId: string) => void;
  closeChat: () => void;
  sendMessage: (text: string) => void;
  shareBusinessCard: () => void;
  syncChatMessages: (matchId: string) => Promise<void>;

  // Toast & Pro & Reset
  showToast: (text: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;
  togglePro: () => void;
  logout: () => void;
  resetAll: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userId: getOrCreateUserId(),
      screen: 'welcome',
      tab: 'trips',
      activeChatId: null,
      sheet: null,

      phone: '',
      otp: ['', '', '', ''],
      modes: { business: true, social: false },
      profile: INITIAL_USER_PROFILE,
      pro: false,

      trips: DEFAULT_TRIPS,
      selTripId: null,
      filter: 'All',
      matches: DEFAULT_MATCHES,
      incomingRequests: [],

      req: {},
      gone: {},
      chats: INITIAL_CHATS,
      unread: {},

      add: null,
      toastMessage: null,

      setUserId: (userId) => set({ userId }),
      loginUser: (userId, existingProfile, savedModes) => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('triplink_user_id', userId);
          } catch {}
        }
        set((state) => {
          // Different account than what's cached locally -> drop previous user's data.
          const base = state.userId === userId ? state : { ...state, ...blankUserData() };
          return {
            ...base,
            userId,
            profile: existingProfile ? { ...base.profile, ...existingProfile } : base.profile,
            modes: savedModes ?? base.modes,
          };
        });

        // Pull this account's trips from Supabase (new device / re-login).
        fetchUserTrips(userId).then((remote) => {
          if (get().userId !== userId || remote.length === 0) return;
          set((state) => {
            const seen = new Set(state.trips.map(tripKey));
            const missing = remote.filter((t) => !seen.has(tripKey(t)));
            return { trips: [...state.trips, ...missing] };
          });
        });
      },
      setScreen: (screen) => set({ screen }),
      setTab: (tab) => set({ tab, activeChatId: null, sheet: null }),
      setPhone: (phone) => set({ phone }),
      setOtpDigit: (idx, digit) => {
        const currentOtp = Array.isArray(get().otp) ? get().otp : ['', '', '', ''];
        const next = [...currentOtp];
        next[idx] = digit;
        set({ otp: next });
      },
      setFullOtp: (otpArr) => set({ otp: Array.isArray(otpArr) ? otpArr : ['', '', '', ''] }),
      toggleMode: (m) => {
        set((state) => ({
          modes: { ...state.modes, [m]: !state.modes[m] },
        }));
        // Mode changes from the Profile tab apply immediately; onboarding syncs on save.
        const { screen, userId, profile, modes } = get();
        if (screen === 'main') syncUserProfile(userId, profile, modes);
      },
      updateProfileField: (k, v) =>
        set((state) => ({
          // Changing the GSTIN invalidates the previous format check.
          profile:
            k === 'gstin' && v !== state.profile.gstin
              ? { ...state.profile, gstin: v as string, verified: false, gstErr: '' }
              : { ...state.profile, [k]: v },
        })),
      verifyGstin: () => {
        const { gstin } = get().profile;
        const clean = gstin.trim().toUpperCase();
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
          set((state) => ({
            profile: { ...state.profile, gstin: clean, verified: true, gstErr: '' },
          }));
          get().showToast('GSTIN format is valid');
        } else {
          set((state) => ({
            profile: {
              ...state.profile,
              verified: false,
              gstErr: 'Invalid 15-character GSTIN format (e.g. 24AAACH7409R1ZZ)',
            },
          }));
        }
      },
      saveProfileAndEnter: () => {
        const { userId, profile, modes } = get();
        syncUserProfile(userId, profile, modes);
        set({ screen: 'main', tab: 'trips' });
        get().showToast('Profile Saved');
      },

      openAddTrip: () =>
        set({
          add: {
            step: 1,
            kind: 'train',
            pnr: '',
            flight: '',
            date: todayIso(),
            found: null,
            loading: false,
            err: '',
            vis: { business: true, social: get().modes.social, twoh: false },
          },
        }),
      closeAddTrip: () => set({ add: null }),
      updateAddTrip: (partial) =>
        set((state) => ({
          add: state.add ? { ...state.add, ...partial } : null,
        })),
      confirmAddTrip: () => {
        const add = get().add;
        if (!add || !add.found) return;
        const newId = `trip_${Date.now()}`;
        const newTrip: TripData = {
          id: newId,
          kind: add.found.kind,
          name: add.found.name,
          route: add.found.route,
          when: add.found.when,
          travelDate: add.found.travelDate,
          fromCode: add.found.fromCode,
          toCode: add.found.toCode,
          departsAt: add.found.departsAt,
          coach: add.found.coach,
          berth: add.found.berth,
          pnrMasked: add.found.pnrMasked,
          vis: {
            business: add.vis.business,
            social: add.vis.social,
            twoh: add.vis.twoh,
          },
        };
        set((state) => ({
          trips: [newTrip, ...state.trips],
          selTripId: newId,
          add: null,
          tab: 'trips',
        }));

        const { userId, profile, modes } = get();
        // trips.user_id references profiles: the profile row must exist before the trip insert.
        syncUserProfile(userId, profile, modes).then(() => syncUserTrip(userId, newTrip));
        fetchLiveCoTravelers(newTrip, userId, profile.industry).then((coTravelers) => {
          set((state) => ({ matches: withTripMatches(state.matches, newId, coTravelers) }));
        });

        get().showToast('Trip Added Successfully', 'View Matches', () => {
          set({ selTripId: newId, tab: 'matches' });
        });
      },
      selectTrip: (id) => {
        // MatchesTab fetches on mount / trip change, so no fetch here.
        set({ selTripId: id, tab: 'matches', filter: 'All' });
      },
      refreshLiveMatches: async (tripId) => {
        const targetId = tripId || get().selTripId;
        const trip = get().trips.find((t) => t.id === targetId);
        if (!trip) return;
        const { userId, profile } = get();
        const coTravelers = await fetchLiveCoTravelers(trip, userId, profile.industry);
        set((state) => ({ matches: withTripMatches(state.matches, trip.id, coTravelers) }));
      },
      syncUserRequests: async () => {
        const { userId } = get();
        const { incoming, reqStatus, contacts } = await fetchUserRequestsAndMatches(userId);
        if (get().userId !== userId) return; // logged out / switched meanwhile
        set((state) => {
          // Keep trip-scoped match entries; add accepted contacts not otherwise known so chats render.
          const known = new Set(state.matches.map((m) => m.id));
          const chats = { ...state.chats };
          for (const c of contacts) if (!chats[c.id] && !state.gone[c.id]) chats[c.id] = [];
          return {
            incomingRequests: incoming.filter((r) => !state.gone[`match_${r.requesterId}`]),
            req: { ...state.req, ...reqStatus },
            matches: [...state.matches, ...contacts.filter((c) => !known.has(c.id))],
            chats,
          };
        });
      },
      acceptIncomingRequest: async (reqItem) => {
        if (!(await respondToConnectionRequest(reqItem.id, 'accepted'))) {
          get().showToast('Could not accept request. Try again.');
          return;
        }
        const matchKey = `match_${reqItem.requesterId}`;
        set((state) => ({
          incomingRequests: state.incomingRequests.filter((r) => r.id !== reqItem.id),
          req: { ...state.req, [matchKey]: 'accepted' },
          // Requester may not be in any loaded trip's matches; keep a contact so chat can render.
          matches: state.matches.some((m) => m.id === matchKey)
            ? state.matches
            : [
                ...state.matches,
                {
                  id: matchKey,
                  tripId: '',
                  type: 'Business',
                  name: reqItem.name,
                  company: reqItem.company,
                  industry: reqItem.industry,
                  ini: reqItem.ini,
                  fit: reqItem.fit,
                },
              ],
          chats: state.chats[matchKey] ? state.chats : { ...state.chats, [matchKey]: [] },
        }));
        get().showToast(`Connected with ${reqItem.name}!`, 'Chat', () => {
          get().openChat(matchKey);
        });
      },
      declineIncomingRequest: async (requestId) => {
        await respondToConnectionRequest(requestId, 'declined');
        set((state) => ({
          incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
        }));
        get().showToast('Request declined');
      },

      setFilter: (filter) => set({ filter }),
      openDetail: (matchId) => set({ sheet: { kind: 'detail', id: matchId } }),
      closeSheet: () => set({ sheet: null }),
      openSheet: (sheet) => set({ sheet }),
      connectWith: (matchId) => {
        const match = get().matches.find((m) => m.id === matchId);
        // Request belongs to the trip this match was found on, not whatever is selected.
        const trip = get().trips.find((t) => t.id === match?.tripId);
        if (!match || !trip) return;

        const prev = get().req[matchId];
        set((state) => ({ req: { ...state.req, [matchId]: 'sent' } }));

        const receiverId = match.id.replace(/^match_/, '');
        sendConnectionRequest(get().userId, receiverId, trip, match.fit).then((status) => {
          set((state) => {
            const req = { ...state.req };
            if (status) req[matchId] = status;
            else if (prev) req[matchId] = prev;
            else delete req[matchId];
            const chats =
              status === 'accepted' && !state.chats[matchId]
                ? { ...state.chats, [matchId]: [] }
                : state.chats;
            return {
              req,
              chats,
              incomingRequests:
                status === 'accepted'
                  ? state.incomingRequests.filter((r) => r.requesterId !== receiverId)
                  : state.incomingRequests,
            };
          });
          if (status === 'sent') get().showToast(`Request sent to ${match.name}`);
          else if (status === 'accepted')
            get().showToast(`Connected with ${match.name}!`, 'Chat', () => get().openChat(matchId));
          else if (status === 'declined') get().showToast(`${match.name} declined your earlier request`);
          else get().showToast('Could not send request. Try again.');
        });
      },
      blockPerson: (matchId) => {
        const { userId } = get();
        const otherUserId = matchId.replace(/^match_/, '');
        blockUserInSupabase(userId, otherUserId);

        set((state) => {
          const newReq = { ...state.req };
          delete newReq[matchId];
          const newChats = { ...state.chats };
          delete newChats[matchId];
          const newUnread = { ...state.unread };
          delete newUnread[matchId];

          return {
            gone: { ...state.gone, [matchId]: true },
            req: newReq,
            chats: newChats,
            unread: newUnread,
            sheet: null,
            activeChatId: state.activeChatId === matchId ? null : state.activeChatId,
          };
        });
        get().showToast('User blocked and removed');
      },
      reportPerson: (matchId, reason, details) => {
        const { userId } = get();
        const otherUserId = matchId.replace(/^match_/, '');
        reportUserInSupabase(userId, otherUserId, reason, details);
        get().blockPerson(matchId);
      },

      openChat: (matchId) => {
        set((state) => {
          const newUnread = { ...state.unread };
          delete newUnread[matchId];
          return {
            tab: 'chats',
            activeChatId: matchId,
            unread: newUnread,
            sheet: null,
          };
        });
        get().syncChatMessages(matchId);
      },
      closeChat: () => set({ activeChatId: null }),
      syncChatMessages: async (matchId) => {
        const { userId } = get();
        const liveMsgs = await fetchLiveChatMessages(matchId, userId);
        // Empty = no history or fetch error: keep local rather than wipe it.
        if (liveMsgs.length === 0 || get().userId !== userId) return;
        set((state) => {
          if (state.gone[matchId]) return {};
          const local = state.chats[matchId] || [];
          const hasNew = countNewIncoming(local, liveMsgs) > 0;
          return {
            chats: { ...state.chats, [matchId]: mergeChat(liveMsgs, local) },
            unread:
              hasNew && state.activeChatId !== matchId
                ? { ...state.unread, [matchId]: true }
                : state.unread,
          };
        });
      },
      sendMessage: (text) => {
        const id = get().activeChatId;
        if (!id || !text.trim()) return;

        const clean = text.trim();
        const { userId } = get();
        const msgId = newMessageId();

        set((state) => {
          const current = state.chats[id] || [];
          return {
            chats: {
              ...state.chats,
              [id]: [...current, { id: msgId, from: 'me', text: clean, timestamp: 'Now', status: 'pending' }],
            },
          };
        });

        sendChatMessageToSupabase(id, userId, clean, false, msgId).then((ok) => {
          set((state) => ({ chats: withDelivery(state.chats, id, msgId, ok) }));
          if (!ok) get().showToast('Message not delivered. Check connection.');
        });
      },
      shareBusinessCard: () => {
        const id = get().activeChatId;
        if (!id) return;
        const { userId } = get();
        const msgId = newMessageId();
        set((state) => {
          const current = state.chats[id] || [];
          return {
            chats: {
              ...state.chats,
              [id]: [...current, { id: msgId, from: 'me', card: true, timestamp: 'Now', status: 'pending' }],
            },
          };
        });
        sendChatMessageToSupabase(id, userId, 'Shared business card', true, msgId).then((ok) => {
          set((state) => ({ chats: withDelivery(state.chats, id, msgId, ok) }));
          if (!ok) get().showToast('Business card not delivered. Check connection.');
        });
        get().showToast('Business Card Shared');
      },

      showToast: (text, actionLabel, onAction) => {
        const id = Date.now() + Math.random();
        set({ toastMessage: { id, text, actionLabel, onAction } });
        setTimeout(() => {
          // Only clear this toast, not a newer one (even with the same text).
          if (get().toastMessage?.id === id) set({ toastMessage: null });
        }, actionLabel ? 4500 : 2800);
      },
      clearToast: () => set({ toastMessage: null }),
      togglePro: () => {
        const next = !get().pro;
        set({ pro: next });
        get().showToast(next ? 'TripLink Pro Active' : 'TripLink Pro Canceled');
      },
      // Clears this device only. Server data stays so the user can log back in.
      logout: () => {
        set({
          ...blankUserData(),
          userId: newAnonUserId(),
          screen: 'welcome',
          tab: 'trips',
          phone: '',
          otp: ['', '', '', ''],
          modes: { business: true, social: false },
          toastMessage: null,
        });
        get().showToast('Logged out');
      },
      // Permanently deletes the account server-side, then logs out.
      resetAll: async () => {
        const currentUid = get().userId;
        if (currentUid && !currentUid.startsWith('user_client') && !currentUid.startsWith('user_server')) {
          // Keep the user signed in if deletion fails, so they can retry.
          if (!(await deleteUserAccount(currentUid))) {
            get().showToast('Could not delete account. Try again.');
            return;
          }
        }
        get().logout();
        get().showToast('Account deleted');
      },
    }),
    {
      name: 'triplink_app_storage_v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userId: state.userId,
        screen: state.screen,
        tab: state.tab,
        phone: state.phone,
        modes: state.modes,
        profile: state.profile,
        trips: state.trips,
        selTripId: state.selTripId,
        matches: state.matches,
        req: state.req,
        gone: state.gone,
        chats: state.chats,
        pro: state.pro,
      }),
    }
  )
);
