'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';

export const Toast: React.FC = () => {
  const toast = useAppStore((s) => s.toastMessage);
  const clearToast = useAppStore((s) => s.clearToast);

  if (!toast) return null;

  return (
    <div className="x-toast">
      <span>{toast.text}</span>
      {toast.actionLabel && (
        <button
          type="button"
          onClick={() => {
            if (toast.onAction) toast.onAction();
            clearToast();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
};
