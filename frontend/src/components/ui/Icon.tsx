export function Icon({ d, size = 18, sw = 1.7 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} style={{ flex: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
