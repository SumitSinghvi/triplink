export type TravelClass = '1A' | '2A' | '3A' | '3E' | 'CC' | 'EC' | 'SL' | '2S';

export type BerthPreference =
  | 'Lower'
  | 'Middle'
  | 'Upper'
  | 'Side Lower'
  | 'Side Upper'
  | 'Window'
  | 'Aisle';

export type TripKind = 'train' | 'flight';

export interface TripVisibility {
  business: boolean;
  social: boolean;
  women: boolean;
  twoh: boolean;
}

export interface TripData {
  id: string;
  kind: TripKind;
  name: string;
  route: string;
  when: string;
  /** Normalized YYYY-MM-DD; source of truth for matching. `when` is display-only. */
  travelDate?: string;
  coach?: string;
  berth?: string;
  pnrMasked?: string;
  vis: TripVisibility;
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
  kind: TripKind;
  pnr: string;
  flight: string;
  date: string;
  found: {
    kind: TripKind;
    name: string;
    route: string;
    when: string;
    travelDate: string;
    coach?: string;
    berth?: string;
    pnrMasked?: string;
  } | null;
  loading: boolean;
  err: string;
  vis: TripVisibility;
}

export interface IncomingRequestItem {
  id: string;
  requesterId: string;
  name: string;
  company: string;
  industry: string;
  ini: string;
  fit: number;
  trainNumber: string;
  travelDate: string;
}

export interface TrainInfo {
  number: string;
  name: string;
  fromStation: string;
  fromCode: string;
  toStation: string;
  toCode: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
}
