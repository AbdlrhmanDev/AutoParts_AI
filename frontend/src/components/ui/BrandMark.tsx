import type { CSSProperties } from 'react';

export function BrandMark({ size = 38, onPaper = false }: { size?: number; onPaper?: boolean }) {
  const accent = onPaper ? '#D94F08' : '#FB7A22';
  const ink = onPaper ? '#24211D' : '#EAF0F6';
  const style: CSSProperties = { width: size, height: size, flex: 'none', display: 'block' };

  return (
    <svg viewBox="0 0 40 40" style={style} aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="15" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.92" />
      <circle cx="20" cy="20" r="7" fill={accent} />
      <circle cx="20" cy="20" r="2.4" fill={onPaper ? '#FFFFFF' : '#0F141B'} />
      <path d="M20 5v5M35 20h-5M20 35v-5M5 20h5" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.4 9.4l3.5 3.5M30.6 9.4l-3.5 3.5M30.6 30.6l-3.5-3.5M9.4 30.6l3.5-3.5" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" opacity="0.72" />
    </svg>
  );
}
