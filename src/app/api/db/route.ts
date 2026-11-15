// Single authenticated data endpoint. The browser never talks to Supabase directly:
// the caller's id always comes from the signed session cookie, and every argument is
// validated here before it reaches a query.
import { NextRequest, NextResponse } from 'next/server';
import type { TripData, UserProfileData } from '@/types';
import { clearSession, getSessionUserId, USER_ID_RE } from '@/lib/server/session';
import * as dbApi from '@/lib/server/db';

class BadInput extends Error {}

const str = (v: unknown, max = 200): string => {
  if (typeof v !== 'string' || v.length > max) throw new BadInput('bad string');
  return v;
};
const optStr = (v: unknown, max = 200): string | undefined => (v == null ? undefined : str(v, max));
const bool = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw new BadInput('bad boolean');
  return v;
};
const strArr = (v: unknown, maxItems = 20): string[] => {
  if (!Array.isArray(v) || v.length > maxItems) throw new BadInput('bad array');
  return v.map((x) => str(x, 60));
};
const userId = (v: unknown): string => {
  const s = str(v, 20);
  if (!USER_ID_RE.test(s)) throw new BadInput('bad user id');
  return s;
};
// Chat keys are "match_<partner user id>".
const chatKey = (v: unknown): string => `match_${userId(str(v, 30).replace(/^match_/, ''))}`;
const rowId = (v: unknown): string => {
  const s = str(v, 120);
  if (!/^match_[A-Za-z0-9_-]+$/.test(s)) throw new BadInput('bad row id');
  return s;
};
const msgId = (v: unknown): string => {
  const s = str(v, 60);
  if (!/^msg_[A-Za-z0-9_]+$/.test(s)) throw new BadInput('bad message id');
  return s;
};
const code = (v: unknown): string | undefined => {
  const s = optStr(v, 10);
  if (s !== undefined && !/^[A-Za-z0-9]+$/.test(s)) throw new BadInput('bad code');
  return s;
};

function trip(v: unknown): TripData {
  const t = (v ?? {}) as Record<string, unknown>;
  const vis = (t.vis ?? {}) as Record<string, unknown>;
  const travelDate = optStr(t.travelDate, 10);
  if (travelDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) throw new BadInput('bad date');
  const departsAt = optStr(t.departsAt, 40);
  if (departsAt !== undefined && Number.isNaN(Date.parse(departsAt))) throw new BadInput('bad departsAt');
  return {
    id: str(t.id, 80),
    kind: t.kind === 'flight' ? 'flight' : 'train',
    name: str(t.name),
    route: str(t.route),
    when: str(t.when),
    travelDate,
    fromCode: code(t.fromCode),
    toCode: code(t.toCode),
    departsAt,
    coach: optStr(t.coach, 10),
    vis: { business: bool(vis.business), social: bool(vis.social), twoh: bool(vis.twoh) },
  };
}

function profile(v: unknown): UserProfileData {
  const p = (v ?? {}) as Record<string, unknown>;
  return {
    name: str(p.name ?? '', 100),
    company: str(p.company ?? '', 100),
    industry: str(p.industry ?? '', 60),
    look: strArr(p.look ?? []),
    cities: strArr(p.cities ?? []),
    gstin: str(p.gstin ?? '', 15),
    verified: bool(p.verified ?? false),
    gstErr: '',
    first: str(p.first ?? '', 60),
    interests: strArr(p.interests ?? []),
    langs: strArr(p.langs ?? []),
  };
}

function modes(v: unknown): { business: boolean; social: boolean } | undefined {
  if (v == null) return undefined;
  const m = v as Record<string, unknown>;
  return { business: bool(m.business), social: bool(m.social) };
}

// action -> handler(me, args). `me` is the session user; args are untrusted.
const ACTIONS: Record<string, (me: string, a: unknown[]) => Promise<unknown>> = {
  syncProfile: (me, a) => dbApi.syncUserProfile(me, profile(a[0]), modes(a[1])),
  syncTrip: (me, a) => dbApi.syncUserTrip(me, trip(a[0]), optStr(a[1], 1000)),
  myTrips: (me) => dbApi.fetchUserTrips(me),
  coTravelers: (me, a) => dbApi.fetchLiveCoTravelers(trip(a[0]), me, optStr(a[1], 60)),
  sendRequest: (me, a) => {
    const fit = typeof a[2] === 'number' && a[2] >= 0 && a[2] <= 100 ? Math.round(a[2]) : 85;
    const receiver = userId(a[0]);
    if (receiver === me) throw new BadInput('self request');
    return dbApi.sendConnectionRequest(me, receiver, trip(a[1]), fit);
  },
  respondRequest: (me, a) =>
    dbApi.respondToConnectionRequest(me, rowId(a[0]), a[1] === 'accepted' ? 'accepted' : 'declined'),
  requests: (me) => dbApi.fetchUserRequestsAndMatches(me),
  sendMessage: (me, a) =>
    dbApi.sendChatMessageToSupabase(chatKey(a[0]), me, str(a[1], 2000), a[2] === true, msgId(a[3])),
  messages: (me, a) => dbApi.fetchLiveChatMessages(chatKey(a[0]), me),
  block: (me, a) => dbApi.blockUserInSupabase(me, userId(a[0])),
  report: (me, a) => dbApi.reportUserInSupabase(me, userId(a[0]), str(a[1], 100), optStr(a[2], 1000)),
  deleteAccount: async (me) => {
    const ok = await dbApi.deleteUserAccount(me);
    if (ok) await clearSession();
    return ok;
  },
};

export async function POST(req: NextRequest) {
  // JSON-only: plain cross-site form posts can't reach this handler.
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
  }
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { action?: unknown; args?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const handler = typeof body.action === 'string' ? ACTIONS[body.action] : undefined;
  if (!handler) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  try {
    const result = await handler(me, Array.isArray(body.args) ? body.args : []);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof BadInput) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('db route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
