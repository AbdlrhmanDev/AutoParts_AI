import { useEffect, useState } from 'react';
import { sx } from '../../lib/sx';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  fallback: string;
  height: number;
}

export function ProductImage({ src, alt, fallback, height }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const frame = `height:${height}px; background:radial-gradient(circle at 30% 15%, rgba(249,115,22,0.10), transparent 60%), linear-gradient(180deg, #18202A, #10161E); display:grid; place-items:center; overflow:hidden;`;
  if (!src || failed) {
    return (
      <div style={sx(`${frame} color:#7C8A9C; font-family:'IBM Plex Mono', monospace; font-size:11px; text-align:center; padding:12px;`)}>
        {fallback}
      </div>
    );
  }

  return (
    <div style={sx(frame)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={sx('width:100%; height:100%; object-fit:contain; background:#F8FAFC;')}
      />
    </div>
  );
}
