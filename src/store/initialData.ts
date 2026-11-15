import {
  TripData,
  MatchProfile,
  ChatMessage,
  UserProfileData,
  AddTripModalState,
  IncomingRequestItem,
  TripVisibility,
  TripKind,
} from '@/types';

export type {
  TripData,
  MatchProfile,
  ChatMessage,
  UserProfileData,
  AddTripModalState,
  IncomingRequestItem,
  TripVisibility,
  TripKind,
};

export const INITIAL_USER_PROFILE: UserProfileData = {
  name: '',
  company: '',
  industry: 'Textiles',
  look: ['Sell'],
  cities: ['Ahmedabad', 'Mumbai'],
  first: '',
  interests: [],
  langs: [],
};

// No hardcoded trips or matches - live user data only
export const DEFAULT_TRIPS: TripData[] = [];
export const DEFAULT_MATCHES: MatchProfile[] = [];
export const INITIAL_CHATS: Record<string, ChatMessage[]> = {};
