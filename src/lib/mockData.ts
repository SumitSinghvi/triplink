import { TrainInfo, TravelClass, BerthPreference } from '@/types';

export const POPULAR_TRAINS: TrainInfo[] = [
  {
    number: '12951',
    name: 'Tejas Rajdhani Express',
    fromStation: 'New Delhi',
    fromCode: 'NDLS',
    toStation: 'Mumbai Central',
    toCode: 'MMCT',
    departureTime: '16:55',
    arrivalTime: '08:35 (+1)',
    duration: '15h 40m',
  },
  {
    number: '22436',
    name: 'Vande Bharat Express',
    fromStation: 'New Delhi',
    fromCode: 'NDLS',
    toStation: 'Varanasi Junction',
    toCode: 'BSB',
    departureTime: '06:00',
    arrivalTime: '14:00',
    duration: '8h 00m',
  },
  {
    number: '12004',
    name: 'Lucknow Shatabdi Express',
    fromStation: 'New Delhi',
    fromCode: 'NDLS',
    toStation: 'Lucknow Junction',
    toCode: 'LJN',
    departureTime: '06:10',
    arrivalTime: '12:45',
    duration: '6h 35m',
  },
  {
    number: '12008',
    name: 'Mysuru Shatabdi Express',
    fromStation: 'KSR Bengaluru',
    fromCode: 'SBC',
    toStation: 'MGR Chennai Central',
    toCode: 'MAS',
    departureTime: '14:15',
    arrivalTime: '21:30',
    duration: '7h 15m',
  },
  {
    number: '12301',
    name: 'Howrah Rajdhani Express',
    fromStation: 'Howrah Junction',
    fromCode: 'HWH',
    toStation: 'New Delhi',
    toCode: 'NDLS',
    departureTime: '16:50',
    arrivalTime: '10:05 (+1)',
    duration: '17h 15m',
  },
  {
    number: '20901',
    name: 'Vande Bharat Express',
    fromStation: 'Mumbai Central',
    fromCode: 'MMCT',
    toStation: 'Gandhinagar Capital',
    toCode: 'GNC',
    departureTime: '06:00',
    arrivalTime: '12:25',
    duration: '6h 25m',
  },
  {
    number: '12953',
    name: 'August Kranti Tejas Rajdhani',
    fromStation: 'Mumbai Central',
    fromCode: 'MMCT',
    toStation: 'Hazrat Nizamuddin',
    toCode: 'NZM',
    departureTime: '17:10',
    arrivalTime: '10:55 (+1)',
    duration: '17h 45m',
  },
  {
    number: '12009',
    name: 'Mumbai Central - Ahmedabad Shatabdi',
    fromStation: 'Mumbai Central',
    fromCode: 'MMCT',
    toStation: 'Ahmedabad Junction',
    toCode: 'ADI',
    departureTime: '06:20',
    arrivalTime: '12:45',
    duration: '6h 25m',
  },
];

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
