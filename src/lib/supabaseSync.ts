import { supabase } from './supabase';
import { MatchProfile, TripData, UserProfileData } from '@/store/initialData';
import { normalizeTravelDate } from './travelDate';

export interface SupabaseProfileRow {
  id: string;
  name: string;
  company: string | null;
  industry: string | null;
  intent: string | null;
  cities: string[] | null;
  gstin: string | null;
  is_verified: boolean;
}

export interface SupabaseTripRow {
  id: string;
  user_id: string;
  train_number: string;
  train_name: string;
  travel_date: string;
  from_code: string;
  to_code: string;
  coach: string | null;
  mode: string | null;
}

// Normalize journey number (removes spaces/hyphens for reliable matching)
export function normalizeJourneyKey(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

// Robust journey key extractor (extracts train number or flight code)
export function extractJourneyKey(name: string): string {
  // 1. Train number in parenthesis e.g. "VANDE BHARAT EXP (20901)"
  const parenMatch = name.match(/\(([A-Z0-9\s]+)\)/i);
  if (parenMatch && parenMatch[1]) {
    const clean = parenMatch[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length >= 3) return clean;
  }

  // 2. Flight IATA pattern e.g. "6E 214", "AI 887", "QP 1302", "SG 8169", "UK 945"
  const flightMatch = name.match(/\b([A-Z0-9]{2})\s*([0-9]{1,4})\b/i);
  if (flightMatch) {
    return `${flightMatch[1].toUpperCase()}${flightMatch[2]}`;
  }

  // 3. Indian Railways 5-digit train number e.g. "20901" or "12951"
  const trainMatch = name.match(/\b(\d{5})\b/);
  if (trainMatch) {
    return trainMatch[1];
  }

  return normalizeJourneyKey(name);
}

// Matching date for a trip. Legacy trips (pre-travelDate) fall back to parsing `when`;
// null means unknown -> skip matching rather than silently assume today.
export function tripTravelDate(trip: TripData): string | null {
  return trip.travelDate || normalizeTravelDate(trip.when);
}

// Identity of a journey for dedupe: same vehicle on same day.
export function tripKey(trip: TripData): string {
  return `${extractJourneyKey(trip.name)}_${tripTravelDate(trip) ?? trip.when}`;
}

// 1. Sync User Profile to Supabase
export async function syncUserProfile(userId: string, profile: UserProfileData): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      name: profile.name || profile.first || 'Traveler',
      company: profile.company || null,
      industry: profile.industry || null,
      intent: profile.look && profile.look.length > 0 ? profile.look[0] : 'Partner',
      cities: profile.cities || [],
      gstin: profile.gstin || null,
      is_verified: profile.verified || false,
    });

    if (error) {
      console.warn('Supabase profile sync warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase profile sync exception:', err);
    return false;
  }
}

// 2. Sync Added Journey (Train or Flight) to Supabase
export async function syncUserTrip(
  userId: string,
  trip: TripData,
  mode: 'business' | 'social' = 'business'
): Promise<boolean> {
  try {
    const cleanNumber = extractJourneyKey(trip.name);

    // Extract station/airport codes or labels
    const routeParts = trip.route.split(/→|->/);
    const fromCode = (routeParts[0] || 'ORG').trim().slice(0, 50);
    const toCode = (routeParts[1] || 'DST').trim().slice(0, 50);

    const travelDate = tripTravelDate(trip);
    if (!travelDate) return false;

    const tripId = `trip_${userId}_${cleanNumber}_${travelDate}`;

    const { error } = await supabase.from('trips').upsert({
      id: tripId,
      user_id: userId,
      train_number: cleanNumber,
      train_name: trip.name,
      travel_date: travelDate,
      from_code: fromCode,
      to_code: toCode,
      coach: trip.coach || null,
      mode: mode,
    });

    if (error) {
      console.warn('Supabase trip sync warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase trip sync exception:', err);
    return false;
  }
}

// Load this user's trips from Supabase (re-login / new device). Visibility prefs are
// device-local today, so restored trips get defaults derived from the stored mode.
export async function fetchUserTrips(userId: string): Promise<TripData[]> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('id, train_number, train_name, travel_date, from_code, to_code, coach, mode')
      .eq('user_id', userId)
      .gte('travel_date', new Date().toISOString().split('T')[0])
      .order('travel_date');
    if (error || !data) return [];
    return data.map((t) => ({
      id: t.id,
      kind: /^\d+$/.test(t.train_number) ? 'train' : 'flight',
      name: t.train_name,
      route: `${t.from_code} → ${t.to_code}`,
      when: t.travel_date,
      travelDate: t.travel_date,
      coach: t.coach || undefined,
      vis: { business: t.mode !== 'social', social: t.mode === 'social', women: false, twoh: false },
    }));
  } catch (err) {
    console.warn('fetchUserTrips exception:', err);
    return [];
  }
}

// Helper to check coach proximity
export function calculateCoachProximity(userCoach?: string, otherCoach?: string): {
  isSameCoach: boolean;
  isAdjacentCoach: boolean;
  coachLabel?: string;
} {
  if (!userCoach || !otherCoach) {
    return { isSameCoach: false, isAdjacentCoach: false, coachLabel: otherCoach ? `Coach ${otherCoach}` : undefined };
  }
  const u = userCoach.trim().toUpperCase();
  const o = otherCoach.trim().toUpperCase();
  if (u === o) {
    return { isSameCoach: true, isAdjacentCoach: false, coachLabel: `Same Coach (${o})` };
  }
  const uMatch = u.match(/^([A-Z]+)(\d+)$/);
  const oMatch = o.match(/^([A-Z]+)(\d+)$/);
  if (uMatch && oMatch && uMatch[1] === oMatch[1]) {
    const uNum = parseInt(uMatch[2], 10);
    const oNum = parseInt(oMatch[2], 10);
    if (Math.abs(uNum - oNum) === 1) {
      return { isSameCoach: false, isAdjacentCoach: true, coachLabel: `Adjacent Coach (${o})` };
    }
  }
  return { isSameCoach: false, isAdjacentCoach: false, coachLabel: `Coach ${o}` };
}

// 3. Find Co-Travelers on Same Train / Flight & Date
export async function fetchLiveCoTravelers(
  trip: TripData,
  currentUserId: string,
  currentUserIndustry?: string
): Promise<MatchProfile[]> {
  try {
    const cleanNumber = extractJourneyKey(trip.name);

    const travelDate = tripTravelDate(trip);
    if (!travelDate) return [];

    // 1. Query trips table for matching journey number + travel date
    const { data: initialTrips, error: tripErr } = await supabase
      .from('trips')
      .select('id, user_id, train_number, train_name, travel_date, coach, mode, from_code, to_code')
      .eq('train_number', cleanNumber)
      .eq('travel_date', travelDate)
      .neq('user_id', currentUserId);

    let matchingTrips = initialTrips;

    // 2. Corridor Fallback: If no exact train match, check route corridor
    let isCorridorMatch = false;
    if (!tripErr && (!matchingTrips || matchingTrips.length === 0)) {
      const routeParts = trip.route.split(/→|->/);
      const fromCode = (routeParts[0] || '').trim().slice(0, 50);
      const toCode = (routeParts[1] || '').trim().slice(0, 50);

      if (fromCode && toCode) {
        const { data: corridorTrips } = await supabase
          .from('trips')
          .select('id, user_id, train_number, train_name, travel_date, coach, mode, from_code, to_code')
          .eq('travel_date', travelDate)
          .ilike('from_code', `%${fromCode}%`)
          .ilike('to_code', `%${toCode}%`)
          .neq('user_id', currentUserId)
          .limit(10);

        if (corridorTrips && corridorTrips.length > 0) {
          matchingTrips = corridorTrips;
          isCorridorMatch = true;
        }
      }
    }

    if (tripErr || !matchingTrips || matchingTrips.length === 0) {
      return [];
    }

    const userIds = matchingTrips.map((t) => t.user_id).filter(Boolean);
    if (userIds.length === 0) return [];

    // Query matching profiles
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (profErr || !profiles) {
      return [];
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return matchingTrips.map((t) => {
      const p = profileMap.get(t.user_id) || {
        id: t.user_id,
        name: 'Co-Passenger',
        company: 'Traveler',
        industry: 'General',
        intent: 'Connect',
        cities: [],
        is_verified: false,
      };

      const displayName = p.name || 'Traveler';
      const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'CP';

      const isSameIndustry =
        currentUserIndustry &&
        p.industry &&
        currentUserIndustry.toLowerCase() === p.industry.toLowerCase();

      const proximity = calculateCoachProximity(trip.coach, t.coach);

      let fitScore = 80;
      if (isSameIndustry) fitScore += 12;
      if (proximity.isSameCoach) fitScore += 6;
      else if (proximity.isAdjacentCoach) fitScore += 3;
      if (p.is_verified) fitScore += 2;
      fitScore = Math.min(98, fitScore);

      const statusLine = isCorridorMatch
        ? `${p.company || 'Traveler'} • Same Route Corridor (${t.train_name || t.train_number})`
        : proximity.isSameCoach
        ? `${p.company || 'Traveler'} • Sitting in your coach ${t.coach}`
        : p.company
        ? `${p.company} • Traveling on ${trip.name}`
        : undefined;

      return {
        id: `match_${p.id}`,
        tripId: trip.id,
        type: t.mode === 'social' ? 'Social' : 'Business',
        name: displayName,
        company: p.company || 'Co-Passenger',
        industry: p.industry || 'General',
        ini: initials,
        fit: fitScore,
        line: statusLine,
        tags: p.industry ? [p.industry] : ['Traveler'],
        verified: p.is_verified || false,
        coach: proximity.coachLabel || (t.coach ? `Coach ${t.coach}` : undefined),
        cities: p.cities || undefined,
        lookingFor: p.intent ? [p.intent] : ['Partner'],
      };
    });
  } catch (err) {
    console.warn('Supabase match query exception:', err);
    return [];
  }
}

export interface IncomingRequestItem {
  id: string; // matches row id
  requesterId: string;
  name: string;
  company: string;
  industry: string;
  ini: string;
  fit: number;
  trainNumber: string;
  travelDate: string;
}

export function buildDeterministicMatchId(
  userA: string,
  userB: string,
  journeyKey: string,
  travelDate: string
): string {
  const [u1, u2] = [userA, userB].sort();
  return `match_${u1}_${u2}_${journeyKey}_${travelDate}`;
}

// 4. Send Connection Request
export async function sendConnectionRequest(
  requesterId: string,
  receiverId: string,
  trip: TripData,
  fit = 85,
  retried = false
): Promise<'sent' | 'accepted' | 'declined' | null> {
  try {
    const cleanNumber = extractJourneyKey(trip.name);
    const travelDate = tripTravelDate(trip);
    if (!travelDate) return null;
    const matchRowId = buildDeterministicMatchId(requesterId, receiverId, cleanNumber, travelDate);

    // Row id is shared by both directions, so never blind-upsert: read state first.
    const { data: existing, error: readErr } = await supabase
      .from('matches')
      .select('requester_id, status')
      .eq('id', matchRowId)
      .maybeSingle();
    if (readErr) {
      console.warn('sendConnectionRequest read warning:', readErr.message);
      return null;
    }

    if (existing) {
      const theyAsked = existing.requester_id === receiverId;
      if (existing.status === 'accepted') return 'accepted';
      if (existing.status === 'pending') {
        if (!theyAsked) return 'sent';
        // Mutual interest: accept their pending request instead of overwriting it.
        return (await respondToConnectionRequest(matchRowId, 'accepted')) ? 'accepted' : null;
      }
      // Declined: if they declined me, don't re-send. If I declined them, re-open as my request.
      if (!theyAsked) return 'declined';
      const { error } = await supabase
        .from('matches')
        .update({ requester_id: requesterId, receiver_id: receiverId, status: 'pending', fit_percentage: fit })
        .eq('id', matchRowId);
      return error ? null : 'sent';
    }

    const { error } = await supabase.from('matches').insert({
      id: matchRowId,
      requester_id: requesterId,
      receiver_id: receiverId,
      train_number: cleanNumber,
      travel_date: travelDate,
      fit_percentage: fit,
      status: 'pending',
    });

    if (error) {
      // Other side inserted concurrently -> re-evaluate against their row once.
      if (error.code === '23505' && !retried) {
        return sendConnectionRequest(requesterId, receiverId, trip, fit, true);
      }
      console.warn('sendConnectionRequest warning:', error.message);
      return null;
    }
    return 'sent';
  } catch (err) {
    console.warn('sendConnectionRequest exception:', err);
    return null;
  }
}

// 5. Accept or Decline Request
export async function respondToConnectionRequest(
  matchRowId: string,
  status: 'accepted' | 'declined'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', matchRowId);

    if (error) {
      console.warn('respondToConnectionRequest warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('respondToConnectionRequest exception:', err);
    return false;
  }
}

// 6. Fetch Incoming and Outgoing Request States
export async function fetchUserRequestsAndMatches(userId: string): Promise<{
  incoming: IncomingRequestItem[];
  reqStatus: Record<string, 'sent' | 'accepted' | 'declined'>;
  // Accepted connections as profiles, so chats render without the partner being in current trip matches.
  contacts: MatchProfile[];
}> {
  const empty = { incoming: [], reqStatus: {}, contacts: [] };
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error || !data) return empty;

    const reqStatus: Record<string, 'sent' | 'accepted' | 'declined'> = {};
    const pendingIncomingRows: typeof data = [];
    const acceptedIds = new Set<string>();

    for (const row of data) {
      const outgoing = row.requester_id === userId;
      const otherId: string = outgoing ? row.receiver_id : row.requester_id;
      const matchKey = `match_${otherId}`;
      // A pair can have rows on several trips; accepted on any row wins.
      if (row.status === 'accepted') {
        reqStatus[matchKey] = 'accepted';
        acceptedIds.add(otherId);
      } else if (reqStatus[matchKey] === 'accepted') {
        continue;
      } else if (outgoing && (row.status === 'pending' || row.status === 'declined')) {
        reqStatus[matchKey] = row.status === 'pending' ? 'sent' : 'declined';
      } else if (!outgoing && row.status === 'pending') {
        pendingIncomingRows.push(row);
      }
    }

    const liveIncoming = pendingIncomingRows.filter((r) => !acceptedIds.has(r.requester_id));
    const profileIds = [...new Set([...liveIncoming.map((r) => r.requester_id), ...acceptedIds])];
    if (profileIds.length === 0) return { incoming: [], reqStatus, contacts: [] };

    const { data: profs } = await supabase.from('profiles').select('*').in('id', profileIds);
    const profMap = new Map((profs || []).map((p) => [p.id, p]));

    const incoming: IncomingRequestItem[] = liveIncoming.map((r) => {
      const p = profMap.get(r.requester_id);
      const name = p?.name || 'Traveler';
      return {
        id: r.id,
        requesterId: r.requester_id,
        name,
        company: p?.company || 'Co-Passenger',
        industry: p?.industry || 'General',
        ini: initialsOf(name, 'TR'),
        fit: r.fit_percentage || 85,
        trainNumber: r.train_number,
        travelDate: r.travel_date,
      };
    });

    const contacts: MatchProfile[] = [...acceptedIds].map((id) => {
      const p = profMap.get(id);
      const name = p?.name || 'Traveler';
      return {
        id: `match_${id}`,
        tripId: '',
        type: 'Business',
        name,
        company: p?.company || 'Co-Passenger',
        industry: p?.industry || 'General',
        ini: initialsOf(name, 'TR'),
        verified: p?.is_verified || false,
        cities: p?.cities || undefined,
        lookingFor: p?.intent ? [p.intent] : undefined,
      };
    });

    return { incoming, reqStatus, contacts };
  } catch (err) {
    console.warn('fetchUserRequestsAndMatches exception:', err);
    return empty;
  }
}

function initialsOf(name: string, fallback: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}

// 7. Live Realtime Chat Messages
// Accepted connection rows between me and the chat partner (`match_<uid>`), sorted for stability.
async function resolveConnectionRowIds(chatKey: string, myId: string): Promise<string[]> {
  if (!chatKey.startsWith('match_')) return [chatKey];
  const otherUserId = chatKey.replace(/^match_/, '');
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${myId},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${myId})`)
    .order('id');
  if (error || !data) return [];
  return data.map((r) => r.id);
}

export async function sendChatMessageToSupabase(
  chatKey: string,
  senderId: string,
  text: string,
  isCard = false
): Promise<boolean> {
  try {
    // A pair can share several trips (rows). Write to the stable first accepted row;
    // reads merge all rows, so history stays in one thread.
    const [matchId] = await resolveConnectionRowIds(chatKey, senderId);
    if (!matchId) return false;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const { error } = await supabase.from('messages').insert({
      id: msgId,
      match_id: matchId,
      sender_id: senderId,
      text,
      is_card: isCard,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function fetchLiveChatMessages(
  chatKey: string,
  currentUserId: string
): Promise<{ from: 'me' | 'them'; text: string; card?: boolean; timestamp?: string }[]> {
  try {
    const matchIds = await resolveConnectionRowIds(chatKey, currentUserId);
    if (matchIds.length === 0) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .in('match_id', matchIds)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((m) => ({
      from: m.sender_id === currentUserId ? 'me' : 'them',
      text: m.text,
      card: m.is_card || false,
      timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  } catch {
    return [];
  }
}

// 8. Delete User Account and Data
export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    await supabase.from('trips').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('matches').delete().or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    return true;
  } catch (err) {
    console.warn('deleteUserAccount exception:', err);
    return false;
  }
}

// 9. Block User
export async function blockUserInSupabase(blockerId: string, blockedId: string): Promise<boolean> {
  if (!blockerId || !blockedId) return false;
  try {
    const id = `blk_${blockerId}_${blockedId}`;
    await supabase.from('blocks').upsert({
      id,
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
    return true;
  } catch (err) {
    console.warn('blockUserInSupabase exception:', err);
    return false;
  }
}

// 10. Report User
export async function reportUserInSupabase(
  reporterId: string,
  reportedId: string,
  reason: string,
  details?: string
): Promise<boolean> {
  if (!reporterId || !reportedId) return false;
  try {
    const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await supabase.from('reports').insert({
      id,
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      details,
    });
    return true;
  } catch (err) {
    console.warn('reportUserInSupabase exception:', err);
    return false;
  }
}
