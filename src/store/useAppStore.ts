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
  BOT_REPLIES,
} from './initialData';

export type {
  TripData,
  MatchProfile,
  ChatMessage,
  UserProfileData,
  AddTripModalState,
};

export interface AppState {
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

  // Connects & Chats
  req: Record<string, 'sent' | 'accepted' | 'declined'>;
  gone: Record<string, boolean>;
  chats: Record<string, ChatMessage[]>;
  unread: Record<string, boolean>;
  typing: string | null;

  // Add Trip Flow
  add: AddTripModalState | null;

  // Toast
  toastMessage: { text: string; actionLabel?: string; onAction?: () => void } | null;

  // Actions
  setScreen: (screen: AppState['screen']) => void;
  setTab: (tab: AppState['tab']) => void;
  setPhone: (phone: string) => void;
  setOtpDigit: (idx: number, digit: string) => void;
  setFullOtp: (otpArr: string[]) => void;
  toggleMode: (m: 'business' | 'social') => void;
  updateProfileField: <K extends keyof UserProfileData>(k: K, v: UserProfileData[K]) => void;
  verifyGstin: () => void;
  saveProfileAndEnter: () => void;

  // Trips
  openAddTrip: () => void;
  closeAddTrip: () => void;
  updateAddTrip: (partial: Partial<AddTripModalState>) => void;
  confirmAddTrip: () => void;
  selectTrip: (id: string) => void;

  // Matches & Connect
  setFilter: (f: AppState['filter']) => void;
  openDetail: (matchId: string) => void;
  closeSheet: () => void;
  openSheet: (sheet: AppState['sheet']) => void;
  connectWith: (matchId: string) => void;
  blockPerson: (matchId: string) => void;

  // Messaging
  openChat: (matchId: string) => void;
  closeChat: () => void;
  sendMessage: (text: string) => void;
  shareBusinessCard: () => void;

  // Toast & Pro & Reset
  showToast: (text: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;
  togglePro: () => void;
  resetAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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

      req: {},
      gone: {},
      chats: INITIAL_CHATS,
      unread: {},
      typing: null,

      add: null,
      toastMessage: null,

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
      toggleMode: (m) =>
        set((state) => ({
          modes: { ...state.modes, [m]: !state.modes[m] },
        })),
      updateProfileField: (k, v) =>
        set((state) => ({
          profile: { ...state.profile, [k]: v },
        })),
      verifyGstin: () => {
        const { gstin } = get().profile;
        const clean = gstin.trim().toUpperCase();
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
          set((state) => ({
            profile: { ...state.profile, gstin: clean, verified: true, gstErr: '' },
          }));
          get().showToast('GSTIN Verified Successfully');
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
            date: new Date().toISOString().split('T')[0],
            found: null,
            loading: false,
            err: '',
            vis: { business: true, social: get().modes.social, women: false, twoh: false },
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
          coach: add.found.coach,
          berth: add.found.berth,
          pnrMasked: add.found.pnrMasked,
          vis: {
            business: add.vis.business,
            social: add.vis.social,
            women: add.vis.women && add.vis.social,
            twoh: add.vis.twoh,
          },
        };
        set((state) => ({
          trips: [newTrip, ...state.trips],
          selTripId: newId,
          add: null,
          tab: 'trips',
        }));
        get().showToast('Trip Added Successfully', 'View Matches', () => {
          set({ selTripId: newId, tab: 'matches' });
        });
      },
      selectTrip: (id) => set({ selTripId: id, tab: 'matches', filter: 'All' }),

      setFilter: (filter) => set({ filter }),
      openDetail: (matchId) => set({ sheet: { kind: 'detail', id: matchId } }),
      closeSheet: () => set({ sheet: null }),
      openSheet: (sheet) => set({ sheet }),
      connectWith: (matchId) => {
        set((state) => ({
          req: { ...state.req, [matchId]: 'sent' },
        }));
        const match = get().matches.find((m) => m.id === matchId);
        get().showToast(`Request sent to ${match?.name || 'traveler'}`);

        setTimeout(() => {
          set((state) => ({
            req: { ...state.req, [matchId]: 'accepted' },
            chats: {
              ...state.chats,
              [matchId]: [
                { from: 'sys', text: `You and ${match?.name} are now connected.` },
                { from: 'them', text: `Hi! Happy to connect on this trip.` },
              ],
            },
            unread: { ...state.unread, [matchId]: true },
          }));
          get().showToast(`${match?.name} accepted your connection!`, 'Chat', () => {
            get().openChat(matchId);
          });
        }, 2200);
      },
      blockPerson: (matchId) => {
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
      },
      closeChat: () => set({ activeChatId: null }),
      sendMessage: (text) => {
        const id = get().activeChatId;
        if (!id || !text.trim()) return;

        const clean = text.trim();
        set((state) => {
          const current = state.chats[id] || [];
          return {
            chats: {
              ...state.chats,
              [id]: [...current, { from: 'me', text: clean, timestamp: 'Now' }],
            },
          };
        });

        set({ typing: id });
        setTimeout(() => {
          if (get().activeChatId === id) {
            const replies = BOT_REPLIES;
            const chosen = replies[Math.floor(Math.random() * replies.length)];
            set((state) => {
              const current = state.chats[id] || [];
              return {
                chats: {
                  ...state.chats,
                  [id]: [...current, { from: 'them', text: chosen, timestamp: 'Now' }],
                },
                typing: null,
              };
            });
          } else {
            set((state) => ({
              typing: null,
              unread: { ...state.unread, [id]: true },
            }));
          }
        }, 1500);
      },
      shareBusinessCard: () => {
        const id = get().activeChatId;
        if (!id) return;
        set((state) => {
          const current = state.chats[id] || [];
          return {
            chats: {
              ...state.chats,
              [id]: [...current, { from: 'me', card: true, timestamp: 'Now' }],
            },
          };
        });
        get().showToast('Business Card Shared');
      },

      showToast: (text, actionLabel, onAction) => {
        set({ toastMessage: { text, actionLabel, onAction } });
        setTimeout(() => {
          if (get().toastMessage?.text === text) {
            set({ toastMessage: null });
          }
        }, actionLabel ? 4500 : 2800);
      },
      clearToast: () => set({ toastMessage: null }),
      togglePro: () =>
        set((state) => {
          const next = !state.pro;
          get().showToast(next ? 'TripLink Pro Active' : 'TripLink Pro Canceled');
          return { pro: next };
        }),
      resetAll: () => {
        set({
          screen: 'welcome',
          tab: 'trips',
          activeChatId: null,
          sheet: null,
          phone: '',
          otp: ['', '', '', ''],
          modes: { business: true, social: false },
          profile: INITIAL_USER_PROFILE,
          trips: [],
          selTripId: null,
          filter: 'All',
          matches: [],
          req: {},
          gone: {},
          chats: {},
          unread: {},
          typing: null,
          add: null,
          toastMessage: null,
          pro: false,
        });
        get().showToast('App reset to clean state');
      },
    }),
    {
      name: 'triplink_app_storage_v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        screen: state.screen,
        tab: state.tab,
        phone: state.phone,
        modes: state.modes,
        profile: state.profile,
        trips: state.trips,
        selTripId: state.selTripId,
        req: state.req,
        gone: state.gone,
        chats: state.chats,
        pro: state.pro,
      }),
    }
  )
);
