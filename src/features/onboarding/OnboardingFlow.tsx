'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { WelcomeScreen } from './WelcomeScreen';
import { PhoneScreen } from './PhoneScreen';
import { OtpScreen } from './OtpScreen';
import { ModeSelectionScreen } from './ModeSelectionScreen';
import { ProfileSetupScreen } from './ProfileSetupScreen';

export const OnboardingFlow: React.FC = () => {
  const screen = useAppStore((s) => s.screen);

  switch (screen) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'phone':
      return <PhoneScreen />;
    case 'otp':
      return <OtpScreen />;
    case 'mode':
      return <ModeSelectionScreen />;
    case 'create':
      return <ProfileSetupScreen />;
    default:
      return <WelcomeScreen />;
  }
};
