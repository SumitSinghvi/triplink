import { TravelClass, BerthPreference } from '@/types';

export interface DecodedPNRResult {
  pnr: string;
  maskedPnr: string;
  trainNumber: string;
  trainName: string;
  travelDate: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  travelClass: TravelClass;
  coach: string;
  berthType: BerthPreference;
  berthNumber: number;
  status: 'CONFIRMED' | 'RAC' | 'WL';
  chartPrepared: boolean;
}

export function validatePNR(pnr: string): boolean {
  const clean = pnr.replace(/[\s-]/g, '');
  return /^[1-9]\d{9}$/.test(clean);
}

export function maskPNR(pnr: string): string {
  const clean = pnr.replace(/[\s-]/g, '');
  if (clean.length !== 10) return '******';
  return `${clean.slice(0, 2)}******${clean.slice(8)}`;
}
