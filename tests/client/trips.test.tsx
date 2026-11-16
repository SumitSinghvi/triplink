// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { AddTripSheet } from '@/features/trips/AddTripSheet';
import { TripsTab } from '@/features/trips/TripsTab';
import { todayIso } from '@/lib/travelDate';
import { readBoardingPassBarcode } from '@/lib/boardingPassScan';
import { mockApi } from '../helpers/api';
import { bcbp } from '../helpers/dbHarness';
import type { TripData } from '@/types';

vi.mock('@/lib/boardingPassScan', () => ({ readBoardingPassBarcode: vi.fn() }));
const scan = vi.mocked(readBoardingPassBarcode);

const st = () => useAppStore.getState();
const toast = () => st().toastMessage?.text;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  scan.mockReset();
});

const pnrData = {
  trainName: 'Tejas Rajdhani Express', trainNumber: '12951', fromName: 'New Delhi', toName: 'Mumbai Central', fromCode: 'NDLS',
  toCode: 'MMCT', travelDate: '2026-11-20', coach: 'B4', berthNumber: 42, berthType: 'Side Lower', maskedPnr: '28******51',
};
const flightData = {
  airlineName: 'IndiGo', flightNumber: '6E 214', travelDate: '2026-11-20', fromCode: 'AMD', toCode: 'BOM', fromCity: 'Ahmedabad',
  toCity: 'Mumbai', fromTerminal: 'T1', departureTime: '10:00', arrivalTime: '11:30', duration: '1h 30m', status: 'Expected',
};

const mountSheet = () => render(<div className="x-app"><AddTripSheet /></div>);
const upload = async (name = 'pass.png') => {
  const input = screen.getByText('Photos').querySelector('input') as HTMLInputElement;
  await userEvent.upload(input, new File(['x'], name, { type: 'image/png' }));
};

describe('AddTripSheet: train by PNR', () => {
  it('renders nothing while closed', () => {
    const { container } = mountSheet();
    expect(container.querySelector('.x-sheet')).toBeNull();
  });

  it('rejects a PNR that is not 10 digits, without calling the API', async () => {
    const api = mockApi();
    st().openAddTrip();
    mountSheet();
    await userEvent.type(screen.getByPlaceholderText('e.g. 8655220078'), '12345');
    await userEvent.click(screen.getByText('Fetch trip'));
    expect(screen.getByText('Enter the 10-digit PNR from your ticket')).toBeTruthy();
    expect(api.spy).not.toHaveBeenCalled();
  });

  it('PNR input accepts digits only; demo chips fill it', async () => {
    st().openAddTrip();
    mountSheet();
    await userEvent.type(screen.getByPlaceholderText('e.g. 8655220078'), '12ab-34');
    expect(st().add!.pnr).toBe('1234');
    await userEvent.click(screen.getByText(/^2849102451/));
    expect(st().add!.pnr).toBe('2849102451');
  });

  it('found: shows the trip, then Continue -> visibility -> Confirm adds it', async () => {
    const api = mockApi({ syncProfile: () => true, syncTrip: () => true, coTravelers: () => [] }, { '/api/pnr/verify': () => ({ success: true, data: pnrData }) });
    st().openAddTrip();
    mountSheet();
    await userEvent.click(screen.getByText(/^2849102451/));
    await userEvent.click(screen.getByText('Fetch trip'));
    await screen.findByText('Tejas Rajdhani Express (12951)');
    expect(screen.getByText('Trip found')).toBeTruthy();
    expect(screen.getByText('B4').tagName).toBe('B');
    expect(JSON.parse(api.spy.mock.calls[0][1]!.body as string)).toEqual({ pnr: '2849102451' });
    expect(st().add!.found).toMatchObject({ berth: 'Berth 42 (Side Lower)', pnrMasked: '28******51', coach: 'B4' });

    await userEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Who can see you on this trip')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Show me 2 hours before departure only'));
    await userEvent.click(screen.getByLabelText('Visible to Social matches'));
    await userEvent.click(screen.getByText('Confirm'));
    expect(st().add).toBeNull();
    expect(st().trips[0]).toMatchObject({ name: 'Tejas Rajdhani Express (12951)', kind: 'train', vis: { business: true, social: true, twoh: true } });
    await waitFor(() => expect(api.callsOf('syncTrip')).toHaveLength(1));
  });

  it('step 2 Back returns to step 1 with the found trip kept', async () => {
    st().openAddTrip();
    st().updateAddTrip({ step: 2, found: { kind: 'train', name: 'X (12951)', route: 'A → B', when: '2026-11-20', travelDate: '2026-11-20' } });
    mountSheet();
    await userEvent.click(screen.getByLabelText('Back'));
    expect(st().add!.step).toBe(1);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('not found shows the reason; network failure shows a connection message', async () => {
    mockApi({}, { '/api/pnr/verify': () => json({ success: false, error: 'PNR not found', reason: 'flushed' }, 404) });
    st().openAddTrip();
    st().updateAddTrip({ pnr: '1234567890' });
    mountSheet();
    await userEvent.click(screen.getByText('Fetch trip'));
    await screen.findByText('Not found: PNR not found');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await userEvent.click(screen.getByText('Fetch trip'));
    await screen.findByText('Verification failed. Check network connection.');
  });

  it('editing the PNR clears a previous result', async () => {
    st().openAddTrip();
    st().updateAddTrip({ pnr: '1234567890', err: 'old', found: { kind: 'train', name: 'X', route: 'A → B', when: 'w', travelDate: '2026-11-20' } });
    mountSheet();
    await userEvent.type(screen.getByPlaceholderText('e.g. 8655220078'), '{Backspace}');
    expect(st().add).toMatchObject({ found: null, err: '' });
  });

  it('Close and the scrim dismiss the sheet', async () => {
    st().openAddTrip();
    const { container } = mountSheet();
    await userEvent.click(container.querySelector('.x-scrim')!);
    expect(st().add).toBeNull();
  });
});

describe('AddTripSheet: flight', () => {
  const openFlight = (over = {}) => {
    st().openAddTrip();
    st().updateAddTrip({ kind: 'flight', date: '2026-11-20', ...over });
  };

  it('Train/Flight toggle swaps the form and resets result/error', async () => {
    st().openAddTrip();
    st().updateAddTrip({ err: 'stale' });
    mountSheet();
    await userEvent.click(screen.getByText('Flight'));
    expect(screen.getByPlaceholderText(/6E 214, AI 887/)).toBeTruthy();
    expect(st().add).toMatchObject({ kind: 'flight', err: '', found: null });
    await userEvent.click(screen.getByText('Train'));
    expect(screen.getByText('PNR (10 digits)')).toBeTruthy();
  });

  it('requires a flight number', async () => {
    const api = mockApi();
    openFlight();
    mountSheet();
    await userEvent.click(screen.getByText('Find flight'));
    expect(screen.getByText('Enter a flight number (e.g. 6E 214 or AI 887)')).toBeTruthy();
    expect(api.spy).not.toHaveBeenCalled();
  });

  it('lookup success: details shown, route and departure kept for visibility rules', async () => {
    const api = mockApi({}, { '/api/flights/verify': () => ({ success: true, data: flightData }) });
    openFlight({ flight: '6E 214' });
    mountSheet();
    await userEvent.click(screen.getByText('Find flight'));
    await screen.findByText('IndiGo 6E 214');
    expect(JSON.parse(api.spy.mock.calls[0][1]!.body as string)).toEqual({ flightNumber: '6E 214', date: '2026-11-20' });
    expect(st().add!.found).toMatchObject({
      route: 'Ahmedabad (AMD) (T1) → Mumbai (BOM)', fromCode: 'AMD', toCode: 'BOM', departsAt: '2026-11-20T10:00:00+05:30', flightStatus: 'Expected',
    });
    expect(screen.getByText('Trip found')).toBeTruthy();
  });

  it('unknown flight (404) opens manual entry with a hint, then validates and adds by hand', async () => {
    mockApi({}, { '/api/flights/verify': () => json({ success: false, error: 'nope' }, 404) });
    openFlight({ flight: '6E 214' });
    mountSheet();
    await userEvent.click(screen.getByText('Find flight'));
    await screen.findByText(/couldn't look this flight up/);
    expect(st().add!.manual).toBe(true);

    await userEvent.click(screen.getByText('Add flight'));
    expect(screen.getByText('Enter both 3-letter airport codes, e.g. AMD and BOM')).toBeTruthy();
    await userEvent.type(screen.getByPlaceholderText('AMD'), 'a1m2d');
    await userEvent.type(screen.getByPlaceholderText('BOM'), 'amd');
    await userEvent.click(screen.getByText('Add flight'));
    expect(screen.getByText('Enter both 3-letter airport codes, e.g. AMD and BOM')).toBeTruthy(); // from === to
    await userEvent.clear(screen.getByPlaceholderText('BOM'));
    await userEvent.type(screen.getByPlaceholderText('BOM'), 'bom');
    await userEvent.click(screen.getByText('Add flight'));
    expect(st().add!.found).toMatchObject({ name: 'Flight 6E 214', route: 'AMD → BOM', fromCode: 'AMD', toCode: 'BOM', travelDate: '2026-11-20' });
    expect(screen.getByText(/Added manually/)).toBeTruthy();
  });

  it('manual flight number must look like a flight', async () => {
    mockApi({}, { '/api/flights/verify': () => json({ success: false }, 404) });
    openFlight({ flight: 'hello world' });
    mountSheet();
    await userEvent.click(screen.getByText('Find flight'));
    await screen.findByText('Add flight');
    await userEvent.click(screen.getByText('Add flight'));
    expect(screen.getByText('Enter a flight number like 6E 214')).toBeTruthy();
  });

  it('other lookup failures show the server error and do NOT open manual entry', async () => {
    mockApi({}, { '/api/flights/verify': () => json({ success: false, error: 'Invalid flight number format.' }, 400) });
    openFlight({ flight: 'zzz' });
    mountSheet();
    await userEvent.click(screen.getByText('Find flight'));
    await screen.findByText('Invalid flight number format.');
    expect(st().add!.manual).toBe(false);
  });

  it('network failure message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    openFlight({ flight: '6E 214' });
    mountSheet();
    await userEvent.click(screen.getByText('Find flight'));
    await screen.findByText('Flight verification failed. Check network connection.');
  });

  it('changing the date or number discards a previous result', async () => {
    openFlight({ flight: '6E 214', found: { kind: 'flight', name: 'X', route: 'A → B', when: 'w', travelDate: '2026-11-20' } });
    mountSheet();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-21' } });
    expect(st().add).toMatchObject({ date: '2026-11-21', found: null });
  });
});

describe('AddTripSheet: boarding-pass scan', () => {
  const dayOfYear = (iso: string) => Math.round((Date.parse(iso) - Date.parse(`${iso.slice(0, 4)}-01-01`)) / 86400000) + 1;
  const pass = (over = {}) => bcbp({ carrier: '6E', flight: '214', julian: dayOfYear(todayIso()), ...over });

  const startScan = async () => {
    st().openAddTrip();
    st().updateAddTrip({ kind: 'flight' });
    mountSheet();
    await userEvent.click(screen.getByText('Scan boarding pass'));
    await upload();
  };

  it('valid pass becomes a verified trip using the pass route when the lookup is unavailable', async () => {
    const raw = pass();
    scan.mockResolvedValue(raw);
    mockApi({}, { '/api/flights/verify': () => json({ success: false }, 404) });
    await startScan();
    await screen.findByText('Boarding pass verified');
    expect(st().add!.found).toMatchObject({
      name: 'Flight 6E 214', route: 'AMD → BOM', fromCode: 'AMD', toCode: 'BOM', travelDate: todayIso(), ticketVerified: true, boardingPass: raw,
    });
  });

  it('uses lookup details only when the airports agree with the pass', async () => {
    scan.mockResolvedValue(pass());
    mockApi({}, { '/api/flights/verify': () => ({ success: true, data: { ...flightData, travelDate: todayIso() } }) });
    await startScan();
    await screen.findByText('Boarding pass verified');
    expect(st().add!.found).toMatchObject({ name: 'IndiGo 6E 214', departsAt: `${todayIso()}T10:00:00+05:30`, ticketVerified: true });
  });

  it('ignores a lookup that disagrees with the pass route', async () => {
    scan.mockResolvedValue(pass());
    mockApi({}, { '/api/flights/verify': () => ({ success: true, data: { ...flightData, toCode: 'DEL', travelDate: todayIso() } }) });
    await startScan();
    await screen.findByText('Boarding pass verified');
    expect(st().add!.found).toMatchObject({ route: 'AMD → BOM', toCode: 'BOM' });
  });

  it('no barcode / unreadable image show clear errors', async () => {
    scan.mockResolvedValue(null);
    await startScan();
    await screen.findByText(/No boarding-pass barcode found/);
    expect(st().add!.loading).toBe(false);

    scan.mockRejectedValue(new Error('decode'));
    await userEvent.click(screen.getByText('Scan boarding pass'));
    await upload();
    await screen.findByText('Could not read that image. Try another photo or screenshot.');
  });

  it('non-boarding-pass barcode text is rejected', async () => {
    scan.mockResolvedValue('https://example.com/not-a-pass');
    await startScan();
    await screen.findByText(/No boarding-pass barcode found/);
  });

  it('the picker sheet offers Camera and Photos, and a file can be picked again', async () => {
    scan.mockResolvedValue(null);
    st().openAddTrip();
    st().updateAddTrip({ kind: 'flight' });
    mountSheet();
    await userEvent.click(screen.getByText('Scan boarding pass'));
    const sheet = screen.getByText('Boarding pass').closest('.x-sheet') as HTMLElement;
    expect(within(sheet).getByText('Camera').querySelector('input')!.getAttribute('capture')).toBe('environment');
    expect(within(sheet).getByText('Photos').querySelector('input')!.hasAttribute('capture')).toBe(false);
  });
});

describe('TripsTab', () => {
  const trip = (over: Partial<TripData> = {}): TripData => ({
    id: 't1', kind: 'flight', name: 'IndiGo 6E 214', route: 'AMD → BOM', when: '2099-01-01', travelDate: '2099-01-01',
    vis: { business: true, social: false, twoh: false }, ...over,
  });
  const setTrips = (...t: TripData[]) => useAppStore.setState({ trips: t });

  it('empty state and Add trip buttons open the sheet', async () => {
    render(<TripsTab />);
    expect(screen.getByText('No upcoming trips')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Add trip'));
    expect(st().add).not.toBeNull();
  });

  it('splits upcoming and past, with visibility and status pills', () => {
    setTrips(
      trip(),
      trip({ id: 't2', name: 'Tejas (12951)', kind: 'train', vis: { business: true, social: true, twoh: true }, ticketVerified: true }),
      trip({ id: 't3', name: 'Old 6E 111', travelDate: '2000-01-01', when: '2000-01-01', vis: { business: false, social: false, twoh: false } }),
      trip({ id: 't4', name: 'Gone AI 887', flightStatus: 'Canceled' }),
      trip({ id: 't5', name: 'Late SG 100', flightStatus: 'Delayed' })
    );
    render(<TripsTab />);
    const headings = screen.getAllByText(/^(Upcoming|Past)$/).map((e) => e.textContent);
    expect(headings).toEqual(['Upcoming', 'Past']);
    expect(screen.getAllByText('Visible: Business')).toHaveLength(3);
    expect(screen.getByText('Visible: Business, Social')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByText('2 h before only')).toBeTruthy();
    expect(screen.getByText('Ticket verified')).toBeTruthy();
    expect(screen.getByText('Flight cancelled')).toBeTruthy();
    expect(screen.getByText('Delayed')).toBeTruthy();
  });

  it('shows the live match count per trip, excluding blocked people', () => {
    setTrips(trip());
    useAppStore.setState({
      matches: [
        { id: 'match_a', tripId: 't1', type: 'Business', name: 'A', company: '', industry: '', ini: 'A' },
        { id: 'match_b', tripId: 't1', type: 'Business', name: 'B', company: '', industry: '', ini: 'B' },
      ],
      gone: { match_b: true },
    });
    render(<TripsTab />);
    expect(screen.getByText(/^1 matches/)).toBeTruthy();
  });

  it('tapping a trip opens its matches', async () => {
    setTrips(trip());
    render(<TripsTab />);
    await userEvent.click(screen.getByText('IndiGo 6E 214'));
    expect(st()).toMatchObject({ tab: 'matches', selTripId: 't1' });
  });

  it('verify-with-pass is offered only for upcoming, unverified, non-cancelled flights', () => {
    setTrips(
      trip({ id: 'a', name: 'Fly AI 100' }),
      trip({ id: 'b', name: 'Done AI 200', ticketVerified: true }),
      trip({ id: 'c', name: 'Old AI 300', travelDate: '2000-01-01', when: '2000-01-01' }),
      trip({ id: 'd', name: 'Cancelled AI 400', flightStatus: 'Canceled' }),
      trip({ id: 'e', name: 'Train (12951)', kind: 'train' })
    );
    render(<TripsTab />);
    expect(screen.getAllByText('Verify with boarding pass')).toHaveLength(1);
  });

  describe('verify with boarding pass', () => {
    const run = async (raw: string | null) => {
      scan.mockResolvedValue(raw);
      setTrips(trip());
      render(<div className="x-app"><TripsTab /></div>);
      await userEvent.click(screen.getByText('Verify with boarding pass'));
      await upload();
    };

    it('success marks the trip verified and drops the button', async () => {
      const api = mockApi({ syncProfile: () => true, verifyTrip: () => true });
      await run(bcbp({ carrier: '6E', flight: '214', julian: 1 }));
      await waitFor(() => expect(toast()).toBe('Boarding pass verified'));
      expect(st().trips[0].ticketVerified).toBe(true);
      expect(api.actions()).toEqual(['syncProfile', 'verifyTrip']);
      expect(screen.queryByText('Verify with boarding pass')).toBeNull();
    });

    it('server says no: friendly message, trip stays unverified', async () => {
      mockApi({ syncProfile: () => true, verifyTrip: () => false });
      await run(bcbp({ carrier: '6E', flight: '214', julian: 1 }));
      await waitFor(() => expect(toast()).toBe('Could not verify this pass. Try again.'));
      expect(st().trips[0].ticketVerified).toBeUndefined();
    });

    it('pass for another flight is caught locally, without calling the server', async () => {
      const api = mockApi();
      await run(bcbp({ carrier: 'AI', flight: '887', julian: 1 }));
      await waitFor(() => expect(toast()).toBe('This pass is for AI 887, not IndiGo 6E 214 on 2099-01-01.'));
      expect(api.dbCalls).toEqual([]);
    });

    it('pass for another day is caught locally', async () => {
      const api = mockApi();
      await run(bcbp({ carrier: '6E', flight: '214', julian: 5 }));
      await waitFor(() => expect(toast()).toContain('This pass is for 6E 214'));
      expect(api.dbCalls).toEqual([]);
    });

    it('no barcode and unreadable image toasts', async () => {
      mockApi();
      await run(null);
      await waitFor(() => expect(toast()).toMatch(/No boarding-pass barcode found/));
      scan.mockRejectedValue(new Error('x'));
      await userEvent.click(screen.getByText('Verify with boarding pass'));
      await upload();
      await waitFor(() => expect(toast()).toBe('Could not read that image. Try another photo or screenshot.'));
    });
  });
});
