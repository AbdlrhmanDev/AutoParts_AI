import type { ReactNode } from 'react';
import { sx, PRIMARY, PILL_TRACK } from '../../lib/sx';

export interface SegmentedItem {
  label: string;
  labelLong?: string;
  bg: string;
  fg: string;
  on: () => void;
}

/** Pill-shaped segmented control (language, sort, view toggles). */
export function Segmented({ items, pad, size = 13, long = false, extra = '' }: { items: SegmentedItem[]; pad: string; size?: number; long?: boolean; extra?: string }) {
  return (
    <div style={sx(PILL_TRACK + extra)}>
      {items.map((b, i) => (
        <button key={i} onClick={b.on} style={sx(`border:none; padding:${pad}; border-radius:999px; background:${b.bg}; color:${b.fg}; font-size:${size}px; cursor:pointer; white-space:nowrap;`)}>
          {long ? b.labelLong : b.label}
        </button>
      ))}
    </div>
  );
}

/** Orange gradient call-to-action button. */
export function PrimaryBtn({ onClick, children, extra = 'border-radius:10px; padding:10px 16px;' }: { onClick: () => void; children: ReactNode; extra?: string }) {
  return (
    <button onClick={onClick} style={sx(`border:none; ${extra} ${PRIMARY} font-weight:600; cursor:pointer;`)}>
      {children}
    </button>
  );
}
