// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/store/useAppStore';
import { WelcomeScreen } from '@/features/onboarding/WelcomeScreen';
import { PhoneScreen } from '@/features/onboarding/PhoneScreen';
import { OtpScreen } from '@/features/onboarding/OtpScreen';
import { ModeSelectionScreen } from '@/features/onboarding/ModeSelectionScreen';
import { ProfileSetupScreen } from '@/features/onboarding/ProfileSetupScreen';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { mockApi } from '../helpers/api';

const st = () => useAppStore.getState();
const toast = () => st().toastMessage?.text;

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('OnboardingFlow routing', () => {
  it.each([
    ['welcome', /Get started/],
    ['phone', /Send OTP/],
    ['otp', /Verify/],
    ['mode', /How do you travel/],
    ['create', /Create profile/],
  ] as const)('screen "%s" renders its view', (screenName, text) => {
    useAppStore.setState({ screen: screenName });
    render(<OnboardingFlow />);
    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe('WelcomeScreen', () => {
  it('Get started goes to phone entry', async () => {
    render(<WelcomeScreen />);
    await userEvent.click(screen.getByText('Get started'));
    expect(st().screen).toBe('phone');
  });
});

describe('PhoneScreen', () => {
  it('keeps digits only and caps at 10', async () => {
    render(<PhoneScreen />);
    await userEvent.type(screen.getByLabelText('Phone number'), '98a76-54 32109999');
    expect(st().phone).toBe('9876543210');
  });

  it('short number: toast, no request', async () => {
    const api = mockApi();
    useAppStore.setState({ phone: '12345' });
    render(<PhoneScreen />);
    await userEvent.click(screen.getByText('Send OTP'));
    expect(toast()).toBe('Enter a valid 10-digit mobile number');
    expect(api.spy).not.toHaveBeenCalled();
    expect(st().screen).not.toBe('otp');
  });

  it('success posts the phone, shows the server message, moves to OTP; Enter also submits', async () => {
    const api = mockApi({}, { '/api/auth/send-otp': () => ({ success: true, message: 'Demo mode: enter code 1234' }) });
    useAppStore.setState({ phone: '9876543210' });
    render(<PhoneScreen />);
    await userEvent.type(screen.getByLabelText('Phone number'), '{Enter}');
    await waitFor(() => expect(st().screen).toBe('otp'));
    expect(JSON.parse(api.spy.mock.calls[0][1]!.body as string)).toEqual({ phone: '9876543210' });
    expect(toast()).toBe('Demo mode: enter code 1234');
  });

  it('server refusal and network failure show a toast and stay on the screen', async () => {
    mockApi({}, { '/api/auth/send-otp': () => ({ success: false, error: 'Could not send SMS.' }) });
    useAppStore.setState({ phone: '9876543210', screen: 'phone' });
    render(<PhoneScreen />);
    await userEvent.click(screen.getByText('Send OTP'));
    await waitFor(() => expect(toast()).toBe('Could not send SMS.'));
    expect(st().screen).toBe('phone');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await userEvent.click(screen.getByText('Send OTP'));
    await waitFor(() => expect(toast()).toBe('Network error while sending OTP'));
  });

  it('Back returns to welcome', async () => {
    render(<PhoneScreen />);
    await userEvent.click(screen.getByLabelText('Back'));
    expect(st().screen).toBe('welcome');
  });
});

describe('OtpScreen', () => {
  const boxes = () => [1, 2, 3, 4].map((i) => screen.getByLabelText(`Digit ${i}`) as HTMLInputElement);
  const values = () => boxes().map((b) => b.value);
  const verifyApi = (resp: unknown) => mockApi({}, { '/api/auth/verify-otp': () => resp, '/api/auth/send-otp': () => ({ success: true }) });
  // keyboard() follows focus (user.type would keep targeting the first box).
  const typeCode = async (code = '1234') => {
    await userEvent.click(boxes()[0]);
    await userEvent.keyboard(code);
  };

  beforeEach(() => useAppStore.setState({ phone: '9876543210', screen: 'otp' }));
  // OtpScreen focuses box 1 from a 50ms mount timer; let it fire so it cannot steal focus mid-typing.
  const mountOtp = async () => {
    render(<OtpScreen />);
    await new Promise((r) => setTimeout(r, 80));
  };

  it('typing a digit moves focus to the next box', async () => {
    await mountOtp();
    await typeCode();
    expect(values()).toEqual(['1', '2', '3', '4']);
    expect(document.activeElement).toBe(boxes()[3]);
  });

  it('backspace on an empty box goes to the previous one', async () => {
    await mountOtp();
    await typeCode('12');
    await userEvent.keyboard('{Backspace}'); // box 3 is empty -> focus goes back to box 2
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it('typing over a filled box keeps the new digit', async () => {
    await mountOtp();
    await typeCode('12');
    await userEvent.click(boxes()[0]);
    await userEvent.keyboard('9');
    expect(values().slice(0, 2)).toEqual(['9', '2']);
  });

  it('paste spreads digits and ignores non-digits', async () => {
    await mountOtp();
    await userEvent.click(boxes()[0]);
    await userEvent.paste('12 34');
    expect(values()).toEqual(['1', '2', '3', '4']);
  });

  it('autofill of the whole code into one box spreads across the boxes', async () => {
    await mountOtp();
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(boxes()[0], { target: { value: '4821' } });
    expect(values()).toEqual(['4', '8', '2', '1']);
  });

  it('demo button (dev only) fills 1234', async () => {
    await mountOtp();
    await userEvent.click(screen.getByText('Demo code (1234)'));
    expect(values()).toEqual(['1', '2', '3', '4']);
  });

  it('refuses fewer than 4 digits', async () => {
    const api = verifyApi({ success: true });
    await mountOtp();
    await typeCode('12');
    await userEvent.click(screen.getByText('Verify'));
    expect(toast()).toBe('Enter the 4-digit code');
    expect(api.spy).not.toHaveBeenCalled();
  });

  it('new user -> mode screen, logged in as the returned id with a blank profile', async () => {
    const api = verifyApi({ success: true, userId: 'usr_9876543210', profile: null });
    mockApi({ myTrips: () => [] }, { '/api/auth/verify-otp': () => ({ success: true, userId: 'usr_9876543210', profile: null }) });
    void api;
    await mountOtp();
    await typeCode();
    await userEvent.click(screen.getByText('Verify'));
    await waitFor(() => expect(st().screen).toBe('mode'));
    expect(st().userId).toBe('usr_9876543210');
  });

  it('returning user -> main with profile and saved modes; null mode flags default to business-only', async () => {
    mockApi({ myTrips: () => [] }, {
      '/api/auth/verify-otp': () => ({
        success: true, userId: 'usr_9876543210',
        profile: { name: 'Asha Rao', company: 'AR Textiles', industry: 'Garments', intent: 'Buy', cities: ['Mumbai'], first_name: 'Asha', interests: ['Food'], langs: ['Hindi'], mode_business: null, mode_social: null },
      }),
    });
    await mountOtp();
    await typeCode();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(st().screen).toBe('main'));
    expect(st().profile).toMatchObject({ name: 'Asha Rao', company: 'AR Textiles', industry: 'Garments', look: ['Buy'], cities: ['Mumbai'], first: 'Asha' });
    expect(st().modes).toEqual({ business: true, social: false });
  });

  it('returning user with social mode on keeps it', async () => {
    mockApi({ myTrips: () => [] }, { '/api/auth/verify-otp': () => ({ success: true, userId: 'usr_9876543210', profile: { name: 'A', mode_business: false, mode_social: true } }) });
    await mountOtp();
    await typeCode();
    await userEvent.click(screen.getByText('Verify'));
    await waitFor(() => expect(st().modes).toEqual({ business: false, social: true }));
  });

  it('wrong code: shows the server reason and stays', async () => {
    verifyApi({ success: false, error: 'Incorrect OTP' });
    await mountOtp();
    await typeCode('9999');
    await userEvent.click(screen.getByText('Verify'));
    await waitFor(() => expect(toast()).toBe('Incorrect OTP'));
    expect(st().screen).toBe('otp');
  });

  it('network failure toast; button re-enabled afterwards', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await mountOtp();
    await typeCode();
    await userEvent.click(screen.getByText('Verify'));
    await waitFor(() => expect(toast()).toBe('Verification failed. Check your connection.'));
    expect((screen.getByText('Verify') as HTMLButtonElement).disabled).toBe(false);
  });

  it('resend: success and failure toasts; the same phone is sent', async () => {
    const api = mockApi({}, { '/api/auth/send-otp': () => ({ success: true }) });
    await mountOtp();
    await userEvent.click(screen.getByText('Resend code'));
    await waitFor(() => expect(toast()).toBe('New OTP sent via SMS'));
    expect(JSON.parse(api.spy.mock.calls[0][1]!.body as string)).toEqual({ phone: '9876543210' });
    vi.restoreAllMocks();
    mockApi({}, { '/api/auth/send-otp': () => ({ success: false, error: 'Slow down' }) });
    await userEvent.click(screen.getByText('Resend code'));
    await waitFor(() => expect(toast()).toBe('Slow down'));
  });

  it('Back returns to phone entry', async () => {
    await mountOtp();
    await userEvent.click(screen.getByLabelText('Back'));
    expect(st().screen).toBe('phone');
  });
});

describe('ModeSelectionScreen', () => {
  it('toggles modes; Continue is disabled when none is selected', async () => {
    render(<ModeSelectionScreen />);
    const cont = screen.getByText('Continue') as HTMLButtonElement;
    expect(cont.disabled).toBe(false); // business on by default
    await userEvent.click(screen.getByText('Business'));
    expect(st().modes).toEqual({ business: false, social: false });
    expect(cont.disabled).toBe(true);
    await userEvent.click(screen.getByText('Social'));
    expect(cont.disabled).toBe(false);
    await userEvent.click(cont);
    expect(st().screen).toBe('create');
  });

  it('new users have no Back; users with a profile can go back to the app', async () => {
    const { unmount } = render(<ModeSelectionScreen />);
    expect(screen.queryByLabelText('Back')).toBeNull();
    unmount();
    useAppStore.setState({ profile: { ...st().profile, name: 'Asha' } });
    render(<ModeSelectionScreen />);
    await userEvent.click(screen.getByLabelText('Back'));
    expect(st().screen).toBe('main');
  });
});

describe('ProfileSetupScreen', () => {
  it('shows only the sections for the selected modes', () => {
    useAppStore.setState({ modes: { business: true, social: false } });
    const { unmount } = render(<ProfileSetupScreen />);
    expect(screen.getByText('Full Name')).toBeTruthy();
    expect(screen.queryByText('First name')).toBeNull();
    unmount();
    useAppStore.setState({ modes: { business: false, social: true } });
    render(<ProfileSetupScreen />);
    expect(screen.queryByText('Full Name')).toBeNull();
    expect(screen.getByText('First name')).toBeTruthy();
  });

  it('text fields and chips write into the profile; chips toggle off again', async () => {
    useAppStore.setState({ modes: { business: true, social: true } });
    render(<ProfileSetupScreen />);
    await userEvent.type(screen.getByPlaceholderText('e.g. Rahul Sharma'), 'Asha Rao');
    await userEvent.type(screen.getByPlaceholderText('e.g. Sharma Textiles'), 'AR');
    await userEvent.click(screen.getByText('Garments'));
    await userEvent.click(screen.getByText('Buy'));
    await userEvent.click(screen.getByText('Cricket'));
    await userEvent.click(screen.getByText('Hindi'));
    expect(st().profile).toMatchObject({ name: 'Asha Rao', company: 'AR', industry: 'Garments', look: ['Sell', 'Buy'], interests: ['Cricket'], langs: ['Hindi'] });
    await userEvent.click(screen.getByText('Cricket'));
    await userEvent.click(screen.getByText('Sell'));
    expect(st().profile.interests).toEqual([]);
    expect(st().profile.look).toEqual(['Buy']);
    expect(screen.getByText('Garments').getAttribute('aria-pressed')).toBe('true');
  });

  it('Save syncs and enters the app', async () => {
    const api = mockApi({ syncProfile: () => true });
    useAppStore.setState({ screen: 'create' });
    render(<ProfileSetupScreen />);
    await userEvent.click(screen.getByText('Save'));
    expect(st().screen).toBe('main');
    await waitFor(() => expect(api.callsOf('syncProfile')).toHaveLength(1));
  });

  it('characterization: Save is allowed with an empty name (no validation today)', async () => {
    mockApi({ syncProfile: () => true });
    render(<ProfileSetupScreen />);
    expect(st().profile.name).toBe('');
    await userEvent.click(screen.getByText('Save'));
    expect(st().screen).toBe('main');
  });

  it('Back returns to mode selection', async () => {
    render(<ProfileSetupScreen />);
    await userEvent.click(screen.getByLabelText('Back'));
    expect(st().screen).toBe('mode');
  });
});
