'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { SvgIcon } from '@/shared/icons';

const tile: React.CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: '10px',
  padding: '22px 8px',
  border: '1px solid var(--stroke-primary)',
  borderRadius: 'var(--r-m)',
  font: 'var(--type-body)',
  cursor: 'pointer',
};

const CameraIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const PhotosIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="15" cy="9" r="1.6" />
    <path d="M4 17l5-5 4 4 2-2 5 5" />
  </svg>
);

/** One button; opens a bottom sheet to take a photo with the camera or pick one from Photos. */
export const PassPicker: React.FC<{
  label: string;
  disabled?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
  onFile: (f: File) => void;
}> = ({ label, disabled, small, style, onFile }) => {
  const [open, setOpen] = useState(false);
  const input = (capture?: 'environment') => (
    <input
      type="file"
      accept="image/*"
      capture={capture}
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = ''; // same file can be picked again
        setOpen(false);
        if (f) onFile(f);
      }}
    />
  );
  const root = typeof document !== 'undefined' ? document.querySelector('.x-app') : null;

  return (
    <>
      <button
        type="button"
        className={`x-btn x-btn--line${small ? ' x-btn--sm' : ''}`}
        style={{ cursor: disabled ? 'default' : 'pointer', ...style }}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <SvgIcon name="seal" size={small ? 16 : 18} width={0} />
        {label}
      </button>
      {open &&
        root &&
        createPortal(
          <>
            <div className="x-scrim" style={{ zIndex: 45 }} onClick={() => setOpen(false)} />
            <div className="x-sheet" style={{ zIndex: 46 }}>
              <div className="x-grab" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button type="button" className="x-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                  <SvgIcon name="close" />
                </button>
                <h3>Boarding pass</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={tile}>
                  <CameraIcon />
                  Camera
                  {input('environment')}
                </label>
                <label style={tile}>
                  <PhotosIcon />
                  Photos
                  {input()}
                </label>
              </div>
            </div>
          </>,
          root,
        )}
    </>
  );
};
