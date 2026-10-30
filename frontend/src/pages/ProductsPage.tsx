import { sx, CARD } from '../lib/sx';
import { Segmented, PrimaryBtn } from '../components/ui/Buttons';
import { ProductImage } from '../components/ui/ProductImage';
import type { ViewModel as VM } from '../types';

export function ProductsPage({ vm }: { vm: VM }) {
  const t = vm.t;
  return (
    <div style={sx('padding:28px 32px; display:flex; flex-direction:column; gap:20px; max-width:1280px; width:100%;')}>
      <div style={sx('display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap;')}>
        <div style={sx('flex:1; min-width:240px; display:flex; flex-direction:column; gap:4px;')}>
          <span style={sx('font-size:12px; color:#8B98A9;')}>{t.resultsFor}</span>
          <span style={sx('font-size:20px; font-weight:600;')}>{vm.vehicleLabel}</span>
          <span style={sx('font-size:12px; color:#8B98A9;')}>{vm.productsSource}</span>
        </div>
        <div style={sx('display:flex; align-items:center; gap:8px;')}>
          <span style={sx('font-size:12px; color:#8B98A9;')}>{t.sort}</span>
          <Segmented items={vm.sortBtns} pad="6px 10px" />
        </div>
      </div>
      <div style={sx('padding:10px 14px; background:#2A2110; color:#FBBF24; font-size:12px; border-radius:10px; line-height:1.5;')}>{vm.sourceBanner}</div>
      {vm.noResults && (
        <div style={sx('padding:48px; text-align:center; border:1px dashed #334050; border-radius:14px; display:flex; flex-direction:column; gap:12px; align-items:center;')}>
          <p style={sx('margin:0; color:#8B98A9;')}>{t.noResults}</p>
          <PrimaryBtn onClick={vm.goChat}>{t.goChat}</PrimaryBtn>
        </div>
      )}
      <div style={sx('display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;')}>
        {vm.results.map(p => (
          <article key={p.id} className="lift" style={sx('background:#121821; border:1px solid #1E2733; border-radius:14px; overflow:hidden; display:flex; flex-direction:column;')}>
            <ProductImage src={p.image} alt={p.title} fallback={p.imgNote} height={150} />
            <div style={sx('padding:16px; display:flex; flex-direction:column; gap:8px; flex:1;')}>
              <div style={sx('display:flex; justify-content:space-between; gap:8px; font-size:12px; color:#8B98A9;')}>
                <span>{p.brand}</span>
                <span>{p.typeLabel}</span>
              </div>
              <span style={sx('font-weight:600; font-size:15px; line-height:1.4;')}>{p.title}</span>
              <span style={sx("font-family:'IBM Plex Mono', monospace; font-size:12px; color:#8B98A9;")} dir="ltr">{p.partNo}</span>
              <span style={sx('font-size:13px; color:#8B98A9;')}>{t.seller}: {p.seller}</span>
              <span style={sx('font-size:20px; font-weight:700;')}>{p.price}</span>
              <div style={sx('display:flex; flex-direction:column; gap:4px;')}>
                <span style={sx(`align-self:flex-start; padding:3px 8px; border-radius:8px; background:${p.compatBg}; color:${p.compatFg}; font-size:12px; font-weight:500;`)}>{p.compatLabel}</span>
                <span style={sx('font-size:12px; color:#8B98A9; line-height:1.5;')}>{p.evidence}</span>
              </div>
              <span style={sx('font-size:12px; color:#8B98A9;')}>{t.availability}: {p.avail}</span>
              <div style={sx('margin-top:auto; padding-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:8px;')}>
                {p.hasUrl ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={sx('display:grid; place-items:center; border:1px solid #2A3442; background:#161D27; color:#E6EDF5; border-radius:8px; padding:9px; font-size:13px; text-decoration:none;')}>{t.viewProduct}</a>
                ) : (
                  <button disabled title={t.noLink} style={sx('border:1px solid #222B37; background:#111720; color:#5C6878; border-radius:8px; padding:9px; font-size:13px; cursor:not-allowed;')}>{t.viewProduct}</button>
                )}
                <button onClick={p.onAdd} disabled={p.addDisabled} style={sx(`border:none; border-radius:8px; padding:9px; background:${p.addBg}; color:${p.addFg}; font-size:13px; font-weight:600; cursor:pointer;`)}>{p.addLabel}</button>
                <button onClick={p.onCompare} style={sx(`grid-column:1 / -1; border:1px solid #1E2733; border-radius:8px; padding:7px; background:${p.cmpBg}; color:${p.cmpFg}; font-size:12px; cursor:pointer;`)}>{p.cmpLabel}</button>
                <button onClick={p.onDelete} style={sx('grid-column:1 / -1; border:1px solid #7F1D1D; border-radius:8px; padding:7px; background:#2A1215; color:#FCA5A5; font-size:12px; font-weight:600; cursor:pointer;')}>{t.deleteProduct}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {vm.showCompare && (
        <section style={sx(CARD + 'gap:12px; overflow:auto;')}>
          <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{t.compareTitle}</h3>
          <table style={sx('border-collapse:collapse; width:100%; font-size:13px;')}>
            <thead>
              <tr>
                <th style={sx('text-align:start; padding:8px; border-bottom:1px solid #222B37; color:#8B98A9; font-weight:500;')} />
                {vm.compareHead.map((h, i) => (
                  <th key={i} style={sx('text-align:start; padding:8px; border-bottom:1px solid #222B37; font-weight:600;')}>{h.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.compareRows.map((r, i) => (
                <tr key={i}>
                  <td style={sx('padding:8px; border-bottom:1px solid #1C2430; color:#8B98A9; white-space:nowrap;')}>{r.label}</td>
                  {r.cells.map((cell, j) => (
                    <td key={j} style={sx('padding:8px; border-bottom:1px solid #1C2430;')}>{cell.v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
