import { TravelClass, BerthPreference } from '@/types';

export interface DemoPresetPNR {
  pnr: string;
  trainNumber: string;
  trainName: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  travelClass: TravelClass;
  coach: string;
  berthType: BerthPreference;
  label: string;
}

export const DEMO_PRESET_PNRS: DemoPresetPNR[] = [
  {
    pnr: '2849102451',
    trainNumber: '12951',
    trainName: 'Tejas Rajdhani Express',
    fromCode: 'NDLS',
    fromName: 'New Delhi',
    toCode: 'MMCT',
    toName: 'Mumbai Central',
    travelClass: '3A',
    coach: 'B4',
    berthType: 'Side Lower',
    label: 'Delhi ➔ Mumbai (Tejas Rajdhani)',
  },
  {
    pnr: '4519803124',
    trainNumber: '22436',
    trainName: 'Vande Bharat Express',
    fromCode: 'NDLS',
    fromName: 'New Delhi',
    toCode: 'BSB',
    toName: 'Varanasi Jn',
    travelClass: 'CC',
    coach: 'C5',
    berthType: 'Window',
    label: 'Delhi ➔ Varanasi (Vande Bharat)',
  },
  {
    pnr: '8392104928',
    trainNumber: '12008',
    trainName: 'Mysuru Shatabdi Express',
    fromCode: 'SBC',
    fromName: 'KSR Bengaluru',
    toCode: 'MAS',
    toName: 'Chennai Central',
    travelClass: 'CC',
    coach: 'C2',
    berthType: 'Aisle',
    label: 'Bengaluru ➔ Chennai (Shatabdi)',
  },
];

export function getDefaultTravelDate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
