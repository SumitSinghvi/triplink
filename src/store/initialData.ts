export interface TripData {
  id: string;
  kind: 'train' | 'flight';
  name: string;
  route: string;
  when: string;
  coach?: string;
  berth?: string;
  pnrMasked?: string;
  vis: {
    business: boolean;
    social: boolean;
    women: boolean;
    twoh: boolean;
  };
}

export interface MatchProfile {
  id: string;
  tripId: string;
  type: 'Business' | 'Social';
  name: string;
  company: string;
  industry: string;
  ini: string;
  fit?: number;
  line?: string;
  tags?: string[];
  langs?: string;
  verified?: boolean;
  coach?: string;
  bio?: string;
  cities?: string[];
  lookingFor?: string[];
}

export interface ChatMessage {
  from: 'me' | 'them' | 'sys';
  text?: string;
  card?: boolean;
  timestamp?: string;
}

export interface UserProfileData {
  name: string;
  company: string;
  industry: string;
  look: string[];
  cities: string[];
  gstin: string;
  verified: boolean;
  gstErr: string;
  first: string;
  interests: string[];
  langs: string[];
}

export interface AddTripModalState {
  step: 1 | 2;
  kind: 'train' | 'flight';
  pnr: string;
  flight: string;
  date: string;
  found: {
    kind: 'train' | 'flight';
    name: string;
    route: string;
    when: string;
    coach?: string;
    berth?: string;
    pnrMasked?: string;
  } | null;
  loading: boolean;
  err: string;
  vis: {
    business: boolean;
    social: boolean;
    women: boolean;
    twoh: boolean;
  };
}

export const INITIAL_USER_PROFILE: UserProfileData = {
  name: '',
  company: '',
  industry: 'Textiles',
  look: ['Sell'],
  cities: ['Ahmedabad', 'Mumbai'],
  gstin: '',
  verified: false,
  gstErr: '',
  first: '',
  interests: [],
  langs: [],
};

// No hardcoded trips or matches - live user data only
export const DEFAULT_TRIPS: TripData[] = [];
export const DEFAULT_MATCHES: MatchProfile[] = [];
export const INITIAL_CHATS: Record<string, ChatMessage[]> = {};

export const BOT_REPLIES: string[] = [
  'Sounds great! Are you free for a quick chai when the train reaches the next stop?',
  'I will send over our product catalogue as soon as we reach.',
  'Glad we connected on this journey! Let us catch up on board.',
];
