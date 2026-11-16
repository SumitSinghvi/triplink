import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { A, B, DATE, MATCH_AB, loadServer, trip } from '../helpers/dbHarness';
import { jar } from '../helpers/cookies';

type Server = Awaited<ReturnType<typeof loadServer>>;
let s: Server;

beforeEach(async () => {
  s = await loadServer();
});

const call = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  s.route.POST(
    new NextRequest('http://localhost/api/db', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
const as = (user: string) => jar.store.set('tl_session', s.session.encodeSession(user));
const act = async (action: string, args: unknown[] = []) => {
  const res = await call({ action, args });
  return { status: res.status, body: await res.json() };
};

describe('/api/db gatekeeping', () => {
  it('415 when not JSON (blocks cross-site form posts)', async () => {
    as(A);
    const res = await call('action=inbox', { 'content-type': 'application/x-www-form-urlencoded' });
    expect(res.status).toBe(415);
  });

  it('401 without a valid session, including a tampered cookie', async () => {
    expect((await act('inbox')).status).toBe(401);
    jar.store.set('tl_session', s.session.encodeSession(A).replace(/.$/, 'x'));
    expect((await act('inbox')).status).toBe(401);
  });

  it('400 for invalid JSON and unknown actions', async () => {
    as(A);
    expect((await call('{nope')).status).toBe(400);
    expect(await act('dropTables')).toMatchObject({ status: 400, body: { error: 'Unknown action' } });
    expect(await act('toString')).toMatchObject({ status: 400 }); // no prototype-key dispatch
  });

  it('missing args are treated as empty, then rejected by validators', async () => {
    as(A);
    expect((await call({ action: 'block' })).status).toBe(400);
  });
});

describe('/api/db input validation', () => {
  beforeEach(() => as(A));
  const bad = async (action: string, args: unknown[]) => expect((await act(action, args)).status).toBe(400);

  it.each([
    ['block', [['usr_1']]],
    ['block', ['usr_22222222221']], // 11 digits
    ['block', ['admin']],
    ['report', [B, 'x'.repeat(101)]],
    ['report', [B, 'Spam', 'x'.repeat(1001)]],
    ['sendMessage', [`match_${B}`, 'x'.repeat(2001), false, 'msg_1']],
    ['sendMessage', [`match_${B}`, 'hi', false, 'not-a-msg-id']],
    ['sendMessage', ['match_../../etc', 'hi', false, 'msg_1']],
    ['messages', [`match_${B}; drop`]],
    ['respondRequest', ['not_a_match_row', 'accepted']],
    ['respondRequest', ['match_ab)or(1=1', 'accepted']],
    ['syncProfile', [{ name: 'x'.repeat(101) }]],
    ['syncProfile', [{ look: Array(21).fill('a') }]],
    ['syncProfile', [{ interests: [1] }]],
    ['syncProfile', [{}, { business: 'yes', social: true }]],
    ['syncTrip', [{ ...trip(), travelDate: '20-11-2026' }]],
    ['syncTrip', [{ ...trip(), departsAt: 'tomorrow-ish' }]],
    ['syncTrip', [{ ...trip(), vis: { business: 1, social: false, twoh: false } }]],
    ['syncTrip', [{ ...trip(), fromCode: 'AM D' }]],
    ['syncTrip', [{ ...trip(), name: 'x'.repeat(201) }]],
    ['verifyTrip', [trip()]], // pass required
  ])('%s %j -> 400', (a, args) => bad(a, args));

  it('refuses a connection request to yourself', async () => {
    await bad('sendRequest', [A, trip(), 90]);
  });
});

describe('/api/db identity comes from the cookie only', () => {
  it('stores data under the session user even if args name someone else', async () => {
    as(A);
    const t = { ...trip(), user_id: B, userId: B };
    expect((await act('syncTrip', [t])).body.result).toBe(true);
    expect(s.fake.rows('trips')).toMatchObject([{ user_id: A }]);
  });

  it('deleteTrip removes only the session user\'s row for that journey', async () => {
    as(B);
    await act('syncTrip', [trip()]);
    as(A);
    await act('syncTrip', [trip()]);
    await act('syncTrip', [{ ...trip(), id: 'other', travelDate: '2099-12-31', when: '2099-12-31' }]);
    expect((await act('deleteTrip', [trip()])).body.result).toBe(true);
    expect(s.fake.rows('trips').map((r) => [r.user_id, r.travel_date])).toEqual([
      [B, DATE],
      [A, '2099-12-31'],
    ]);
  });

  it('sendRequest records the session user as requester; fit is clamped to 85 when out of range', async () => {
    as(A);
    expect((await act('sendRequest', [B, trip(), 500])).body.result).toBe('sent');
    expect(s.fake.rows('matches')).toMatchObject([{ id: MATCH_AB, requester_id: A, receiver_id: B, fit_percentage: 85 }]);
  });

  it('a third user cannot answer someone else\'s request, a stranger cannot read the chat', async () => {
    as(A);
    await act('sendRequest', [B, trip()]);
    as('usr_3333333333');
    expect((await act('respondRequest', [MATCH_AB, 'accepted'])).body.result).toBe(false);
    expect((await act('messages', [`match_${B}`])).body.result).toEqual([]);
  });

  it('known gap: server does not check that the receiver is on the same journey', async () => {
    as(A); // B has no trip at all
    expect((await act('sendRequest', [B, trip()])).body.result).toBe('sent');
  });

  it('chat key may be passed with or without the match_ prefix', async () => {
    as(A);
    await act('sendRequest', [B, trip()]);
    as(B);
    await act('respondRequest', [MATCH_AB, 'accepted']);
    as(A);
    expect((await act('sendMessage', [B, 'hi', false, 'msg_1'])).body.result).toBe(true);
    expect((await act('messages', [`match_${B}`])).body.result).toHaveLength(1);
  });
});

describe('/api/db results and errors', () => {
  it('wraps results as { result }', async () => {
    as(A);
    expect(await act('myTrips')).toEqual({ status: 200, body: { result: [] } });
  });

  it('DB failure -> 500 with a generic body (no internals leaked)', async () => {
    as(A);
    s.fake.failNext('matches', { message: 'relation "matches" secret detail' });
    const r = await act('inbox');
    expect(r).toEqual({ status: 500, body: { error: 'Server error' } });
  });

  it('coTravelers 500 on DB failure so the client keeps its cache', async () => {
    as(A);
    await act('myTrips'); // warm schema probes
    s.fake.failNext('trips', { message: 'down' }, 'select');
    s.fake.failNext('trips', { message: 'down' }, 'select');
    expect((await act('coTravelers', [trip()])).status).toBe(500);
  });

  it('deleteAccount clears the session cookie only on success', async () => {
    as(A);
    s.fake.failNext('matches', { message: 'x' }, 'select');
    expect((await act('deleteAccount')).body.result).toBe(false);
    expect(jar.store.has('tl_session')).toBe(true);
    expect((await act('deleteAccount')).body.result).toBe(true);
    expect(jar.store.has('tl_session')).toBe(false);
  });

  it('full happy path over HTTP shape: request -> accept -> message -> inbox', async () => {
    as(A);
    await act('syncProfile', [{ name: 'Asha Rao', company: 'AR', industry: 'Textiles', look: ['Sell'], cities: [], first: '', interests: [], langs: [] }, { business: true, social: false }]);
    expect((await act('sendRequest', [B, trip(), 90])).body.result).toBe('sent');
    as(B);
    const inbox = (await act('inbox')).body.result;
    expect(inbox.incoming).toMatchObject([{ requesterId: A, name: 'Asha Rao', fit: 90 }]);
    expect((await act('respondRequest', [inbox.incoming[0].id, 'accepted'])).body.result).toBe(true);
    expect((await act('sendMessage', [A, 'hello', false, 'msg_9'])).body.result).toBe(true);
    as(A);
    const after = (await act('inbox')).body.result;
    expect(after.reqStatus[`match_${B}`]).toBe('accepted');
    expect(after.chats[`match_${B}`]).toMatchObject([{ id: 'msg_9', from: 'them', text: 'hello' }]);
  });
});

void vi;
void DATE;
