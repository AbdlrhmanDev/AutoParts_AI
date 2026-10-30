import { sx, PRIMARY, CARD } from '../lib/sx';
import { PrimaryBtn } from '../components/ui/Buttons';
import { BrandMark } from '../components/ui/BrandMark';
import type { ViewModel as VM } from '../types';

const TH = 'padding:8px; border-bottom:1px solid #222B37; font-weight:500;';
const TD = 'padding:10px 8px; border-bottom:1px solid #1C2430;';
const STEP = 'width:30px; height:30px; border:1px solid #2A3442; background:#161D27; border-radius:8px; cursor:pointer; font-size:15px; color:#E6EDF5;';
const SD = 'padding:8px; border-bottom:1px solid #E3DDD2;';

function QuoteSheet({ vm }: { vm: VM }) {
  return (
    <div id="quote-sheet" dir="rtl" lang="ar" style={sx("width:794px; max-width:100%; margin:0 auto; background:#FFFFFF; border:1px solid #DAD3C7; box-shadow:0 10px 30px rgba(34,32,28,0.08); padding:48px; display:flex; flex-direction:column; gap:28px; font-family:'IBM Plex Sans Arabic', sans-serif; color:#1C1A17; font-size:12pt;")}>
      <div style={sx('display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:20px; border-bottom:3px solid #E5560B;')}>
        <div style={sx('display:flex; flex-direction:column; gap:4px;')}>
          <div style={sx('display:flex; align-items:center; gap:10px;')}>
            <BrandMark size={36} onPaper />
            <span style={sx('font-size:18pt; font-weight:700;')}>{vm.company.name}</span>
          </div>
          <span style={{ color: '#5E574D' }}>{vm.company.address}</span>
          <span style={{ color: '#5E574D' }}>السجل التجاري: {vm.company.cr} · الرقم الضريبي: {vm.company.vatNo}</span>
        </div>
        <div style={sx('display:flex; flex-direction:column; gap:4px; text-align:left;')}>
          <span style={sx('font-size:22pt; font-weight:700;')}>عرض سعر</span>
          <span style={sx("font-family:'IBM Plex Mono', monospace;")} dir="ltr">{vm.quoteNo}</span>
          <span style={{ color: '#5E574D' }}>التاريخ: {vm.quoteDate}</span>
          <span style={{ color: '#5E574D' }}>صالح حتى: {vm.quoteExpiry}</span>
        </div>
      </div>
      <div style={sx('display:grid; grid-template-columns:1fr 1fr; gap:16px;')}>
        <div style={sx('display:flex; flex-direction:column; gap:4px; padding:14px; background:#F6F3EE; border-radius:4px;')}>
          <span style={sx('font-size:10pt; color:#5E574D;')}>العميل</span>
          <span style={{ fontWeight: 600 }}>{vm.customer.name}</span>
          <span>{vm.customer.phone}</span>
          <span>{vm.customer.city}</span>
        </div>
        <div style={sx('display:flex; flex-direction:column; gap:4px; padding:14px; background:#F6F3EE; border-radius:4px;')}>
          <span style={sx('font-size:10pt; color:#5E574D;')}>المركبة</span>
          <span style={{ fontWeight: 600 }}>{vm.sheetVehicle}</span>
          <span style={sx("font-family:'IBM Plex Mono', monospace; font-size:10pt;")} dir="ltr">{vm.sheetVin}</span>
        </div>
      </div>
      <table style={sx('border-collapse:collapse; width:100%;')}>
        <thead>
          <tr style={sx('background:#22201C; color:#F4EFE6;')}>
            <th style={sx('padding:8px; text-align:start; font-weight:500;')}>#</th>
            <th style={sx('padding:8px; text-align:start; font-weight:500;')}>الصنف</th>
            <th style={sx('padding:8px; text-align:start; font-weight:500;')}>رقم القطعة</th>
            <th style={sx('padding:8px; text-align:center; font-weight:500;')}>الكمية</th>
            <th style={sx('padding:8px; text-align:start; font-weight:500;')}>سعر الوحدة</th>
            <th style={sx('padding:8px; text-align:end; font-weight:500;')}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {vm.sheetRows.map(r => (
            <tr key={r.n}>
              <td style={sx(SD + "font-family:'IBM Plex Mono', monospace;")}>{r.n}</td>
              <td style={sx(SD)}>{r.title}<br /><span style={sx('font-size:9pt; color:#5E574D;')}>{r.brand} · {r.compat}</span></td>
              <td style={sx(SD + "font-family:'IBM Plex Mono', monospace; font-size:9pt;")} dir="ltr">{r.partNo}</td>
              <td style={sx(SD + 'text-align:center;')}>{r.qty}</td>
              <td style={sx(SD + 'white-space:nowrap;')}>{r.unit}</td>
              <td style={sx(SD + 'text-align:end; white-space:nowrap;')}>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={sx('align-self:flex-end; width:300px; display:flex; flex-direction:column; gap:6px;')}>
        <div style={sx('display:flex; justify-content:space-between;')}><span>المجموع الفرعي</span><span>{vm.sheetTotals.subtotal}</span></div>
        <div style={sx('display:flex; justify-content:space-between;')}><span>ضريبة القيمة المضافة ({vm.vatRate}%)</span><span>{vm.sheetTotals.vat}</span></div>
        <div style={sx('display:flex; justify-content:space-between;')}><span>الشحن</span><span>{vm.sheetTotals.shipping}</span></div>
        <div style={sx('display:flex; justify-content:space-between; padding-top:8px; border-top:2px solid #1C1A17; font-size:14pt; font-weight:700;')}><span>الإجمالي</span><span>{vm.sheetTotals.total}</span></div>
      </div>
      <div style={sx('display:flex; min-width:0; flex-direction:column; gap:7px; font-size:10pt; color:#5E574D; overflow:hidden;')}>
        <span style={sx('font-weight:600; color:#1C1A17;')}>مصادر الأسعار</span>
        {vm.sheetSources.length === 0 && <span>—</span>}
        {vm.sheetSources.map((s, i) => (
          <div key={i} style={sx('display:grid; grid-template-columns:minmax(110px,180px) minmax(0,1fr); gap:10px; align-items:start; min-width:0;')}>
            <strong style={sx('font-weight:600; color:#1C1A17; overflow-wrap:anywhere;')}>{s.seller}</strong>
            <span style={sx('min-width:0; overflow-wrap:anywhere; word-break:break-word;')}>
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer" dir="ltr" style={sx('color:#8B4513; text-decoration:underline; text-underline-offset:2px;')}>{s.host}</a> : 'بدون رابط'}
              <span> · وقت الاسترجاع: {s.retrieved}</span>
            </span>
          </div>
        ))}
      </div>
      <div style={sx('padding-top:14px; border-top:1px solid #DAD3C7; font-size:9pt; color:#5E574D; line-height:1.6;')}>هذا عرض سعر وليس فاتورة ضريبية، ولا يمثل عملية شراء. الأسعار مأخوذة من صفحات البائعين وقت الاسترجاع وقد تتغير.</div>
    </div>
  );
}

export function QuotePage({ vm }: { vm: VM }) {
  const t = vm.t;
  return (
    <div style={sx('padding:28px 32px; display:flex; flex-direction:column; gap:24px; max-width:1280px; width:100%;')}>
      {vm.quoteEmpty && (
        <div style={sx('padding:48px; text-align:center; border:1px dashed #334050; border-radius:14px; display:flex; flex-direction:column; gap:12px; align-items:center;')}>
          <p style={sx('margin:0; color:#8B98A9;')}>{t.emptyQuote}</p>
          <PrimaryBtn onClick={vm.goChat}>{t.goChat}</PrimaryBtn>
        </div>
      )}
      {vm.quoteHas && (
        <div style={sx('display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;')}>
          <section style={sx(CARD + 'flex:1 1 560px; min-width:0; gap:12px; overflow:auto;')}>
            <div style={sx('display:flex; align-items:center; gap:10px;')}>
              <h3 style={sx('margin:0; font-size:15px; font-weight:600; flex:1;')}>{t.items}</h3>
              <span style={sx(`padding:3px 10px; border-radius:8px; background:${vm.quoteStatusBg}; color:${vm.quoteStatusFg}; font-size:12px; font-weight:500;`)}>{vm.quoteStatusLabel}</span>
            </div>
            <table style={sx('border-collapse:collapse; width:100%; font-size:13px;')}>
              <thead>
                <tr style={{ color: '#8B98A9' }}>
                  <th style={sx('text-align:start; ' + TH)}>{t.product}</th>
                  <th style={sx('text-align:start; ' + TH)}>{t.unit}</th>
                  <th style={sx('text-align:center; ' + TH)}>{t.qty}</th>
                  <th style={sx('text-align:end; ' + TH)}>{t.lineTotal}</th>
                  <th style={sx('padding:8px; border-bottom:1px solid #222B37;')} />
                </tr>
              </thead>
              <tbody>
                {vm.quoteRows.map((r, i) => (
                  <tr key={i}>
                    <td style={sx(TD)}>
                      <div style={sx('display:flex; flex-direction:column; gap:2px;')}>
                        <span style={{ fontWeight: 600 }}>{r.title}</span>
                        <span style={sx('font-size:12px; color:#8B98A9;')}>{r.meta}</span>
                        <span style={sx(`align-self:flex-start; padding:1px 6px; border-radius:8px; background:${r.compatBg}; color:${r.compatFg}; font-size:11px;`)}>{r.compatLabel}</span>
                      </div>
                    </td>
                    <td style={sx(TD + 'white-space:nowrap;')}>{r.unit}</td>
                    <td style={sx(TD)}>
                      <div style={sx('display:flex; align-items:center; justify-content:center; gap:4px;')}>
                        <button onClick={r.dec} style={sx(STEP)}>−</button>
                        <span style={sx("min-width:28px; text-align:center; font-family:'IBM Plex Mono', monospace;")}>{r.qty}</span>
                        <button onClick={r.inc} style={sx(STEP)}>+</button>
                      </div>
                    </td>
                    <td style={sx(TD + 'text-align:end; font-weight:600; white-space:nowrap;')}>{r.total}</td>
                    <td style={sx(TD + 'text-align:end;')}>
                      <button onClick={r.remove} style={sx('border:none; background:transparent; color:#EF4444; font-size:12px; cursor:pointer;')}>{t.remove}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={sx('margin:0; font-size:12px; color:#8B98A9;')}>{t.editResets}</p>
          </section>
          <aside style={sx('flex:0 1 340px; min-width:280px; background:#161D27; border:1px solid #222B37; border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:12px;')}>
            <div style={sx('display:flex; justify-content:space-between;')}><span style={{ color: '#8B98A9' }}>{t.subtotal}</span><span>{vm.totals.subtotal}</span></div>
            <div style={sx('display:flex; justify-content:space-between;')}><span style={{ color: '#8B98A9' }}>{t.vat} ({vm.vatRate}%)</span><span>{vm.totals.vat}</span></div>
            <label style={sx('display:flex; flex-direction:column; gap:4px;')}>
              <span style={{ color: '#8B98A9' }}>{t.shipping}</span>
              <input value={vm.shipping} onChange={vm.onShipping} placeholder={t.shippingPh} inputMode="decimal" style={sx('width:100%; padding:8px 10px; border:1px solid #2A3442; border-radius:8px; font-size:13px; color:#E6EDF5; background:#161D27;')} />
            </label>
            <div style={sx('display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid #222B37; font-size:18px; font-weight:700;')}><span>{t.total}</span><span>{vm.totals.total}</span></div>
            {vm.shipUnknown && <span style={sx('font-size:12px; color:#8B98A9;')}>{t.shipExcluded}</span>}
            <div style={sx('display:flex; flex-direction:column; gap:4px; padding:10px 12px; background:#111720; border-radius:10px; font-size:12px; line-height:1.6;')}>
              <span style={{ fontWeight: 600 }}>{t.customer}</span>
              <span>{vm.customerLine}</span>
              <span style={sx('font-weight:600; margin-top:4px;')}>{t.vehicle}</span>
              <span>{vm.vehicleLabel}</span>
            </div>
            {vm.isDraft && (
              <>
                <button onClick={vm.confirmQuote} style={sx(`min-height:46px; border:none; border-radius:10px; ${PRIMARY} font-size:15px; font-weight:600; cursor:pointer;`)}>{t.confirm}</button>
                <span style={sx('font-size:12px; color:#8B98A9; line-height:1.5;')}>{t.confirmHint}</span>
              </>
            )}
            {vm.isConfirmed && (
              <>
                <div style={sx('display:grid; grid-template-columns:1fr 1fr; gap:8px;')}>
                  <button onClick={vm.downloadQuote} style={sx(`min-height:44px; border:none; border-radius:10px; ${PRIMARY} font-weight:600; cursor:pointer;`)}>{t.download}</button>
                  <button onClick={vm.printQuote} style={sx('min-height:44px; border:1px solid #1E2733; border-radius:10px; background:transparent; color:#E6EDF5; font-weight:600; cursor:pointer;')}>{t.print}</button>
                </div>
                <span style={sx('font-size:12px; color:#8B98A9; line-height:1.5;')}>{t.pdfNote}</span>
              </>
            )}
          </aside>
        </div>
      )}
      {vm.isConfirmed && <QuoteSheet vm={vm} />}
    </div>
  );
}
