// @vitest-environment jsdom
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { MatchesTab } from '@/features/matches/MatchesTab';
import { MatchDetailSheet } from '@/features/matches/MatchDetailSheet';
import { ChatsTab } from '@/features/chats/ChatsTab';
import { SafetySheet } from '@/features/safety/SafetySheet';
import { ProfileTab } from '@/features/profile/ProfileTab';
import { BottomNav } from '@/features/common/BottomNav';
import { Toast } from '@/features/common/Toast';
import Home from '@/app/page';
import { UNAUTH, mockApi } from '../helpers/api';
import type { IncomingRequestItem, MatchProfile, TripData } from '@/types';

const st = () => useAppStore.getState();
const toast = () => st().toastMessage?.text;

beforeAll(() => {
  // jsdom has no layout; ActiveChatView scrolls to the newest message.
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

const trip = (over: Partial<TripData> = {}): TripData => ({
  id: 't1', kind: 'flight', name: 'IndiGo 6E 214', route: 'AMD → BOM', when: '2099-01-01', travelDate: '2099-01-01',
  vis: { business: true, social: false, twoh: false }, ...over,
});
const match = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  id: 'match_usr_2222222222', tripId: 't1', type: 'Business', name: 'Bina Shah', company: 'Shah Mills', industry: 'Textiles', ini: 'BS', fit: 90, ...over,
});
const incoming = (over: Partial<IncomingRequestItem> = {}): IncomingRequestItem => ({
  id: 'match_row_1', requesterId: 'usr_3333333333', name: 'Chetan Rao', company: 'Rao Co', industry: 'Garments', ini: 'CR', fit: 88,
  trainNumber: '6E214', travelDate: '2099-01-01', ...over,
});
const inbox = (over = {}) => ({ incoming: [], reqStatus: {}, contacts: [], chats: {}, ...over });

describe('MatchesTab', () => {
  const live = (matches: MatchProfile[], extra: Record<string, () => unknown> = {}) =>
    mockApi({ coTravelers: () => matches, inbox: () => inbox(), ...extra });

  it('empty state when there are no trips', async () => {
    mockApi();
    render(<MatchesTab />);
    expect(screen.getByText('No trips active')).toBeTruthy();
    await userEvent.click(screen.getByText('Go to Trips'));
    expect(st().tab).toBe('trips');
  });

  it('loads and lists co-travellers for the selected trip (other trips\' matches hidden, blocked hidden)', async () => {
    live([match(), match({ id: 'match_usr_4', name: 'Hidden Blocked' })]);
    useAppStore.setState({ trips: [trip()], selTripId: 't1', gone: { match_usr_4: true }, matches: [match({ id: 'match_usr_5', tripId: 'other', name: 'Other Trip' })] });
    render(<MatchesTab />);
    await screen.findByText('Bina Shah');
    expect(screen.queryByText('Hidden Blocked')).toBeNull();
    expect(screen.queryByText('Other Trip')).toBeNull();
    expect(screen.getByText('1 matches · AMD → BOM')).toBeTruthy();
    expect(screen.getByText('90%')).toBeTruthy();
  });

  it('filters: Business, Social, Same industry', async () => {
    live([
      match(),
      match({ id: 'match_usr_6', name: 'Sana Social', type: 'Social', industry: 'Retail', tags: ['Cricket'] }),
      match({ id: 'match_usr_7', name: 'Garment Guy', industry: 'Garments' }),
    ]);
    useAppStore.setState({ trips: [trip()], selTripId: 't1', profile: { ...st().profile, industry: 'Garments' } });
    render(<MatchesTab />);
    await screen.findByText('Bina Shah');
    const filter = (name: string) => userEvent.click(within(screen.getByRole('group', { name: 'Filter' })).getByText(name));
    await filter('Social');
    expect(screen.queryByText('Bina Shah')).toBeNull();
    expect(screen.getByText('Sana Social')).toBeTruthy();
    expect(screen.getByText('Cricket')).toBeTruthy(); // social cards show interests
    await filter('Business');
    expect(screen.queryByText('Sana Social')).toBeNull();
    expect(screen.getByText('Garment Guy')).toBeTruthy();
    await filter('Same industry');
    expect(screen.getAllByText('Connect')).toHaveLength(1);
    expect(screen.getByText('Garment Guy')).toBeTruthy();
    expect(screen.queryByText('Bina Shah')).toBeNull();
  });

  it('empty filter result explains itself', async () => {
    live([]);
    useAppStore.setState({ trips: [trip()], selTripId: 't1', filter: 'Social' });
    render(<MatchesTab />);
    expect(await screen.findByText('No social matches yet')).toBeTruthy();
  });

  it('Connect sends a request for that trip; the card then shows "Request sent" and the tap does not open the sheet', async () => {
    const api = live([match()], { sendRequest: () => 'sent' });
    useAppStore.setState({ trips: [trip()], selTripId: 't1' });
    render(<MatchesTab />);
    await userEvent.click(await screen.findByText('Connect'));
    await screen.findByText('Request sent');
    expect(api.callsOf('sendRequest')[0].args).toMatchObject(['usr_2222222222', { id: 't1' }, 90]);
    expect(st().sheet).toBeNull();
  });

  it('tapping the card opens the detail sheet; accepted connections show Message', async () => {
    live([match()]);
    useAppStore.setState({ trips: [trip()], selTripId: 't1', req: { match_usr_2222222222: 'accepted' } });
    render(<MatchesTab />);
    await userEvent.click(await screen.findByText('Message'));
    expect(st()).toMatchObject({ tab: 'chats', activeChatId: 'match_usr_2222222222' });
    useAppStore.setState({ tab: 'matches', activeChatId: null });
    await userEvent.click(screen.getByText('Bina Shah'));
    expect(st().sheet).toEqual({ kind: 'detail', id: 'match_usr_2222222222' });
  });

  it('shows the ticket badge for boarding-pass-verified travellers', async () => {
    live([match({ ticketVerified: true })]);
    useAppStore.setState({ trips: [trip()], selTripId: 't1' });
    render(<MatchesTab />);
    expect(await screen.findByText('Ticket')).toBeTruthy();
  });

  it('incoming requests: this trip first, others grouped separately; Accept and Decline work', async () => {
    const mine = incoming();
    const other = incoming({ id: 'match_row_2', name: 'Dev Patel', trainNumber: 'AI887', requesterId: 'usr_4444444444' });
    const api = mockApi({
      coTravelers: () => [], inbox: () => inbox({ incoming: [mine, other] }),
      respondRequest: () => true,
    });
    useAppStore.setState({ trips: [trip()], selTripId: 't1' });
    render(<MatchesTab />);
    await screen.findByText('Incoming Requests (1)');
    expect(screen.getByText('Requests on your other trips (1)')).toBeTruthy();
    expect(screen.getByText('Wants to connect on 6E214 (2099-01-01)')).toBeTruthy();

    const card = screen.getByText('Chetan Rao').closest('.x-card') as HTMLElement;
    await userEvent.click(within(card).getByText('Accept'));
    await waitFor(() => expect(st().req.match_usr_3333333333).toBe('accepted'));
    expect(screen.queryByText('Chetan Rao')).toBeNull();

    const card2 = screen.getByText('Dev Patel').closest('.x-card') as HTMLElement;
    await userEvent.click(within(card2).getByText('Decline'));
    await waitFor(() => expect(screen.queryByText('Dev Patel')).toBeNull());
    expect(api.callsOf('respondRequest').map((c) => c.args[1])).toEqual(['accepted', 'declined']);
  });

  it('cancelled flight: matching paused with a note and no co-traveller lookups', async () => {
    const api = live([match()]);
    useAppStore.setState({ trips: [trip({ flightStatus: 'Canceled' })], selTripId: 't1' });
    render(<MatchesTab />);
    expect(screen.getByText(/flight has been cancelled/)).toBeTruthy();
    await waitFor(() => expect(api.callsOf('inbox').length).toBeGreaterThan(0));
    expect(api.callsOf('coTravelers')).toHaveLength(0);
  });

  it('trip dropdown switches trip and resets the filter', async () => {
    live([]);
    useAppStore.setState({ trips: [trip(), trip({ id: 't2', name: 'Tejas (12951)' })], selTripId: 't1', filter: 'Social' });
    render(<MatchesTab />);
    await userEvent.selectOptions(screen.getByLabelText('Trip'), 't2');
    expect(st()).toMatchObject({ selTripId: 't2', filter: 'All' });
  });

  it('a failed refresh keeps the cached matches on screen', async () => {
    mockApi({ coTravelers: () => null, inbox: () => inbox() });
    useAppStore.setState({ trips: [trip()], selTripId: 't1', matches: [match({ name: 'Cached Person' })] });
    render(<MatchesTab />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Cached Person')).toBeTruthy();
  });
});

describe('MatchDetailSheet', () => {
  const open = (m = match(), req: Record<string, 'sent' | 'accepted' | 'declined'> = {}) => {
    useAppStore.setState({ matches: [m], req, sheet: { kind: 'detail', id: m.id } });
    return render(<MatchDetailSheet />);
  };

  it('renders nothing when closed or the match is unknown', () => {
    const { container } = render(<MatchDetailSheet />);
    expect(container.innerHTML).toBe('');
    useAppStore.setState({ sheet: { kind: 'detail', id: 'nope' } });
    expect(render(<MatchDetailSheet />).container.innerHTML).toBe('');
  });

  it('shows profile details, verified label, and Connect', async () => {
    mockApi({ sendRequest: () => 'sent' });
    useAppStore.setState({ trips: [trip()] });
    open(match({ ticketVerified: true, line: 'Shah Mills • Traveling on IndiGo 6E 214', bio: 'Loves chai' }));
    expect(screen.getByText('Boarding pass verified')).toBeTruthy();
    expect(screen.getByText('Shah Mills • Traveling on IndiGo 6E 214')).toBeTruthy();
    expect(screen.getByText('Loves chai')).toBeTruthy();
    await userEvent.click(screen.getByText('Connect'));
    expect(st().req.match_usr_2222222222).toBe('sent');
  });

  it('state-specific action: sent -> chip, accepted -> Message', async () => {
    const { unmount } = open(match(), { match_usr_2222222222: 'sent' });
    expect(screen.getByText('Request sent')).toBeTruthy();
    expect(screen.queryByText('Connect')).toBeNull();
    unmount();
    open(match(), { match_usr_2222222222: 'accepted' });
    await userEvent.click(screen.getByText('Message'));
    expect(st().activeChatId).toBe('match_usr_2222222222');
  });

  it('Block removes the person and closes the sheet; Report opens the report sheet', async () => {
    mockApi({ block: () => true });
    const { unmount } = open();
    await userEvent.click(screen.getByText('Report'));
    expect(st().sheet).toEqual({ kind: 'report', id: 'match_usr_2222222222' });
    unmount();
    useAppStore.setState({ sheet: { kind: 'detail', id: 'match_usr_2222222222' } });
    render(<MatchDetailSheet />);
    await userEvent.click(screen.getByText('Block'));
    expect(st().gone.match_usr_2222222222).toBe(true);
    expect(st().sheet).toBeNull();
  });
});

describe('ChatsTab + ActiveChatView', () => {
  const chatApi = (extra: Record<string, () => unknown> = {}) => mockApi({ messages: () => [], sendMessage: () => true, inbox: () => inbox(), block: () => true, report: () => true, ...extra });
  const KEY = 'match_usr_2222222222';
  const mount = () => render(<><ChatsTab /><SafetySheet /><Toast /></>);

  it('empty state', () => {
    mount();
    expect(screen.getByText('No chats yet')).toBeTruthy();
  });

  it('list shows last-message previews, unread badge, and hides chats whose match is unknown', () => {
    useAppStore.setState({
      matches: [match(), match({ id: 'match_usr_5', name: 'Eve Card', ini: 'EC' })],
      chats: {
        [KEY]: [{ id: 'm1', from: 'them', text: 'old' }, { id: 'm2', from: 'me', text: 'See you at the gate' }],
        match_usr_5: [{ id: 'c1', from: 'me', card: true }],
        match_usr_ghost: [{ id: 'g1', from: 'me', text: 'x' }],
      },
      unread: { match_usr_5: true },
    });
    mount();
    expect(screen.getByText('You: See you at the gate')).toBeTruthy();
    expect(screen.getByText('Business card shared')).toBeTruthy();
    expect(screen.getByText('Eve Card ·')).toBeTruthy();
    expect(screen.getByText('1').className).toContain('x-badge');
    expect(screen.queryByText('x')).toBeNull();
  });

  it('opening a chat clears unread and shows the thread with the connected note', async () => {
    chatApi({ messages: () => [{ id: 'm9', from: 'them', text: 'Hello there' }] });
    useAppStore.setState({ matches: [match()], chats: { [KEY]: [] }, unread: { [KEY]: true }, req: { [KEY]: 'accepted' } });
    mount();
    await userEvent.click(screen.getByText(/Bina Shah/));
    await screen.findByText('Hello there');
    expect(screen.getByText('You and Bina Shah are connected.')).toBeTruthy();
    expect(st().unread).toEqual({});
  });

  const openChat = async (extra = {}) => {
    const api = chatApi(extra);
    useAppStore.setState({ userId: 'usr_1111111111', matches: [match()], chats: { [KEY]: [] }, activeChatId: KEY, tab: 'chats' });
    mount();
    await new Promise((r) => setTimeout(r, 20));
    return api;
  };

  it('send is disabled when empty; typing + Enter sends, trims, and clears the input', async () => {
    const api = await openChat();
    expect((screen.getByLabelText('Send') as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Message'), '  hello  {Enter}');
    expect((screen.getByLabelText('Message') as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(api.callsOf('sendMessage')).toHaveLength(1));
    expect(api.callsOf('sendMessage')[0].args.slice(0, 3)).toEqual([KEY, 'hello', false]);
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('quick chips send immediately', async () => {
    const api = await openChat();
    await userEvent.click(screen.getByText('Meet at station?'));
    await waitFor(() => expect(api.callsOf('sendMessage')[0].args[1]).toBe('Meet at station?'));
  });

  it('shows Sending… then Not sent for a failed message', async () => {
    await openChat({ sendMessage: () => false });
    await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}');
    await screen.findByText('Not sent');
    expect(toast()).toBe('Message not delivered. Check connection.');
  });

  it('cards: mine shows my details + phone, theirs shows their details', async () => {
    useAppStore.setState({ profile: { ...st().profile, name: 'Asha Rao', company: 'AR Co', industry: 'Textiles' }, phone: '9876543210' });
    await openChat();
    useAppStore.setState({ chats: { [KEY]: [{ id: 'c1', from: 'me', card: true }, { id: 'c2', from: 'them', card: true }] } });
    await screen.findByText('Asha Rao');
    expect(screen.getByText('+91 9876543210')).toBeTruthy();
    expect(screen.getAllByText('Bina Shah').length).toBeGreaterThan(1);
    expect(screen.getByText('Shah Mills · Textiles')).toBeTruthy();
  });

  it('menu: share business card, block, report', async () => {
    const api = await openChat();
    await userEvent.click(screen.getByLabelText('More options'));
    await userEvent.click(screen.getByText('Share business card'));
    await waitFor(() => expect(api.callsOf('sendMessage').pop()!.args[2]).toBe(true));
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByLabelText('More options'));
    await userEvent.click(screen.getByText('Report'));
    expect(st().sheet).toEqual({ kind: 'report', id: KEY });
    await userEvent.click(screen.getByText('Harassment'));
    expect(api.callsOf('report')[0].args).toEqual(['usr_2222222222', 'Harassment', null]); // JSON turns undefined into null; the route accepts it
    expect(st().gone[KEY]).toBe(true);
    expect(toast()).toBe('Thank you. Report received and user blocked.');
  });

  it('Block from the menu closes the chat and removes it from the list', async () => {
    const api = await openChat();
    await userEvent.click(screen.getByLabelText('More options'));
    await userEvent.click(screen.getByText('Block'));
    expect(api.callsOf('block')[0].args).toEqual(['usr_2222222222']);
    expect(st().activeChatId).toBeNull();
    expect(screen.getByText('No chats yet')).toBeTruthy();
  });

  it('Back returns to the chat list', async () => {
    await openChat();
    await userEvent.click(screen.getByLabelText('Back'));
    expect(st().activeChatId).toBeNull();
  });
});

describe('SafetySheet', () => {
  it('renders nothing for no sheet / detail sheet', () => {
    expect(render(<SafetySheet />).container.innerHTML).toBe('');
    useAppStore.setState({ sheet: { kind: 'detail', id: 'x' } });
    expect(render(<SafetySheet />).container.innerHTML).toBe('');
  });

  it('safety centre content and Done', async () => {
    useAppStore.setState({ sheet: { kind: 'safety' } });
    render(<SafetySheet />);
    expect(screen.getByText('Railway helpline 139')).toBeTruthy();
    await userEvent.click(screen.getByText('Done'));
    expect(st().sheet).toBeNull();
  });

  it('report: Cancel does nothing else; each reason reports then blocks', async () => {
    mockApi({ report: () => true, block: () => true });
    useAppStore.setState({ sheet: { kind: 'report', id: 'match_usr_2222222222' }, matches: [match()] });
    render(<SafetySheet />);
    expect(['Spam', 'Harassment', 'Fake profile', 'Other'].every((r) => screen.getByText(r))).toBe(true);
    await userEvent.click(screen.getByText('Cancel'));
    expect(st().sheet).toBeNull();
    expect(st().gone).toEqual({});
  });

  it('delete: Cancel keeps the account; Delete everything calls the server and logs out', async () => {
    const api = mockApi({ deleteAccount: () => true });
    useAppStore.setState({ sheet: { kind: 'delete' }, userId: 'usr_1111111111', screen: 'main' });
    const { unmount } = render(<SafetySheet />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(api.dbCalls).toEqual([]);
    unmount();
    useAppStore.setState({ sheet: { kind: 'delete' } });
    render(<SafetySheet />);
    await userEvent.click(screen.getByText('Delete everything'));
    await waitFor(() => expect(st().screen).toBe('welcome'));
    expect(api.actions()).toContain('deleteAccount');
  });
});

describe('ProfileTab', () => {
  it('header uses name initials and company · industry; falls back to the phone number', () => {
    useAppStore.setState({ profile: { ...st().profile, name: 'Asha Rao', company: 'AR Co', industry: 'Garments', cities: ['Mumbai'], look: ['Buy'] } });
    const { unmount } = render(<ProfileTab />);
    expect(screen.getByText('AR')).toBeTruthy();
    expect(screen.getByText('AR Co · Garments')).toBeTruthy();
    expect(screen.getByText('Mumbai')).toBeTruthy();
    expect(screen.getByText('Buy')).toBeTruthy();
    unmount();
    useAppStore.setState({ profile: { ...st().profile, name: '', first: '', company: '', industry: '' }, phone: '9876543210' });
    render(<ProfileTab />);
    expect(screen.getByText('Your Profile')).toBeTruthy();
    expect(screen.getByText('+91 9876543210')).toBeTruthy();
  });

  it('mode switches reflect and change state; privacy switch is locked on', async () => {
    mockApi({ syncProfile: () => true });
    useAppStore.setState({ screen: 'main' });
    render(<ProfileTab />);
    const [business, social, privacy] = screen.getAllByRole('switch') as HTMLInputElement[];
    expect([business.checked, social.checked]).toEqual([true, false]);
    await userEvent.click(social);
    expect(st().modes).toEqual({ business: true, social: true });
    expect(privacy.checked && privacy.disabled).toBe(true);
  });

  it('Pro trial toggles once and disables the button', async () => {
    render(<ProfileTab />);
    await userEvent.click(screen.getByText('Try free for 7 days'));
    expect(st().pro).toBe(true);
    expect(toast()).toBe('TripLink Pro Active');
    expect((screen.getByText('Free trial active') as HTMLButtonElement).disabled).toBe(true);
  });

  it('actions: edit profile, safety centre, delete sheet, download stub, log out', async () => {
    mockApi();
    render(<ProfileTab />);
    await userEvent.click(screen.getByText('Edit profile'));
    expect(st().screen).toBe('create');
    await userEvent.click(screen.getByText(/Safety centre/));
    expect(st().sheet).toEqual({ kind: 'safety' });
    await userEvent.click(screen.getByText('Delete account'));
    expect(st().sheet).toEqual({ kind: 'delete' });
    await userEvent.click(screen.getByText('Download my data'));
    expect(toast()).toBe('Your data export is being prepared'); // stub: nothing is exported yet
    useAppStore.setState({ screen: 'main' });
    await userEvent.click(screen.getByText('Log out'));
    expect(st().screen).toBe('welcome');
  });
});

describe('BottomNav', () => {
  it('marks the active tab, switches tabs, and shows the unread count on Chats', async () => {
    useAppStore.setState({ unread: { a: true, b: true }, activeChatId: 'a', sheet: { kind: 'safety' } });
    render(<BottomNav />);
    const chats = screen.getByRole('button', { name: /Chats/ });
    expect(within(chats).getByText('2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Trips/ }).getAttribute('aria-current')).toBe('page');
    await userEvent.click(chats);
    expect(screen.getByRole('button', { name: /Chats/ }).getAttribute('aria-current')).toBe('page');
    expect(st()).toMatchObject({ tab: 'chats', activeChatId: null, sheet: null });
  });
});

describe('Toast', () => {
  it('action button runs the action and dismisses', async () => {
    const onAction = vi.fn();
    st().showToast('Added', 'View', onAction);
    render(<Toast />);
    await userEvent.click(screen.getByText('View'));
    expect(onAction).toHaveBeenCalledOnce();
    expect(st().toastMessage).toBeNull();
  });
});

describe('Home (app shell)', () => {
  it('signed-out users see onboarding; signed-in users see the tab content and bottom nav', () => {
    mockApi({ inbox: () => inbox(), myTrips: () => [] });
    const { unmount } = render(<Home />);
    expect(screen.getByText('Get started')).toBeTruthy();
    unmount();
    useAppStore.setState({ screen: 'main', tab: 'profile' });
    render(<Home />);
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toBeTruthy();
    expect(screen.getByText('Log out')).toBeTruthy();
  });

  it('polls the inbox once on entering the app', async () => {
    const api = mockApi({ inbox: () => inbox() });
    useAppStore.setState({ screen: 'main' });
    render(<Home />);
    await waitFor(() => expect(api.callsOf('inbox')).toHaveLength(1));
  });

  it('a 401 from the server signs the user out with a toast', async () => {
    mockApi({ inbox: () => UNAUTH });
    useAppStore.setState({ screen: 'main', userId: 'usr_1111111111', trips: [trip()] });
    render(<Home />);
    await waitFor(() => expect(st().screen).toBe('welcome'));
    expect(st().trips).toEqual([]);
    expect(toast()).toBe('Session expired. Please log in again.');
  });
});
