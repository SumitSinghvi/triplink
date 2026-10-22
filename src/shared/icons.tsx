import React from 'react';

const ICONS: Record<string, string> = {
  train: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 10h12M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="13.5" r=".6"/><circle cx="15" cy="13.5" r=".6"/>',
  plane: '<path d="M10.5 3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V9l7 4v2l-7-2v5l2 1.5V21l-3.5-1-3.5 1v-1.5l2-1.5v-5l-7 2v-2l7-4z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.1a5 5 0 0 1 5 5"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  seal: '<path d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" fill="currentColor" stroke="none"/><path d="M8.5 12l2.5 2.5 4.5-5" style="stroke:var(--hero-text);stroke-width:2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0"/><circle cx="9" cy="9.5" r=".6" fill="currentColor"/><circle cx="15" cy="9.5" r=".6" fill="currentColor"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2M14 10h4M14 13h3"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};

export const SvgIcon: React.FC<{
  name: keyof typeof ICONS;
  size?: number;
  width?: number;
  className?: string;
}> = ({ name, size = 22, width = 1.7, className = '' }) => {
  const innerHtml = ICONS[name] || '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: innerHtml }}
    />
  );
};
