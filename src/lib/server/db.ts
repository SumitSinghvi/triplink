// Server-only data access. Every function takes the caller's id from the session cookie
// (never from the request body); see src/app/api/db/route.ts.
import type { MatchProfile, TripData, UserProfileData } from '@/types';
import { supabaseAdmin } from './supabaseAdmin';
import { todayIso } from '@/lib/travelDate';
import { canSee, showFromFor } from '@/lib/tripVisibility';
import { julianToIso, parseBcbp } from '@/lib/bcbp';
import {
  type IncomingRequestItem,
  buildDeterministicMatchId,
  calculateCoachProximity,
  extractJourneyKey,
  newMessageId,
  tripTravelDate,
} from '@/lib/journey';

const db = () => supabaseAdmin();

// Part 2 columns come from supabase/migrations/20261114000000_*.sql, which may not be applied yet.
// Probe once per session; until they exist, read/write only the legacy columns.
let v2Schema: Promise<boolean> | null = null;
export function hasV2Schema(): Promise<boolean> {
  v2Schema ??= (async () => {
    const [t, p] = await Promise.all([
      db().from('trips').select('visible_business, from_station').limit(1),
      db().from('profiles').select('first_name, mode_business').limit(1),
    ]);
    if (!t.error && !p.error) return true;
    const missing = [t.error, p.error].some(
      (e) => e && (e.code === '42703' || e.code === 'PGRST204' || /does not exist|schema cache/i.test(e.message))
    );
    if (missing) {
      console.warn('Supabase migration pending (supabase/migrations): using legacy columns.');
      return false;
    }
    v2Schema = null; // network/other error: don't cache, retry next call
    return false;
  })();
  return v2Schema;
}

// trips.ticket_verified comes from supabase/migrations/20261116000000_*.sql; same probe-once pattern.
let ticketColumn: Promise<boolean> | null = null;
function hasTicketColumn(): Promise<boolean> {
  ticketColumn ??= (async () => {
    const { error } = await db().from('trips').select('ticket_verified').limit(1);
    if (!error) return true;
    if (error.code === '42703' || /does not exist|schema cache/i.test(error.message)) return false;
    ticketColumn = null; // network/other error: retry next call
    return false;
  })();
  return ticketColumn;
}

// A boarding pass verifies a trip when its barcode names this flight and this date.
// ponytail: passenger name is not checked against the profile (dropped until ~100+ users), and unsigned
// BCBP text can be forged; upgrade = name check + airline-signed BCBP or a check-in API.
// Raw barcode (name, PNR) is used here only and never stored.
async function boardingPassVerifies(raw: string, journeyKey: string, travelDate: string) {
  const pass = parseBcbp(raw);
  if (!pass) return false;
  return pass.legs.some(
    (l) => `${l.carrier}${l.flightNumber}` === journeyKey && julianToIso(l.julianDay, travelDate) === travelDate
  );
}

// Visibility for rows from either schema: legacy rows only have `mode`.
function rowVisibility<T extends { mode?: string | null; visible_business?: boolean | null; visible_social?: boolean | null }>(
  t: T
): T & { visible_business: boolean; visible_social: boolean } {
  return {
    ...t,
    visible_business: t.visible_business ?? t.mode !== 'social',
    visible_social: t.visible_social ?? t.mode === 'social',
  };
}

// 1. Sync User Profile to Supabase
export async function syncUserProfile(
  userId: string,
  profile: UserProfileData,
  modes?: { business: boolean; social: boolean }
): Promise<boolean> {
  try {
    const v2 = (await hasV2Schema())
      ? {
          first_name: profile.first || null,
          interests: profile.interests || [],
          langs: profile.langs || [],
          ...(modes ? { mode_business: modes.business, mode_social: modes.social } : {}),
        }
      : {};
    const { error } = await db().from('profiles').upsert({
      id: userId,
      name: profile.name || profile.first || 'Traveler',
      ...v2,
      company: profile.company || null,
      industry: profile.industry || null,
      intent: profile.look && profile.look.length > 0 ? profile.look[0] : 'Partner',
      cities: profile.cities || [],
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
export async function syncUserTrip(userId: string, trip: TripData, boardingPass?: string): Promise<boolean> {
  try {
    const cleanNumber = extractJourneyKey(trip.name);

    // Extract station/airport codes or labels
    const routeParts = trip.route.split(/→|->/);
    const fromCode = (routeParts[0] || 'ORG').trim().slice(0, 50);
    const toCode = (routeParts[1] || 'DST').trim().slice(0, 50);

    const travelDate = tripTravelDate(trip);
    if (!travelDate) return false;

    const tripId = `trip_${userId}_${cleanNumber}_${travelDate}`;
    const v2 = (await hasV2Schema())
      ? {
          visible_business: trip.vis.business,
          visible_social: trip.vis.social,
          show_from: showFromFor(trip.vis, travelDate, trip.departsAt),
          from_station: trip.fromCode?.toUpperCase() || null,
          to_station: trip.toCode?.toUpperCase() || null,
        }
      : {};
    // Only ever set true: a later re-sync without a pass must not un-verify the trip.
    const verified =
      boardingPass &&
      (await hasTicketColumn()) &&
      (await boardingPassVerifies(boardingPass, cleanNumber, travelDate))
        ? { ticket_verified: true }
        : {};

    const { error } = await db().from('trips').upsert({
      id: tripId,
      user_id: userId,
      train_number: cleanNumber,
      train_name: trip.name,
      travel_date: travelDate,
      from_code: fromCode,
      to_code: toCode,
      coach: trip.coach || null,
      // Legacy single-mode label; also the visibility source until the migration runs.
      mode: trip.vis.social && !trip.vis.business ? 'social' : 'business',
      ...v2,
      ...verified,
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

// Verify an already-added trip with a boarding pass. Re-syncs the trip (creating the row if an earlier
// sync failed), which stores ticket_verified=true. True only when the pass actually verified.
export async function verifyTripTicket(userId: string, trip: TripData, boardingPass: string): Promise<boolean> {
  const travelDate = tripTravelDate(trip);
  if (!travelDate || !(await hasTicketColumn())) return false;
  if (!(await boardingPassVerifies(boardingPass, extractJourneyKey(trip.name), travelDate))) return false;
  return syncUserTrip(userId, trip, boardingPass);
}

// Load this user's trips from Supabase (re-login / new device).
export async function fetchUserTrips(userId: string): Promise<TripData[]> {
  try {
    const columns: string = (await hasV2Schema())
      ? 'id, train_number, train_name, travel_date, from_code, to_code, coach, mode, visible_business, visible_social, show_from, from_station, to_station'
      : 'id, train_number, train_name, travel_date, from_code, to_code, coach, mode';
    const withTicket = (await hasTicketColumn()) ? `${columns}, ticket_verified` : columns;
    const { data, error } = await db()
      .from('trips')
      .select(withTicket)
      .eq('user_id', userId)
      .gte('travel_date', todayIso())
      .order('travel_date');
    if (error || !data) return [];
    return (data as unknown as TripRow[]).map(rowVisibility).map((t) => ({
      id: t.id,
      kind: /^\d+$/.test(t.train_number) ? 'train' : 'flight',
      name: t.train_name,
      route: `${t.from_code} → ${t.to_code}`,
      when: t.travel_date,
      travelDate: t.travel_date,
      fromCode: t.from_station || undefined,
      toCode: t.to_station || undefined,
      coach: t.coach || undefined,
      ticketVerified: t.ticket_verified || undefined,
      vis: {
        business: t.visible_business,
        social: t.visible_social,
        twoh: Boolean(t.show_from),
      },
    }));
  } catch (err) {
    console.warn('fetchUserTrips exception:', err);
    return [];
  }
}

const TRIP_MATCH_COLUMNS_LEGACY = 'id, user_id, train_number, train_name, travel_date, coach, mode';
const TRIP_MATCH_COLUMNS = `${TRIP_MATCH_COLUMNS_LEGACY}, visible_business, visible_social, show_from`;

interface TripRow {
  id: string;
  user_id: string;
  train_number: string;
  train_name: string;
  travel_date: string;
  from_code?: string;
  to_code?: string;
  coach: string | null;
  mode: string | null;
  visible_business?: boolean | null;
  visible_social?: boolean | null;
  show_from?: string | null;
  ticket_verified?: boolean | null;
  from_station?: string | null;
  to_station?: string | null;
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

    const v2 = await hasV2Schema();
    const columns: string =
      (v2 ? TRIP_MATCH_COLUMNS : TRIP_MATCH_COLUMNS_LEGACY) + ((await hasTicketColumn()) ? ', ticket_verified' : '');

    // 1. Query trips table for matching journey number + travel date
    const { data: initialTrips, error: tripErr } = await db()
      .from('trips')
      .select(columns)
      .eq('train_number', cleanNumber)
      .eq('travel_date', travelDate)
      .neq('user_id', currentUserId);

    let matchingTrips = (initialTrips as unknown as TripRow[] | null)?.map(rowVisibility) ?? null;

    // 2. Same-route fallback on station/airport codes (trips saved before codes existed skip this).
    let isCorridorMatch = false;
    if (!tripErr && (!matchingTrips || matchingTrips.length === 0)) {
      const fromCode = trip.fromCode?.toUpperCase();
      const toCode = trip.toCode?.toUpperCase();

      if (v2 && fromCode && toCode) {
        const { data: corridorTrips } = await db()
          .from('trips')
          .select(columns)
          .eq('travel_date', travelDate)
          .eq('from_station', fromCode)
          .eq('to_station', toCode)
          .neq('user_id', currentUserId)
          .limit(20);

        if (corridorTrips && corridorTrips.length > 0) {
          matchingTrips = (corridorTrips as unknown as TripRow[]).map(rowVisibility);
          isCorridorMatch = true;
        }
      }
    }

    if (tripErr || !matchingTrips || matchingTrips.length === 0) {
      return [];
    }

    // One entry per person (corridor can return several rows per user); drop blocked either way;
    // respect each trip's visibility (shared mode + "show me 2h before").
    const blocked = await fetchBlockedIds(currentUserId);
    const seenUsers = new Set<string>();
    const now = Date.now();
    matchingTrips = matchingTrips.filter((t) => {
      if (!t.user_id || blocked.has(t.user_id) || seenUsers.has(t.user_id)) return false;
      if (!canSee(trip.vis, t, now)) return false;
      seenUsers.add(t.user_id);
      return true;
    });

    const userIds = matchingTrips.map((t) => t.user_id);
    if (userIds.length === 0) return [];

    // Query matching profiles
    const { data: profiles, error: profErr } = await db()
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
      };

      const displayName = p.name || p.first_name || 'Traveler';
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

      const proximity = calculateCoachProximity(trip.coach, t.coach ?? undefined);

      let fitScore = 80;
      if (isSameIndustry) fitScore += 12;
      if (proximity.isSameCoach) fitScore += 6;
      else if (proximity.isAdjacentCoach) fitScore += 3;
      fitScore = Math.min(98, fitScore);

      const statusLine = isCorridorMatch
        ? `${p.company || 'Traveler'} • Same Route Corridor (${t.train_name || t.train_number})`
        : p.company
        ? `${p.company} • Traveling on ${trip.name}`
        : undefined;

      return {
        id: `match_${p.id}`,
        tripId: trip.id,
        // Business when both have business on; otherwise they matched via social.
        type: trip.vis.business && t.visible_business !== false ? 'Business' : 'Social',
        name: displayName,
        company: p.company || 'Co-Passenger',
        industry: p.industry || 'General',
        ini: initials,
        fit: fitScore,
        line: statusLine,
        tags: p.interests?.length ? p.interests : p.industry ? [p.industry] : ['Traveler'],
        langs: p.langs?.length ? p.langs.join(', ') : undefined,
        ticketVerified: t.ticket_verified || false,
        cities: p.cities || undefined,
        lookingFor: p.intent ? [p.intent] : ['Partner'],
      };
    });
  } catch (err) {
    console.warn('Supabase match query exception:', err);
    return [];
  }
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
    const { data: existing, error: readErr } = await db()
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
        return (await respondToConnectionRequest(requesterId, matchRowId, 'accepted')) ? 'accepted' : null;
      }
      // Declined: if they declined me, don't re-send. If I declined them, re-open as my request.
      if (!theyAsked) return 'declined';
      const { error } = await db()
        .from('matches')
        .update({ requester_id: requesterId, receiver_id: receiverId, status: 'pending', fit_percentage: fit })
        .eq('id', matchRowId);
      return error ? null : 'sent';
    }

    const { error } = await db().from('matches').insert({
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
  me: string,
  matchRowId: string,
  status: 'accepted' | 'declined'
): Promise<boolean> {
  try {
    // Only the receiver of a pending request can answer it.
    const { data, error } = await db()
      .from('matches')
      .update({ status })
      .eq('id', matchRowId)
      .eq('receiver_id', me)
      .eq('status', 'pending')
      .select('id');

    if (!error && (!data || data.length === 0)) return false;
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
    const { data, error } = await db()
      .from('matches')
      .select('*')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error || !data) return empty;

    const reqStatus: Record<string, 'sent' | 'accepted' | 'declined'> = {};
    const pendingIncomingRows: typeof data = [];
    const acceptedIds = new Set<string>();
    const blocked = await fetchBlockedIds(userId);

    for (const row of data) {
      const outgoing = row.requester_id === userId;
      const otherId: string = outgoing ? row.receiver_id : row.requester_id;
      if (blocked.has(otherId)) continue;
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

    const { data: profs } = await db().from('profiles').select('*').in('id', profileIds);
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
      const name = p?.name || p?.first_name || 'Traveler';
      return {
        id: `match_${id}`,
        tripId: '',
        type: 'Business',
        name,
        company: p?.company || 'Co-Passenger',
        industry: p?.industry || 'General',
        ini: initialsOf(name, 'TR'),
        cities: p?.cities || undefined,
        lookingFor: p?.intent ? [p.intent] : undefined,
        tags: p?.interests?.length ? p.interests : undefined,
        langs: p?.langs?.length ? p.langs.join(', ') : undefined,
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
  const { data, error } = await db()
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
  isCard = false,
  msgId = newMessageId()
): Promise<boolean> {
  try {
    // A pair can share several trips (rows). Write to the stable first accepted row;
    // reads merge all rows, so history stays in one thread.
    const [matchId] = await resolveConnectionRowIds(chatKey, senderId);
    if (!matchId) return false;

    const { error } = await db().from('messages').insert({
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
): Promise<{ id: string; from: 'me' | 'them'; text: string; card?: boolean; timestamp?: string }[]> {
  try {
    const matchIds = await resolveConnectionRowIds(chatKey, currentUserId);
    if (matchIds.length === 0) return [];

    const { data, error } = await db()
      .from('messages')
      .select('*')
      .in('match_id', matchIds)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((m) => ({
      id: m.id,
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
    // Children before parents; stop at the first failure so the caller can retry.
    // Reports are kept for moderation.
    const mine = `requester_id.eq.${userId},receiver_id.eq.${userId}`;
    const { data: rows, error: rowsErr } = await db().from('matches').select('id').or(mine);
    if (rowsErr) throw rowsErr;
    const rowIds = (rows || []).map((r) => r.id);

    const steps = [
      () => (rowIds.length ? db().from('messages').delete().in('match_id', rowIds) : null),
      () => db().from('messages').delete().eq('sender_id', userId),
      () => db().from('matches').delete().or(mine),
      () => db().from('blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
      () => db().from('trips').delete().eq('user_id', userId),
      () => db().from('profiles').delete().eq('id', userId),
      // User ids are usr_<10-digit phone>; drop any pending OTP for that number.
      () => db().from('auth_otps').delete().eq('phone', userId.replace(/^usr_/, '')),
    ];
    for (const step of steps) {
      const res = await step();
      if (res?.error) throw res.error;
    }
    return true;
  } catch (err) {
    console.warn('deleteUserAccount exception:', err);
    return false;
  }
}

// 9. Block User
// Users I blocked or who blocked me. Blocking hides people in both directions.
export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await db()
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error || !data) return new Set();
  return new Set(data.map((b) => (b.blocker_id === userId ? b.blocked_id : b.blocker_id)));
}

export async function blockUserInSupabase(blockerId: string, blockedId: string): Promise<boolean> {
  if (!blockerId || !blockedId) return false;
  try {
    const id = `blk_${blockerId}_${blockedId}`;
    const { error } = await db().from('blocks').upsert({
      id,
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
    if (error) {
      console.warn('blockUserInSupabase warning:', error.message);
      return false;
    }
    // Close every connection between the pair so neither side can keep chatting.
    await db()
      .from('matches')
      .update({ status: 'declined' })
      .or(`and(requester_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(requester_id.eq.${blockedId},receiver_id.eq.${blockerId})`);
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
    const { error } = await db().from('reports').insert({
      id,
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      details,
    });
    if (error) console.warn('reportUserInSupabase warning:', error.message);
    return !error;
  } catch (err) {
    console.warn('reportUserInSupabase exception:', err);
    return false;
  }
}
