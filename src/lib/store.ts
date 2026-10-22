'use client';

import {
  UserProfile,
  Trip,
  LoungeMessage,
  ConnectRequest,
  DirectMessage,
  InterestCategory,
} from '@/types';
import {
  INITIAL_USERS,
  getInitialTrips,
  getInitialLoungeMessages,
  getDefaultTravelDate,
} from './mockData';

const STORAGE_KEYS = {
  CURRENT_USER: 'railmeet_current_user',
  ALL_USERS: 'railmeet_all_users',
  ALL_TRIPS: 'railmeet_all_trips',
  CURRENT_TRIP: 'railmeet_current_trip',
  LOUNGE_MSGS: 'railmeet_lounge_messages',
  CONNECT_REQUESTS: 'railmeet_connect_requests',
  DIRECT_MSGS: 'railmeet_direct_messages',
};

// Default current active user for demo/immediate interaction
export const DEFAULT_CURRENT_USER: UserProfile = {
  id: 'current_user_me',
  name: 'Kabir Mehta',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  headline: 'Full-Stack Developer & Tech Explorer',
  bio: 'Building indie web apps. Love deep discussions on system design, remote work, indie hacking, and roadside railway chai.',
  role: 'Software Developer',
  companyOrOrg: 'Freelance / Builder',
  interests: ['Tech & AI', 'Startups & Business', 'Casual & Chai'],
  gender: 'male',
  linkedinUrl: 'https://linkedin.com/in/kabir-mehta-dev',
  twitterHandle: '@kabir_builds',
  phoneOrWhatsapp: '+91 98765 43210',
  isVerifiedPNR: true,
  createdAt: '2026-10-01',
};

// Safe localStorage access
function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Trigger custom event for intra-page sync
    window.dispatchEvent(new CustomEvent('railmeet_storage_update', { detail: { key } }));
  } catch (e) {
    console.error('Storage write error', e);
  }
}

export const StorageStore = {
  // Current logged in user
  getCurrentUser(): UserProfile {
    return safeGet<UserProfile>(STORAGE_KEYS.CURRENT_USER, DEFAULT_CURRENT_USER);
  },

  setCurrentUser(user: UserProfile): void {
    safeSet(STORAGE_KEYS.CURRENT_USER, user);
    // Also ensure this user is in all users
    const all = this.getAllUsers();
    const idx = all.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      all[idx] = user;
    } else {
      all.push(user);
    }
    safeSet(STORAGE_KEYS.ALL_USERS, all);
  },

  // All known users (co-travelers + current user)
  getAllUsers(): UserProfile[] {
    return safeGet<UserProfile[]>(STORAGE_KEYS.ALL_USERS, [
      DEFAULT_CURRENT_USER,
      ...INITIAL_USERS,
    ]);
  },

  // Current active trip
  getCurrentTrip(): Trip {
    const defaultTrip: Trip = {
      id: 'trip_kabir_active',
      userId: DEFAULT_CURRENT_USER.id,
      trainNumber: '12951',
      trainName: 'Tejas Rajdhani Express',
      travelDate: getDefaultTravelDate(),
      fromCode: 'NDLS',
      fromName: 'New Delhi',
      toCode: 'MMCT',
      toName: 'Mumbai Central',
      travelClass: '3A',
      coach: 'B4',
      berthType: 'Side Lower',
      pnrHash: '******4819',
      privacyShareCoach: true,
    };
    return safeGet<Trip>(STORAGE_KEYS.CURRENT_TRIP, defaultTrip);
  },

  setCurrentTrip(trip: Trip): void {
    safeSet(STORAGE_KEYS.CURRENT_TRIP, trip);
    const allTrips = this.getAllTrips();
    const existingIdx = allTrips.findIndex((t) => t.id === trip.id);
    if (existingIdx >= 0) {
      allTrips[existingIdx] = trip;
    } else {
      allTrips.push(trip);
    }
    safeSet(STORAGE_KEYS.ALL_TRIPS, allTrips);
  },

  // All trips across all users
  getAllTrips(): Trip[] {
    const currentTrip = this.getCurrentTrip();
    const initial = [currentTrip, ...getInitialTrips()];
    return safeGet<Trip[]>(STORAGE_KEYS.ALL_TRIPS, initial);
  },

  // Find co-travelers on same train and date
  getCoTravelers(
    trainNumber: string,
    travelDate: string,
    currentUserId: string
  ): { user: UserProfile; trip: Trip }[] {
    const allTrips = this.getAllTrips();
    const allUsers = this.getAllUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return allTrips
      .filter(
        (t) =>
          t.trainNumber === trainNumber &&
          t.travelDate === travelDate &&
          t.userId !== currentUserId
      )
      .map((t) => ({
        trip: t,
        user: userMap.get(t.userId)!,
      }))
      .filter((item) => item.user !== undefined);
  },

  // Corridor discovery: travelers on same corridor route even if different train
  getCorridorTravelers(
    fromCode: string,
    toCode: string,
    travelDate: string,
    excludeTrainNumber: string,
    currentUserId: string
  ): { user: UserProfile; trip: Trip }[] {
    const allTrips = this.getAllTrips();
    const allUsers = this.getAllUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return allTrips
      .filter(
        (t) =>
          t.travelDate === travelDate &&
          t.trainNumber !== excludeTrainNumber &&
          t.userId !== currentUserId &&
          ((t.fromCode === fromCode && t.toCode === toCode) ||
            (t.fromCode === 'NDLS' && (toCode === 'MMCT' || toCode === 'BRC')))
      )
      .map((t) => ({
        trip: t,
        user: userMap.get(t.userId)!,
      }))
      .filter((item) => item.user !== undefined);
  },

  // Lounge Messages
  getLoungeMessages(trainNumber: string, travelDate: string): LoungeMessage[] {
    const all = safeGet<LoungeMessage[]>(
      STORAGE_KEYS.LOUNGE_MSGS,
      getInitialLoungeMessages()
    );
    return all.filter(
      (m) => m.trainNumber === trainNumber && m.travelDate === travelDate
    );
  },

  addLoungeMessage(msg: Omit<LoungeMessage, 'id' | 'timestamp'>): LoungeMessage {
    const all = safeGet<LoungeMessage[]>(
      STORAGE_KEYS.LOUNGE_MSGS,
      getInitialLoungeMessages()
    );
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullMsg: LoungeMessage = {
      ...msg,
      id: `lounge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
    };
    all.push(fullMsg);
    safeSet(STORAGE_KEYS.LOUNGE_MSGS, all);
    return fullMsg;
  },

  // Connect Requests
  getConnectRequests(userId: string): ConnectRequest[] {
    const all = safeGet<ConnectRequest[]>(STORAGE_KEYS.CONNECT_REQUESTS, []);
    return all.filter((r) => r.fromUserId === userId || r.toUserId === userId);
  },

  sendConnectRequest(req: {
    fromUserId: string;
    toUserId: string;
    trainNumber: string;
    travelDate: string;
    icebreaker: string;
    customMessage?: string;
    shareContactOnAccept: boolean;
  }): ConnectRequest {
    const all = safeGet<ConnectRequest[]>(STORAGE_KEYS.CONNECT_REQUESTS, []);
    const newReq: ConnectRequest = {
      ...req,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    all.push(newReq);
    safeSet(STORAGE_KEYS.CONNECT_REQUESTS, all);
    return newReq;
  },

  updateConnectRequestStatus(requestId: string, status: 'accepted' | 'declined'): void {
    const all = safeGet<ConnectRequest[]>(STORAGE_KEYS.CONNECT_REQUESTS, []);
    const target = all.find((r) => r.id === requestId);
    if (target) {
      target.status = status;
      safeSet(STORAGE_KEYS.CONNECT_REQUESTS, all);
    }
  },

  // Direct Messages
  getDirectMessages(requestId: string): DirectMessage[] {
    const all = safeGet<DirectMessage[]>(STORAGE_KEYS.DIRECT_MSGS, []);
    return all.filter((m) => m.requestId === requestId);
  },

  sendDirectMessage(
    requestId: string,
    fromUserId: string,
    toUserId: string,
    content: string
  ): DirectMessage {
    const all = safeGet<DirectMessage[]>(STORAGE_KEYS.DIRECT_MSGS, []);
    const now = new Date();
    const msg: DirectMessage = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requestId,
      fromUserId,
      toUserId,
      content,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    all.push(msg);
    safeSet(STORAGE_KEYS.DIRECT_MSGS, all);
    return msg;
  },

  // Reset demo data
  resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TRIP);
    localStorage.removeItem(STORAGE_KEYS.ALL_TRIPS);
    localStorage.removeItem(STORAGE_KEYS.ALL_USERS);
    localStorage.removeItem(STORAGE_KEYS.LOUNGE_MSGS);
    localStorage.removeItem(STORAGE_KEYS.CONNECT_REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.DIRECT_MSGS);
    window.dispatchEvent(new CustomEvent('railmeet_storage_update', { detail: { reset: true } }));
  },
};
