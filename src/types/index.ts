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
  /** Station / airport codes (NDLS, BOM) for same-route matching. */
  fromCode?: string;
  toCode?: string;
  /** ISO departure time when known (flights), used for "2h before" visibility. */
  departsAt?: string;
  coach?: string;
  berth?: string;
  pnrMasked?: string;
  /** Boarding pass scanned (server re-checks it before storing ticket_verified). */
  ticketVerified?: boolean;
  /** Last known flight status from AeroDataBox (Expected, Delayed, Canceled, ...). */
  flightStatus?: string;
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
  /** Their trip is backed by a scanned boarding pass. */
  ticketVerified?: boolean;
  coach?: string;
  bio?: string;
  cities?: string[];
  lookingFor?: string[];
}

export interface ChatMessage {
  id?: string;
  from: 'me' | 'them' | 'sys';
  /** Local-only delivery state; absent once the server has the message. */
  status?: 'pending' | 'failed';
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
  /** Manual flight entry (lookup found nothing): airport codes typed by the user. */
  manual: boolean;
  manualFrom: string;
  manualTo: string;
  found: {
    kind: TripKind;
    name: string;
    route: string;
    when: string;
    travelDate: string;
    fromCode?: string;
    toCode?: string;
    departsAt?: string;
    coach?: string;
    berth?: string;
    pnrMasked?: string;
    ticketVerified?: boolean;
    flightStatus?: string;
    /** Raw boarding-pass barcode text; sent once for the server check, never persisted. */
    boardingPass?: string;
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
