import { useEffect } from 'react';
import { sx } from '../../lib/sx';

export function DeleteProductDialog({ dialog }: { dialog: any }) {
  useEffect(() => {
    if (!dialog.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dialog.cancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialog]);

  if (!dialog.open) return null;
  return (
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) dialog.cancel(); }}
      style={sx('position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:24px; background:rgba(3,7,12,0.76); backdrop-filter:blur(8px); animation:dialogFade .16s ease-out;')}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-product-title"
        aria-describedby="delete-product-description"
        style={sx('width:min(460px, 100%); border:1px solid #313C4B; border-radius:22px; background:linear-gradient(180deg, #171E28, #10161E); box-shadow:0 28px 90px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.04); overflow:hidden; animation:dialogPop .18s ease-out;')}
      >
        <div style={sx('padding:24px 24px 18px; display:flex; gap:16px; align-items:flex-start;')}>
          <div style={sx('width:44px; height:44px; flex:none; display:grid; place-items:center; border-radius:14px; background:#351519; color:#FB7185; border:1px solid #61212A;')}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" />
            </svg>
          </div>
          <div style={sx('min-width:0; display:flex; flex-direction:column; gap:8px;')}>
            <h2 id="delete-product-title" style={sx('margin:0; color:#F8FAFC; font-size:19px; font-weight:650; line-height:1.45;')}>{dialog.title}</h2>
            <p id="delete-product-description" style={sx('margin:0; color:#94A3B8; font-size:13px; line-height:1.7;')}>{dialog.body}</p>
          </div>
        </div>
        <div style={sx('margin:0 24px; padding:12px 14px; border:1px solid #283342; border-radius:12px; background:#0C1118; color:#DCE5EF; font-size:13px; font-weight:500; line-height:1.6; overflow-wrap:anywhere;')}>{dialog.product}</div>
        <div style={sx('padding:20px 24px 24px; display:flex; justify-content:flex-end; gap:10px;')}>
          <button autoFocus onClick={dialog.cancel} style={sx('min-width:100px; border:1px solid #344050; border-radius:11px; padding:10px 16px; background:#18202A; color:#D8E1EB; font-size:13px; font-weight:600; cursor:pointer;')}>{dialog.cancelLabel}</button>
          <button onClick={dialog.confirm} style={sx('min-width:120px; border:1px solid #BE3043; border-radius:11px; padding:10px 16px; background:linear-gradient(180deg, #E5485D, #BE263B); color:#FFF7F8; box-shadow:0 8px 22px rgba(190,38,59,0.25); font-size:13px; font-weight:700; cursor:pointer;')}>{dialog.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
