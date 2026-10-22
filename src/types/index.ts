export type InterestCategory =
  | 'Tech & AI'
  | 'Startups & Business'
  | 'Finance & Crypto'
  | 'Career & Mentorship'
  | 'UPSC & Govt Exams'
  | 'Casual & Chai'
  | 'Books & Ideas'
  | 'Travel & Photography';

export type TravelClass = '1A' | '2A' | '3A' | '3E' | 'CC' | 'EC' | 'SL' | '2S';

export type BerthPreference =
  | 'Lower'
  | 'Middle'
  | 'Upper'
  | 'Side Lower'
  | 'Side Upper'
  | 'Window'
  | 'Aisle';

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  headline: string;
  bio: string;
  role: string;
  companyOrOrg?: string;
  interests: InterestCategory[];
  gender: 'female' | 'male' | 'other' | 'prefer-not-to-say';
  linkedinUrl?: string;
  twitterHandle?: string;
  phoneOrWhatsapp?: string;
  isVerifiedPNR: boolean;
  createdAt: string;
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

export interface Trip {
  id: string;
  userId: string;
  trainNumber: string;
  trainName: string;
  travelDate: string; // YYYY-MM-DD
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  travelClass: TravelClass;
  coach?: string; // e.g. "B4", "A1", "C2"
  berthType?: BerthPreference;
  pnrHash?: string; // masked, e.g. "******4819"
  privacyShareCoach: boolean; // whether to show coach to co-travelers
}

export interface LoungeMessage {
  id: string;
  trainNumber: string;
  travelDate: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderHeadline: string;
  senderCoach?: string;
  tag: 'general' | 'chai' | 'networking' | 'food' | 'seat-swap';
  content: string;
  timestamp: string;
}

export interface ConnectRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  trainNumber: string;
  travelDate: string;
  icebreaker: string;
  customMessage?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  shareContactOnAccept: boolean;
}

export interface DirectMessage {
  id: string;
  requestId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  timestamp: string;
}
