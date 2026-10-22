'use client';

import React, { useState } from 'react';
import {
  X,
  Train,
  CheckCircle,
  AlertCircle,
  Lock,
  Sparkles,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { POPULAR_TRAINS, DEMO_PRESET_PNRS, getDefaultTravelDate } from '@/lib/mockData';
import { Trip, TravelClass, BerthPreference } from '@/types';

interface TripEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated: (trip: Trip) => void;
  userId: string;
}

export const TripEntryModal: React.FC<TripEntryModalProps> = ({
  isOpen,
  onClose,
  onTripCreated,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'pnr' | 'manual'>('pnr');

  // PNR Form State
  const [pnrInput, setPnrInput] = useState('');
  const [pnrLoading, setPnrLoading] = useState(false);
  const [pnrError, setPnrError] = useState('');

  // Manual Form State
  const [selectedTrain, setSelectedTrain] = useState(POPULAR_TRAINS[0].number);
  const [travelDate, setTravelDate] = useState(getDefaultTravelDate());
  const [travelClass, setTravelClass] = useState<TravelClass>('3A');
  const [coachInput, setCoachInput] = useState('B4');
  const [berthType, setBerthType] = useState<BerthPreference>('Lower');

  if (!isOpen) return null;

  const handlePnrVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPnrError('');
    setPnrLoading(true);

    try {
      const res = await fetch('/api/pnr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnr: pnrInput }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to decode PNR');
      }

      const verified = data.data;
      const newTrip: Trip = {
        id: `trip_${Date.now()}`,
        userId,
        trainNumber: verified.trainNumber,
        trainName: verified.trainName,
        travelDate: verified.travelDate || travelDate,
        fromCode: verified.fromCode,
        fromName: verified.fromName,
        toCode: verified.toCode,
        toName: verified.toName,
        travelClass: verified.travelClass,
        coach: verified.coach,
        berthType: verified.berthType,
        pnrHash: verified.maskedPnr,
        privacyShareCoach: true,
      };

      onTripCreated(newTrip);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PNR verification failed';
      setPnrError(msg);
    } finally {
      setPnrLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trainInfo =
      POPULAR_TRAINS.find((t) => t.number === selectedTrain) || POPULAR_TRAINS[0];

    const newTrip: Trip = {
      id: `trip_${Date.now()}`,
      userId,
      trainNumber: trainInfo.number,
      trainName: trainInfo.name,
      travelDate,
      fromCode: trainInfo.fromCode,
      fromName: trainInfo.fromStation,
      toCode: trainInfo.toCode,
      toName: trainInfo.toStation,
      travelClass,
      coach: coachInput.trim().toUpperCase() || undefined,
      berthType,
      privacyShareCoach: true,
    };

    onTripCreated(newTrip);
    onClose();
  };

  const loadPresetPnr = (preset: (typeof DEMO_PRESET_PNRS)[0]) => {
    setPnrInput(preset.pnr);
    setPnrError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Train className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Join / Change Train Trip</h2>
              <p className="text-xs text-slate-400">
                Connect with co-travelers going on the same train
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 mx-5 mt-5 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('pnr')}
            className={`py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'pnr'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Option 1: Enter 10-Digit PNR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Train className="w-3.5 h-3.5" />
            <span>Option 2: Select Train Manually</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === 'pnr' ? (
            <form onSubmit={handlePnrVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  10-Digit PNR Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={10}
                    value={pnrInput}
                    onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 2849102451"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  {pnrInput.length === 10 && (
                    <CheckCircle className="absolute right-3.5 top-3.5 w-5 h-5 text-emerald-400" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  We automatically fetch your train number, date, coach, and route.
                </p>
              </div>

              {/* Demo 1-Click Chips */}
              <div>
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mb-2">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Try 1-Click Demo PNRs:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DEMO_PRESET_PNRS.map((preset) => (
                    <button
                      key={preset.pnr}
                      type="button"
                      onClick={() => loadPresetPnr(preset)}
                      className={`text-left p-2 rounded-lg border text-xs transition ${
                        pnrInput === preset.pnr
                          ? 'border-blue-500 bg-blue-950/40 text-blue-200'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-[11px] truncate">
                        {preset.label}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {preset.pnr}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {pnrError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{pnrError}</span>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <Shield className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-slate-200">Zero Privacy Leakage:</strong> Your
                  PNR and exact berth number remain encrypted on your device. Only your
                  train number, journey date, and coach are shared with co-passengers.
                </span>
              </div>

              <button
                type="submit"
                disabled={pnrInput.length !== 10 || pnrLoading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {pnrLoading ? (
                  <span>Decoding PNR details...</span>
                ) : (
                  <>
                    <span>Verify PNR & Join Co-Travelers</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {/* Train Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Train
                </label>
                <select
                  value={selectedTrain}
                  onChange={(e) => setSelectedTrain(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {POPULAR_TRAINS.map((t) => (
                    <option key={t.number} value={t.number}>
                      {t.number} - {t.name} ({t.fromCode} ➔ {t.toCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date of Journey */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Date of Journey
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Class, Coach & Berth grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Class
                  </label>
                  <select
                    value={travelClass}
                    onChange={(e) => setTravelClass(e.target.value as TravelClass)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="3A">3A (AC 3)</option>
                    <option value="2A">2A (AC 2)</option>
                    <option value="1A">1A (AC 1)</option>
                    <option value="CC">CC (Chair)</option>
                    <option value="EC">EC (Exec)</option>
                    <option value="SL">SL (Sleeper)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Coach (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    placeholder="e.g. B4"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Berth
                  </label>
                  <select
                    value={berthType}
                    onChange={(e) => setBerthType(e.target.value as BerthPreference)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Lower">Lower</option>
                    <option value="Middle">Middle</option>
                    <option value="Upper">Upper</option>
                    <option value="Side Lower">Side Lower</option>
                    <option value="Side Upper">Side Upper</option>
                    <option value="Window">Window</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <span>Find Co-Travelers</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
