// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAIL, deferred, mockApi } from '../helpers/api';
import type { IncomingRequestItem, MatchProfile, TripData } from '@/types';

const ME = 'usr_1111111111';
const OTHER = 'usr_2222222222';
const KEY = `match_${OTHER}`;

const mkTrip = (over: Partial<TripData> = {}): TripData => ({
  id: 't1',
  kind: 'flight',
  name: 'IndiGo 6E 214',
  route: 'AMD → BOM',
  when: '2026-11-20',
  travelDate: '2026-11-20',
  fromCode: 'AMD',
  toCode: 'BOM',
  vis: { business: true, social: false, twoh: false },
  ...over,
});
const mkMatch = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  id: KEY, tripId: 't1', type: 'Business', name: 'Bina Shah', company: 'Shah Mills', industry: 'Textiles', ini: 'BS', fit: 90, ...over,
});
const incoming: IncomingRequestItem = {
  id: `match_${OTHER}_${ME}_6E214_2026-11-20`, requesterId: OTHER, name: 'Bina Shah', company: 'Shah Mills',
  industry: 'Textiles', ini: 'BS', fit: 90, trainNumber: '6E214', travelDate: '2026-11-20',
};

async function load() {
  vi.resetModules();
  const { useAppStore } = await import('@/store/useAppStore');
  const sync = await import('@/lib/supabaseSync');
  return { store: useAppStore, get: () => useAppStore.getState(), set: useAppStore.setState, sync };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: Date.parse('2026-11-16T06:00:00Z') });
});
afterEach(() => vi.useRealTimers());

/** Let pending promise chains (fetch mocks) settle. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0);
};

describe('login / account switching', () => {
  it('same account keeps local data and merges remote trips without duplicating', async () => {
    const api = mockApi({ myTrips: () => [mkTrip({ id: 'remote_same' }), mkTrip({ id: 'remote_new', name: 'Flight AI 887', travelDate: '2026-11-21', when: '2026-11-21' })] });
    const { get, set } = await load();
    set({ userId: ME, trips: [mkTrip()], chats: { [KEY]: [{ id: 'msg_1', from: 'me', text: 'hi' }] } });
    get().loginUser(ME, { name: 'Asha' }, { business: false, social: true });
    await settle();
    expect(get().trips.map((t) => t.id)).toEqual(['t1', 'remote_new']);
    expect(get().chats[KEY]).toHaveLength(1);
    expect(get().profile.name).toBe('Asha');
    expect(get().modes).toEqual({ business: false, social: true });
    expect(api.actions()).toEqual(['myTrips']);
  });

  it('different account wipes the previous user\'s trips, chats, matches and requests', async () => {
    mockApi({ myTrips: () => [] });
    const { get, set } = await load();
    set({ userId: ME, trips: [mkTrip()], matches: [mkMatch()], chats: { [KEY]: [{ id: 'm', from: 'me', text: 'x' }] }, incomingRequests: [incoming], req: { [KEY]: 'sent' }, pro: true, profile: { ...get().profile, name: 'Old Name' } });
    get().loginUser(OTHER);
    await settle();
    expect(get()).toMatchObject({ userId: OTHER, trips: [], matches: [], chats: {}, incomingRequests: [], req: {}, pro: false });
    expect(get().profile.name).toBe('');
    expect(localStorage.getItem('triplink_user_id')).toBe(OTHER);
  });

  it('ignores remote trips that arrive after switching to another account', async () => {
    const d = deferred<TripData[]>();
    let n = 0;
    mockApi({ myTrips: () => (n++ === 0 ? d.promise : []) }); // 1st account's slow response, 2nd account has none
    const { get, set } = await load();
    set({ userId: ME });
    get().loginUser(ME);
    get().loginUser(OTHER);
    d.resolve([mkTrip({ id: 'late' })]);
    await settle();
    expect(get().trips).toEqual([]);
  });
});

describe('logout and delete account', () => {
  it('logout clears user data, tells the server, goes to welcome with a fresh anon id', async () => {
    const api = mockApi();
    const { get, set } = await load();
    set({ userId: ME, screen: 'main', trips: [mkTrip()], phone: '9876543210' });
    get().logout();
    await settle();
    expect(get()).toMatchObject({ screen: 'welcome', trips: [], phone: '' });
    expect(get().userId).not.toBe(ME);
    expect(api.spy.mock.calls.some((c) => String(c[0]) === '/api/auth/logout')).toBe(true);
    expect(get().toastMessage?.text).toBe('Logged out');
  });

  it('resetAll deletes server-side then logs out', async () => {
    const api = mockApi({ deleteAccount: () => true });
    const { get, set } = await load();
    set({ userId: ME, screen: 'main' });
    await get().resetAll();
    expect(api.actions()).toContain('deleteAccount');
    expect(get().screen).toBe('welcome');
    expect(get().toastMessage?.text).toBe('Account deleted');
  });

  it('resetAll keeps the user signed in when deletion fails', async () => {
    mockApi({ deleteAccount: () => false });
    const { get, set } = await load();
    set({ userId: ME, screen: 'main', trips: [mkTrip()] });
    await get().resetAll();
    expect(get().screen).toBe('main');
    expect(get().trips).toHaveLength(1);
    expect(get().toastMessage?.text).toBe('Could not delete account. Try again.');
  });
});

describe('profile and modes', () => {
  it('saveProfileAndEnter syncs profile + modes, enters main, toasts', async () => {
    const api = mockApi({ syncProfile: () => true });
    const { get, set } = await load();
    set({ screen: 'create' });
    get().updateProfileField('name', 'Asha Rao');
    get().saveProfileAndEnter();
    await settle();
    expect(api.callsOf('syncProfile')[0].args).toMatchObject([{ name: 'Asha Rao' }, { business: true, social: false }]);
    expect(get()).toMatchObject({ screen: 'main', tab: 'trips' });
    expect(get().toastMessage?.text).toBe('Profile Saved');
  });

  it('toggleMode syncs immediately only on the main screen (onboarding syncs on save)', async () => {
    const api = mockApi({ syncProfile: () => true });
    const { get, set } = await load();
    set({ screen: 'mode' });
    get().toggleMode('social');
    expect(api.callsOf('syncProfile')).toHaveLength(0);
    set({ screen: 'main' });
    get().toggleMode('business');
    await settle();
    expect(api.callsOf('syncProfile')[0].args[1]).toEqual({ business: false, social: true });
  });

  it('persist: only whitelisted keys are saved; transient state is not', async () => {
    mockApi();
    const { get, set } = await load();
    set({ otp: ['1', '2', '3', '4'], toastMessage: { id: 1, text: 'x' }, unread: { a: true }, incomingRequests: [incoming], trips: [mkTrip()] });
    get().setPhone('9876543210');
    const saved = JSON.parse(localStorage.getItem('triplink_app_storage_v2')!).state;
    expect(saved.trips).toHaveLength(1);
    expect(saved.phone).toBe('9876543210');
    expect(saved).not.toHaveProperty('otp');
    expect(saved).not.toHaveProperty('toastMessage');
    expect(saved).not.toHaveProperty('unread');
    expect(saved).not.toHaveProperty('incomingRequests');
  });
});

describe('add trip', () => {
  const found = {
    kind: 'flight' as const, name: 'IndiGo 6E 214', route: 'AMD → BOM', when: '2026-11-20', travelDate: '2026-11-20',
    fromCode: 'AMD', toCode: 'BOM', boardingPass: 'RAW-PASS', ticketVerified: true,
  };

  it('openAddTrip starts at step 1 for today, social visibility follows the profile mode', async () => {
    mockApi();
    const { get, set } = await load();
    set({ modes: { business: true, social: true } });
    get().openAddTrip();
    expect(get().add).toMatchObject({ step: 1, kind: 'train', date: '2026-11-16', vis: { business: true, social: true, twoh: false } });
  });

  it('confirmAddTrip adds + selects the trip, syncs profile BEFORE trip, sends the pass once, loads matches', async () => {
    const order: string[] = [];
    const api = mockApi({
      syncProfile: () => (order.push('profile'), true),
      syncTrip: () => (order.push('trip'), true),
      coTravelers: () => [mkMatch({ tripId: 'IGNORED' })],
    });
    const { get, set } = await load();
    get().openAddTrip();
    get().updateAddTrip({ found, vis: { business: true, social: true, twoh: true } });
    set({ tab: 'profile' });
    get().confirmAddTrip();
    await settle();
    const [t] = get().trips;
    expect(t).toMatchObject({ name: 'IndiGo 6E 214', ticketVerified: true, vis: { business: true, social: true, twoh: true } });
    expect(get()).toMatchObject({ selTripId: t.id, tab: 'trips', add: null });
    expect(order).toEqual(['profile', 'trip']);
    expect(api.callsOf('syncTrip')[0].args[1]).toBe('RAW-PASS');
    expect(get().matches).toHaveLength(1);
    // toast action jumps to matches
    expect(get().toastMessage?.text).toBe('Trip Added Successfully');
    get().toastMessage!.onAction!();
    expect(get()).toMatchObject({ tab: 'matches', selTripId: t.id });
  });

  it('confirmAddTrip is a no-op without a found trip', async () => {
    const api = mockApi();
    const { get } = await load();
    get().openAddTrip();
    get().confirmAddTrip();
    expect(get().trips).toEqual([]);
    expect(api.dbCalls).toEqual([]);
  });

  it('a failed match fetch leaves the trip added and matches empty', async () => {
    mockApi({ syncProfile: () => true, syncTrip: () => true, coTravelers: () => FAIL });
    const { get } = await load();
    get().openAddTrip();
    get().updateAddTrip({ found });
    get().confirmAddTrip();
    await settle();
    expect(get().trips).toHaveLength(1);
    expect(get().matches).toEqual([]);
  });
});

describe('matches', () => {
  it('refreshLiveMatches replaces only that trip\'s matches and drops duplicate contact-only entries', async () => {
    mockApi({ coTravelers: () => [mkMatch({ name: 'Fresh' })] });
    const { get, set } = await load();
    set({
      trips: [mkTrip(), mkTrip({ id: 't2' })],
      selTripId: 't1',
      matches: [mkMatch({ name: 'Stale' }), mkMatch({ id: 'match_usr_9', tripId: 't2' }), mkMatch({ tripId: '', name: 'Contact only' })],
    });
    await get().refreshLiveMatches();
    expect(get().matches.map((m) => `${m.tripId || '-'}:${m.name}`).sort()).toEqual(['t1:Fresh', 't2:Bina Shah']);
  });

  it('keeps the cached list when the fetch fails', async () => {
    mockApi({ coTravelers: () => FAIL });
    const { get, set } = await load();
    set({ trips: [mkTrip()], selTripId: 't1', matches: [mkMatch()] });
    await get().refreshLiveMatches('t1');
    expect(get().matches).toHaveLength(1);
  });

  it('selectTrip jumps to the matches tab and resets the filter', async () => {
    mockApi();
    const { get, set } = await load();
    set({ filter: 'Social' });
    get().selectTrip('t1');
    expect(get()).toMatchObject({ tab: 'matches', selTripId: 't1', filter: 'All' });
  });
});

describe('connect / accept / decline', () => {
  const ready = async (handlers: Parameters<typeof mockApi>[0]) => {
    const api = mockApi(handlers);
    const ctx = await load();
    ctx.set({ userId: ME, trips: [mkTrip()], matches: [mkMatch()] });
    return { api, ...ctx };
  };

  it('optimistically shows "sent", then keeps the server status', async () => {
    const d = deferred<string>();
    const { get, api } = await ready({ sendRequest: () => d.promise });
    get().connectWith(KEY);
    expect(get().req[KEY]).toBe('sent');
    d.resolve('sent');
    await settle();
    expect(get().req[KEY]).toBe('sent');
    expect(api.callsOf('sendRequest')[0].args).toMatchObject([OTHER, { id: 't1' }, 90]);
    expect(get().toastMessage?.text).toBe('Request sent to Bina Shah');
  });

  it('mutual accept: creates the chat, clears their incoming request, offers to open the chat', async () => {
    const { get, set } = await ready({ sendRequest: () => 'accepted' });
    set({ incomingRequests: [incoming] });
    get().connectWith(KEY);
    await settle();
    expect(get().req[KEY]).toBe('accepted');
    expect(get().chats[KEY]).toEqual([]);
    expect(get().incomingRequests).toEqual([]);
    get().toastMessage!.onAction!();
    expect(get()).toMatchObject({ tab: 'chats', activeChatId: KEY });
  });

  it('failure rolls the optimistic state back (to nothing, or to the previous status)', async () => {
    const { get, set } = await ready({ sendRequest: () => FAIL });
    get().connectWith(KEY);
    await settle();
    expect(get().req[KEY]).toBeUndefined();
    expect(get().toastMessage?.text).toBe('Could not send request. Try again.');
    set({ req: { [KEY]: 'declined' } });
    get().connectWith(KEY);
    await settle();
    expect(get().req[KEY]).toBe('declined');
  });

  it('declined by them shows the declined toast', async () => {
    const { get } = await ready({ sendRequest: () => 'declined' });
    get().connectWith(KEY);
    await settle();
    expect(get().req[KEY]).toBe('declined');
    expect(get().toastMessage?.text).toContain('declined your earlier request');
  });

  it('uses the trip the match was found on, not the selected trip; unknown match/trip is ignored', async () => {
    const { get, set, api } = await ready({ sendRequest: () => 'sent' });
    set({ trips: [mkTrip(), mkTrip({ id: 't2', name: 'Flight AI 887' })], selTripId: 't2' });
    get().connectWith(KEY);
    await settle();
    expect((api.callsOf('sendRequest')[0].args[1] as TripData).id).toBe('t1');
    get().connectWith('match_usr_9999999999');
    set({ matches: [mkMatch({ tripId: 'gone' })] });
    get().connectWith(KEY);
    await settle();
    expect(api.callsOf('sendRequest')).toHaveLength(1);
  });

  it('acceptIncomingRequest: adds contact + empty chat, removes the request', async () => {
    const { get, set, api } = await ready({ respondRequest: () => true });
    set({ matches: [], incomingRequests: [incoming] });
    await get().acceptIncomingRequest(incoming);
    expect(api.callsOf('respondRequest')[0].args).toEqual([incoming.id, 'accepted']);
    expect(get().incomingRequests).toEqual([]);
    expect(get().req[KEY]).toBe('accepted');
    expect(get().matches).toMatchObject([{ id: KEY, name: 'Bina Shah', tripId: '' }]);
    expect(get().chats[KEY]).toEqual([]);
  });

  it('acceptIncomingRequest failure keeps the request and toasts', async () => {
    const { get, set } = await ready({ respondRequest: () => false });
    set({ incomingRequests: [incoming] });
    await get().acceptIncomingRequest(incoming);
    expect(get().incomingRequests).toHaveLength(1);
    expect(get().toastMessage?.text).toBe('Could not accept request. Try again.');
  });

  it('declineIncomingRequest removes it and tells the server', async () => {
    const { get, set, api } = await ready({ respondRequest: () => true });
    set({ incomingRequests: [incoming] });
    await get().declineIncomingRequest(incoming.id);
    expect(api.callsOf('respondRequest')[0].args).toEqual([incoming.id, 'declined']);
    expect(get().incomingRequests).toEqual([]);
  });
});

describe('inbox sync', () => {
  it('merges requests, statuses, contacts and chat histories; flags unread for new incoming', async () => {
    mockApi({
      inbox: () => ({
        incoming: [incoming],
        reqStatus: { [KEY]: 'accepted' },
        contacts: [mkMatch({ tripId: '' })],
        chats: { [KEY]: [{ id: 'msg_1', from: 'them', text: 'hello' }] },
      }),
    });
    const { get } = await load();
    await get().syncUserRequests();
    expect(get().incomingRequests).toHaveLength(1);
    expect(get().req[KEY]).toBe('accepted');
    expect(get().matches.map((m) => m.id)).toEqual([KEY]);
    expect(get().chats[KEY]).toMatchObject([{ id: 'msg_1', text: 'hello' }]);
    expect(get().unread[KEY]).toBe(true);
  });

  it('does not flag unread for the chat that is open or for my own messages', async () => {
    mockApi({ inbox: () => ({ incoming: [], reqStatus: {}, contacts: [], chats: { [KEY]: [{ id: 'm1', from: 'them', text: 'x' }], other: [{ id: 'm2', from: 'me', text: 'y' }] } }) });
    const { get, set } = await load();
    set({ activeChatId: KEY });
    await get().syncUserRequests();
    expect(get().unread).toEqual({});
  });

  it('keeps cached state on failure, and ignores a response that arrives after logout', async () => {
    const { get, set } = await load();
    mockApi({ inbox: () => FAIL });
    set({ incomingRequests: [incoming] });
    await get().syncUserRequests();
    expect(get().incomingRequests).toHaveLength(1);

    const d = deferred<unknown>();
    vi.restoreAllMocks();
    mockApi({ inbox: () => d.promise });
    set({ userId: ME });
    const p = get().syncUserRequests();
    set({ userId: OTHER });
    d.resolve({ incoming: [], reqStatus: { [KEY]: 'accepted' }, contacts: [], chats: {} });
    await p;
    expect(get().req).toEqual({});
  });

  it('requests from someone I blocked (gone) are filtered out', async () => {
    mockApi({ inbox: () => ({ incoming: [incoming], reqStatus: {}, contacts: [], chats: {} }) });
    const { get, set } = await load();
    set({ gone: { [KEY]: true } });
    await get().syncUserRequests();
    expect(get().incomingRequests).toEqual([]);
  });
});

describe('chat', () => {
  const open = async (handlers: Parameters<typeof mockApi>[0]) => {
    const api = mockApi(handlers);
    const ctx = await load();
    ctx.set({ userId: ME, matches: [mkMatch()], activeChatId: KEY, chats: { [KEY]: [] } });
    return { api, ...ctx };
  };

  it('sendMessage: trims, shows pending, clears the flag on success', async () => {
    const d = deferred<boolean>();
    const { get, api } = await open({ sendMessage: () => d.promise });
    get().sendMessage('  hello  ');
    expect(get().chats[KEY]).toMatchObject([{ from: 'me', text: 'hello', status: 'pending' }]);
    d.resolve(true);
    await settle();
    expect(get().chats[KEY][0].status).toBeUndefined();
    const args = api.callsOf('sendMessage')[0].args;
    expect(args.slice(0, 3)).toEqual([KEY, 'hello', false]);
    expect(String(args[3])).toMatch(/^msg_/);
  });

  it('failure marks the message failed and toasts; a later poll keeps the failed message', async () => {
    const { get } = await open({ sendMessage: () => false, messages: () => [{ id: 'msg_srv', from: 'them', text: 'yo' }] });
    get().sendMessage('hi');
    await settle();
    expect(get().chats[KEY][0].status).toBe('failed');
    expect(get().toastMessage?.text).toBe('Message not delivered. Check connection.');
    await get().syncChatMessages(KEY);
    expect(get().chats[KEY].map((m) => m.text)).toEqual(['yo', 'hi']);
  });

  it('ignores blank text and no active chat', async () => {
    const { get, set, api } = await open({ sendMessage: () => true });
    get().sendMessage('   ');
    set({ activeChatId: null });
    get().sendMessage('hi');
    await settle();
    expect(api.callsOf('sendMessage')).toHaveLength(0);
  });

  it('shareBusinessCard sends a card message', async () => {
    const { get, api } = await open({ sendMessage: () => true });
    get().shareBusinessCard();
    await settle();
    expect(get().chats[KEY]).toMatchObject([{ card: true, from: 'me' }]);
    expect(api.callsOf('sendMessage')[0].args.slice(0, 3)).toEqual([KEY, 'Shared business card', true]);
  });

  it('openChat clears unread, switches tab and loads history', async () => {
    const { get, set, api } = await open({ messages: () => [{ id: 'm1', from: 'them', text: 'hey' }] });
    set({ unread: { [KEY]: true, other: true }, activeChatId: null, tab: 'matches' });
    get().openChat(KEY);
    await settle();
    expect(get()).toMatchObject({ tab: 'chats', activeChatId: KEY, unread: { other: true } });
    expect(api.callsOf('messages')).toHaveLength(1);
    expect(get().chats[KEY]).toHaveLength(1);
  });

  it('history for a blocked chat is ignored; empty history never wipes local messages', async () => {
    const { get, set } = await open({ messages: () => [] });
    set({ chats: { [KEY]: [{ id: 'm1', from: 'me', text: 'keep' }] } });
    await get().syncChatMessages(KEY);
    expect(get().chats[KEY]).toHaveLength(1);
    mockApi({ messages: () => [{ id: 'm9', from: 'them', text: 'new' }] });
    set({ gone: { [KEY]: true } });
    await get().syncChatMessages(KEY);
    expect(get().chats[KEY]).toHaveLength(1);
  });

  it('switching accounts mid-fetch drops the response', async () => {
    const d = deferred<unknown>();
    const { get, set } = await open({ messages: () => d.promise });
    const p = get().syncChatMessages(KEY);
    set({ userId: OTHER });
    d.resolve([{ id: 'm1', from: 'them', text: 'x' }]);
    await p;
    expect(get().chats[KEY]).toEqual([]);
  });
});

describe('block and report', () => {
  const setup = async () => {
    const api = mockApi({ block: () => true, report: () => true });
    const ctx = await load();
    ctx.set({ matches: [mkMatch()], req: { [KEY]: 'accepted' }, chats: { [KEY]: [{ id: 'm', from: 'me', text: 'x' }] }, unread: { [KEY]: true }, activeChatId: KEY, sheet: { kind: 'detail', id: KEY } });
    return { api, ...ctx };
  };

  it('blockPerson hides the person everywhere and calls the server with the bare user id', async () => {
    const { get, api } = await setup();
    get().blockPerson(KEY);
    await settle();
    expect(api.callsOf('block')[0].args).toEqual([OTHER]);
    expect(get()).toMatchObject({ gone: { [KEY]: true }, req: {}, chats: {}, unread: {}, activeChatId: null, sheet: null });
    expect(get().toastMessage?.text).toBe('User blocked and removed');
  });

  it('reportPerson reports, then blocks', async () => {
    const { get, api } = await setup();
    get().reportPerson(KEY, 'Spam', 'details');
    await settle();
    expect(api.actions().slice(0, 2)).toEqual(['report', 'block']);
    expect(api.callsOf('report')[0].args).toEqual([OTHER, 'Spam', 'details']);
    expect(get().gone[KEY]).toBe(true);
  });

  it('known quirk: the person is removed locally even if the server call fails', async () => {
    mockApi({ block: () => FAIL });
    const { get, set } = await load();
    set({ matches: [mkMatch()] });
    get().blockPerson(KEY);
    await settle();
    expect(get().gone[KEY]).toBe(true);
  });
});

describe('refreshFlightTrip', () => {
  const adb = (over: Record<string, unknown> = {}) => ({
    success: true,
    data: {
      airlineName: 'IndiGo', flightNumber: '6E 214', travelDate: '2026-11-18', fromCode: 'AMD', toCode: 'BOM', fromCity: 'Ahmedabad', toCity: 'Mumbai',
      departureTime: '10:00', arrivalTime: '11:30', duration: '1h 30m', status: 'Delayed', ...over,
    },
  });
  const setup = async (data: unknown, trip = mkTrip({ travelDate: '2026-11-18', when: '2026-11-18' })) => {
    const api = mockApi({ syncTrip: () => true }, { '/api/flights/verify': () => data });
    const ctx = await load();
    ctx.set({ trips: [trip] });
    return { api, ...ctx };
  };
  const flightCalls = (api: ReturnType<typeof mockApi>) => api.spy.mock.calls.filter((c) => String(c[0]) === '/api/flights/verify').length;

  it('updates times and status, and re-syncs because departsAt changed', async () => {
    const { get, api } = await setup(adb());
    await get().refreshFlightTrip('t1');
    expect(get().trips[0]).toMatchObject({ flightStatus: 'Delayed', departsAt: '2026-11-18T10:00:00+05:30', when: expect.stringContaining('10:00') });
    expect(api.callsOf('syncTrip')).toHaveLength(1);
  });

  it('is throttled to once per 10 minutes per trip', async () => {
    const { get, api } = await setup(adb());
    await get().refreshFlightTrip('t1');
    await get().refreshFlightTrip('t1');
    expect(flightCalls(api)).toBe(1);
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1);
    await get().refreshFlightTrip('t1');
    expect(flightCalls(api)).toBe(2);
  });

  it.each([
    ['a train', mkTrip({ kind: 'train', travelDate: '2026-11-18' })],
    ['more than 7 days out', mkTrip({ travelDate: '2026-11-24', when: '2026-11-24' })],
    ['already departed (past date)', mkTrip({ travelDate: '2026-11-15', when: '2026-11-15' })],
  ])('does not look up %s', async (_n, trip) => {
    const { get, api } = await setup(adb(), trip);
    await get().refreshFlightTrip('t1');
    expect(flightCalls(api)).toBe(0);
  });

  it('ignores a lookup whose airports disagree with the trip (pass/manual entry wins)', async () => {
    const { get } = await setup(adb({ toCode: 'DEL' }));
    await get().refreshFlightTrip('t1');
    expect(get().trips[0].flightStatus).toBeUndefined();
  });

  it('does not write when nothing changed, and survives a failed lookup', async () => {
    const same = mkTrip({
      travelDate: '2026-11-18', when: '2026-11-18 · 10:00 - 11:30 (1h 30m)', departsAt: '2026-11-18T10:00:00+05:30', flightStatus: 'Delayed',
      route: 'Ahmedabad (AMD) → Mumbai (BOM)',
    });
    const { get, api } = await setup(adb(), same);
    await get().refreshFlightTrip('t1');
    expect(api.callsOf('syncTrip')).toHaveLength(0);

    mockApi({}, { '/api/flights/verify': () => new Response('x', { status: 500 }) });
    get().setFilter('All');
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    await expect(get().refreshFlightTrip('t1')).resolves.toBeUndefined();
  });
});

describe('toast', () => {
  it('auto-clears after 2.8s (4.5s with an action) and a newer toast is not cleared by an older timer', async () => {
    mockApi();
    const { get } = await load();
    get().showToast('first');
    await vi.advanceTimersByTimeAsync(2000);
    get().showToast('second');
    await vi.advanceTimersByTimeAsync(1000); // first's timer fires now
    expect(get().toastMessage?.text).toBe('second');
    await vi.advanceTimersByTimeAsync(2000);
    expect(get().toastMessage).toBeNull();
    get().showToast('with action', 'Go', () => {});
    await vi.advanceTimersByTimeAsync(4000);
    expect(get().toastMessage).not.toBeNull();
    await vi.advanceTimersByTimeAsync(600);
    expect(get().toastMessage).toBeNull();
  });
});

describe('navigation', () => {
  it('setTab closes chat and sheets', async () => {
    mockApi();
    const { get, set } = await load();
    set({ activeChatId: KEY, sheet: { kind: 'safety' } });
    get().setTab('profile');
    expect(get()).toMatchObject({ tab: 'profile', activeChatId: null, sheet: null });
  });

  it('otp digit helpers tolerate corrupted persisted state', async () => {
    mockApi();
    const { get, set } = await load();
    set({ otp: undefined as unknown as string[] });
    get().setOtpDigit(2, '7');
    expect(get().otp).toEqual(['', '', '7', '']);
    get().setFullOtp(null as unknown as string[]);
    expect(get().otp).toEqual(['', '', '', '']);
  });
});
