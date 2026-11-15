'use client';

import React from 'react';
import { SvgIcon } from '@/shared/icons';

/** Two buttons: open camera directly, or pick an existing image from gallery. */
export const PassPicker: React.FC<{
  label: string;
  disabled?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
  onFile: (f: File) => void;
}> = ({ label, disabled, small, style, onFile }) => {
  const cls = `x-btn x-btn--line${small ? ' x-btn--sm' : ''}`;
  const btnStyle: React.CSSProperties = { cursor: disabled ? 'default' : 'pointer', flex: 1 };
  const input = (capture?: 'environment') => (
    <input
      type="file"
      accept="image/*"
      capture={capture}
      hidden
      disabled={disabled}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = ''; // same file can be picked again
        if (f) onFile(f);
      }}
    />
  );
  return (
    <div style={{ display: 'flex', gap: '8px', ...style }}>
      <label className={cls} style={{ ...btnStyle, flex: 2 }}>
        <SvgIcon name="seal" size={small ? 16 : 18} width={0} />
        {label}
        {input('environment')}
      </label>
      <label className={cls} style={btnStyle}>
        Gallery
        {input()}
      </label>
    </div>
  );
};
