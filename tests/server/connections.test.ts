import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { A, B, C, MATCH_AB, loadServer, profileRow, trip } from '../helpers/dbHarness';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-11-16T06:00:00Z') });
});
afterEach(() => vi.useRealTimers());

const status = (fake: { rows: (t: string) => Record<string, unknown>[] }) =>
  fake.rows('matches').map((r) => `${r.requester_id}>${r.receiver_id}:${r.status}`);

describe('sendConnectionRequest state machine', () => {
  it('first request creates a pending row with the shared id', async () => {
    const { db, fake } = await loadServer();
    expect(await db.sendConnectionRequest(A, B, trip(), 90)).toBe('sent');
    expect(fake.rows('matches')).toMatchObject([
      { id: MATCH_AB, requester_id: A, receiver_id: B, status: 'pending', fit_percentage: 90, train_number: '6E214' },
    ]);
  });

  it('same id from either side', async () => {
    const { db, fake } = await loadServer();
    await db.sendConnectionRequest(B, A, trip());
    expect(fake.rows('matches')[0].id).toBe(MATCH_AB);
  });

  it('resending my pending request does not duplicate or flip it', async () => {
    const { db, fake } = await loadServer();
    await db.sendConnectionRequest(A, B, trip());
    expect(await db.sendConnectionRequest(A, B, trip())).toBe('sent');
    expect(status(fake)).toEqual([`${A}>${B}:pending`]);
  });

  it('mutual interest accepts their pending request', async () => {
    const { db, fake } = await loadServer();
    await db.sendConnectionRequest(A, B, trip());
    expect(await db.sendConnectionRequest(B, A, trip())).toBe('accepted');
    expect(status(fake)).toEqual([`${A}>${B}:accepted`]);
  });

  it('already accepted stays accepted from both sides', async () => {
    const { db } = await loadServer();
    await db.sendConnectionRequest(A, B, trip());
    await db.sendConnectionRequest(B, A, trip());
    expect(await db.sendConnectionRequest(A, B, trip())).toBe('accepted');
    expect(await db.sendConnectionRequest(B, A, trip())).toBe('accepted');
  });

  it('they declined me: cannot re-send', async () => {
    const { db, fake } = await loadServer();
    await db.sendConnectionRequest(A, B, trip());
    await db.respondToConnectionRequest(B, MATCH_AB, 'declined');
    expect(await db.sendConnectionRequest(A, B, trip())).toBe('declined');
    expect(status(fake)).toEqual([`${A}>${B}:declined`]);
  });

  it('I declined them: my request reopens the row with me as requester', async () => {
    const { db, fake } = await loadServer();
    await db.sendConnectionRequest(B, A, trip());
    await db.respondToConnectionRequest(A, MATCH_AB, 'declined');
    expect(await db.sendConnectionRequest(A, B, trip())).toBe('sent');
    expect(status(fake)).toEqual([`${A}>${B}:pending`]);
  });

  it('unique violation on insert is retried once against the other side\'s row', async () => {
    const { db, fake } = await loadServer();
    fake.failNext('matches', { code: '23505', message: 'dup' }, 'insert');
    expect(await db.sendConnectionRequest(A, B, trip())).toBe('sent');
    expect(fake.rows('matches')).toHaveLength(1);
  });

  it('returns null on read error, insert error, or unknown date', async () => {
    const { db, fake } = await loadServer();
    fake.failNext('matches', { message: 'x' }, 'select');
    expect(await db.sendConnectionRequest(A, B, trip())).toBeNull();
    fake.failNext('matches', { message: 'x' }, 'insert');
    expect(await db.sendConnectionRequest(A, B, trip())).toBeNull();
    expect(await db.sendConnectionRequest(A, B, trip({ travelDate: undefined, when: 'soon' }))).toBeNull();
  });
});

describe('respondToConnectionRequest', () => {
  it('only the receiver can answer, and only while pending', async () => {
    const { db, fake } = await loadServer();
    await db.sendConnectionRequest(A, B, trip());
    expect(await db.respondToConnectionRequest(A, MATCH_AB, 'accepted')).toBe(false); // requester
    expect(await db.respondToConnectionRequest(C, MATCH_AB, 'accepted')).toBe(false); // stranger
    expect(status(fake)).toEqual([`${A}>${B}:pending`]);
    expect(await db.respondToConnectionRequest(B, MATCH_AB, 'accepted')).toBe(true);
    expect(await db.respondToConnectionRequest(B, MATCH_AB, 'declined')).toBe(false); // already answered
    expect(status(fake)).toEqual([`${A}>${B}:accepted`]);
  });
});

describe('fetchInbox', () => {
  it('lists incoming requests with requester profile; outgoing status keyed by chat key', async () => {
    const { db } = await loadServer((f) => f.seed('profiles', [profileRow(A, { name: 'Asha Rao' }), profileRow(B)]));
    await db.sendConnectionRequest(A, B, trip(), 77);
    const forB = await db.fetchInbox(B);
    expect(forB.incoming).toMatchObject([
      { id: MATCH_AB, requesterId: A, name: 'Asha Rao', ini: 'AR', fit: 77, trainNumber: '6E214', travelDate: '2026-11-20' },
    ]);
    const forA = await db.fetchInbox(A);
    expect(forA.reqStatus).toEqual({ [`match_${B}`]: 'sent' });
    expect(forA.incoming).toEqual([]);
  });

  it('accepted pair: contacts + chat history for both sides, nothing left incoming', async () => {
    const { db } = await loadServer((f) => f.seed('profiles', [profileRow(A), profileRow(B)]));
    await db.sendConnectionRequest(A, B, trip());
    await db.respondToConnectionRequest(B, MATCH_AB, 'accepted');
    await db.sendChatMessageToSupabase(`match_${B}`, A, 'hello', false, 'msg_1');
    const forB = await db.fetchInbox(B);
    expect(forB.incoming).toEqual([]);
    expect(forB.reqStatus).toEqual({ [`match_${A}`]: 'accepted' });
    expect(forB.contacts.map((c) => c.id)).toEqual([`match_${A}`]);
    expect(forB.chats[`match_${A}`]).toMatchObject([{ id: 'msg_1', from: 'them', text: 'hello' }]);
    expect((await db.fetchInbox(A)).chats[`match_${B}`][0].from).toBe('me');
  });

  it('throws on DB error so the route can answer 500', async () => {
    const { db, fake } = await loadServer();
    fake.failNext('matches', { message: 'down' });
    await expect(db.fetchInbox(A)).rejects.toBeTruthy();
  });
});

describe('chat messages', () => {
  it('cannot send without an accepted connection', async () => {
    const { db, fake } = await loadServer();
    expect(await db.sendChatMessageToSupabase(`match_${B}`, A, 'hi')).toBe(false);
    await db.sendConnectionRequest(A, B, trip()); // pending only
    expect(await db.sendChatMessageToSupabase(`match_${B}`, A, 'hi')).toBe(false);
    expect(fake.rows('messages')).toHaveLength(0);
  });

  it('flags cards, preserves order, resolves sender per viewer', async () => {
    const { db } = await loadServer();
    await db.sendConnectionRequest(A, B, trip());
    await db.respondToConnectionRequest(B, MATCH_AB, 'accepted');
    expect(await db.sendChatMessageToSupabase(`match_${B}`, A, 'one', false, 'msg_1')).toBe(true);
    vi.setSystemTime(Date.parse('2026-11-16T06:00:05Z'));
    expect(await db.sendChatMessageToSupabase(`match_${A}`, B, 'Shared business card', true, 'msg_2')).toBe(true);
    const seenByA = await db.fetchLiveChatMessages(`match_${B}`, A);
    expect(seenByA).toMatchObject([
      { id: 'msg_1', from: 'me', card: false },
      { id: 'msg_2', from: 'them', card: true },
    ]);
  });

  it('a pair with two accepted trips shares one thread, written to the first row', async () => {
    const { db, fake } = await loadServer();
    const other = trip({ name: 'Flight AI 887', travelDate: '2026-11-21', when: '2026-11-21' });
    for (const t of [trip(), other]) {
      await db.sendConnectionRequest(A, B, t);
    }
    for (const r of fake.rows('matches')) await db.respondToConnectionRequest(B, r.id as string, 'accepted');
    await db.sendChatMessageToSupabase(`match_${B}`, A, 'hi', false, 'msg_1');
    const firstRow = fake.rows('matches').map((r) => r.id as string).sort()[0];
    expect(fake.rows('messages')[0].match_id).toBe(firstRow);
    // history is merged across rows even if a message sits on the second row
    fake.seed('messages', [{ id: 'msg_2', match_id: fake.rows('matches').map((r) => r.id).sort()[1], sender_id: B, text: 'yo', is_card: false, created_at: '2026-11-16T07:00:00Z' }]);
    expect((await db.fetchLiveChatMessages(`match_${B}`, A)).map((m) => m.id)).toEqual(['msg_1', 'msg_2']);
  });
});

describe('block and report', () => {
  it('block closes every connection for the pair and hides each side from the other', async () => {
    const { db, fake } = await loadServer((f) => f.seed('profiles', [profileRow(A), profileRow(B)]));
    await db.sendConnectionRequest(A, B, trip());
    await db.respondToConnectionRequest(B, MATCH_AB, 'accepted');
    expect(await db.blockUserInSupabase(A, B)).toBe(true);
    expect(fake.rows('blocks')).toMatchObject([{ id: `blk_${A}_${B}`, blocker_id: A, blocked_id: B }]);
    expect(status(fake)).toEqual([`${A}>${B}:declined`]);
    expect([...(await db.fetchBlockedIds(B))]).toEqual([A]); // symmetric
    expect(await db.sendChatMessageToSupabase(`match_${B}`, A, 'still there?')).toBe(false);
    expect((await db.fetchInbox(B)).contacts).toEqual([]);
  });

  it('rejects empty ids; report stores reason + details', async () => {
    const { db, fake } = await loadServer();
    expect(await db.blockUserInSupabase('', B)).toBe(false);
    expect(await db.reportUserInSupabase(A, B, 'Spam', 'details')).toBe(true);
    expect(fake.rows('reports')).toMatchObject([{ reporter_id: A, reported_id: B, reason: 'Spam', details: 'details' }]);
    fake.failNext('reports');
    expect(await db.reportUserInSupabase(A, B, 'Spam')).toBe(false);
  });
});

describe('deleteUserAccount', () => {
  it('removes everything of the user, keeps reports and other users', async () => {
    const { db, fake } = await loadServer((f) =>
      f.seed('profiles', [profileRow(A), profileRow(B)]).seed('auth_otps', [{ phone: '1111111111', otp_hash: '1' }])
    );
    await db.sendConnectionRequest(A, B, trip());
    await db.respondToConnectionRequest(B, MATCH_AB, 'accepted');
    await db.sendChatMessageToSupabase(`match_${B}`, A, 'bye', false, 'msg_1');
    await db.blockUserInSupabase(B, A);
    await db.reportUserInSupabase(B, A, 'Spam');
    expect(await db.deleteUserAccount(A)).toBe(true);
    expect(fake.rows('messages')).toEqual([]);
    expect(fake.rows('matches')).toEqual([]);
    expect(fake.rows('blocks')).toEqual([]);
    expect(fake.rows('auth_otps')).toEqual([]);
    expect(fake.rows('profiles').map((p) => p.id)).toEqual([B]);
    expect(fake.rows('reports')).toHaveLength(1);
  });

  it('stops at the first failure and reports false so the caller can retry', async () => {
    const { db, fake } = await loadServer((f) => f.seed('profiles', [profileRow(A)]));
    fake.failNext('trips', { message: 'locked' }, 'delete');
    expect(await db.deleteUserAccount(A)).toBe(false);
    expect(fake.rows('profiles')).toHaveLength(1); // profile (later step) untouched
    expect(await db.deleteUserAccount('')).toBe(false);
  });
});
