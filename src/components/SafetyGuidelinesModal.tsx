'use client';

import React from 'react';
import { X, ShieldAlert, PhoneCall, Eye, Users, AlertTriangle } from 'lucide-react';

interface SafetyGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafetyGuidelinesModal: React.FC<SafetyGuidelinesModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Safety & Etiquette Guide</h2>
              <p className="text-xs text-slate-400">Rules for safe co-traveling across Indian Railways</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Eye className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-slate-200">Meet in Public Spaces</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Always meet co-passengers in visible communal areas: near the coach vestibule, pantry car counter, or during daytime at your seat.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-slate-200">Protect Sensitive Details</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                RailMeet will never reveal your full 10-digit PNR. Avoid disclosing home addresses, financial credentials, or private travel tickets to strangers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <Users className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-slate-200">Respect Boundaries & Comfort</h4>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                If someone prefers quiet time, work, or sleeping hours (10:00 PM to 06:00 AM as per Railway rules), respect their space promptly.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-red-200">
            <PhoneCall className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-red-300">Indian Railways Helpline 139</h4>
              <p className="text-red-300/80 mt-0.5 leading-relaxed">
                For any immediate assistance or security concerns while onboard, dial <strong>139</strong> (All-in-one Railway Security & Medical Helpline) or open the RailMadad app.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
