import { sx, PRIMARY } from '../lib/sx';
import { Icon } from '../components/ui/Icon';
import { PrimaryBtn } from '../components/ui/Buttons';
import { ProductImage } from '../components/ui/ProductImage';
import { BrandMark } from '../components/ui/BrandMark';
import type { ViewModel as VM } from '../types';

const GUTTER = 'max(28px, calc((100% - 880px) / 2))';

function StepDot({ cs }: { cs: any }) {
  return (
    <span style={sx(`width:28px; height:28px; flex:none; border-radius:50%; display:grid; place-items:center; background:${cs.bg}; color:${cs.fg}; border:1px solid ${cs.border}; animation:${cs.anim};`)}>
      <Icon d={cs.icon} size={14} sw={2} />
    </span>
  );
}

function Message({ m, vm }: { m: any; vm: VM }) {
  const t = vm.t;
  return (
    <div style={sx(`display:flex; flex-direction:column; align-items:${m.align}; gap:10px;`)}>
      {m.isAgent && (
        <div style={sx('display:flex; align-items:center; gap:8px; font-size:12px;')}>
          <BrandMark size={24} />
          <span dir="ltr" style={sx('font-weight:600; color:#D7DEE7; letter-spacing:-0.01em;')}>AutoParts <span style={{ color: '#FB7A22' }}>AI</span></span>
        </div>
      )}
      {m.hasSteps && (
        <div style={sx('display:flex; align-items:center; flex-wrap:wrap; gap:6px 4px; padding:12px 14px; background:#161D27; border:1px solid #1C2430; border-radius:16px; max-width:min(760px, 100%);')}>
          {m.cust.map((cs, i) => (
            <div key={i} style={sx('display:flex; align-items:center; gap:4px;')}>
              <div style={sx('display:flex; align-items:center; gap:8px; padding:2px 4px;')}>
                <StepDot cs={cs} />
                <span style={sx('display:flex; flex-direction:column;')}>
                  <span style={sx(`font-size:13px; font-weight:500; color:${cs.labelFg}; white-space:nowrap;`)}>{cs.label}</span>
                  <span style={sx(`font-size:11px; color:${cs.stFg}; white-space:nowrap;`)}>{cs.stLabel}</span>
                </span>
              </div>
              {cs.notLast && <span style={sx(`width:18px; height:2px; flex:none; border-radius:1px; background:${cs.line};`)} />}
            </div>
          ))}
        </div>
      )}
      {m.hasText && (
        <div style={sx(`max-width:min(640px, 100%); padding:14px 18px; border-radius:18px; background:${m.bg}; color:${m.fg}; border:1px solid ${m.border}; white-space:pre-wrap; line-height:1.75; font-size:15px; text-wrap:pretty;`)}>{m.text}</div>
      )}
      {m.hasDiag && (
        <div style={sx('width:min(720px, 100%); background:#121821; border:1px solid #1E2733; box-shadow:inset 0 1px 0 rgba(255,255,255,0.03); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:16px;')}>
          <div style={sx('display:flex; flex-direction:column; gap:10px;')}>
            <div style={sx('display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap;')}>
              <span style={{ fontWeight: 600 }}>{t.possibleCauses}</span>
              <span style={sx('font-size:12px; color:#8B98A9;')}>{t.notConfirmed}</span>
            </div>
            {m.causes.map((cz, i) => (
              <div key={i} style={sx('display:flex; gap:10px; align-items:flex-start;')}>
                <span style={sx(`flex:none; padding:2px 8px; border-radius:8px; background:${cz.likBg}; color:${cz.likFg}; font-size:12px; font-weight:500; min-width:72px; text-align:center;`)}>{cz.likLabel}</span>
                <div style={sx('display:flex; flex-direction:column; gap:2px; line-height:1.6;')}>
                  <span style={{ fontWeight: 500 }}>{cz.title}</span>
                  <span style={sx('font-size:13px; color:#8B98A9;')}>{cz.why}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={sx('display:flex; flex-direction:column; gap:8px; border-top:1px solid #1C2430; padding-top:14px;')}>
            <span style={{ fontWeight: 600 }}>{t.checks}</span>
            {m.checks.map((ck, i) => (
              <div key={i} style={sx('display:flex; gap:10px; line-height:1.6;')}>
                <span style={sx("flex:none; width:22px; height:22px; border-radius:50%; background:#1E2733; color:#F1F5F9; display:grid; place-items:center; font-family:'IBM Plex Mono', monospace; font-size:11px; margin-top:2px;")}>{ck.n}</span>
                <span>{ck.text}</span>
              </div>
            ))}
          </div>
          {m.hasSafety && (
            <div style={sx('display:flex; gap:10px; padding:12px 14px; background:#2A1215; color:#FCA5A5; border-radius:10px; line-height:1.6;')}>
              <span style={sx('font-weight:600; flex:none;')}>{t.safety}</span>
              <span>{m.safety}</span>
            </div>
          )}
        </div>
      )}
      {m.hasFollow && (
        <div style={sx('width:min(640px, 100%); padding:12px 16px; background:#2A1A0E; color:#FDBA74; border-radius:14px; display:flex; flex-direction:column; gap:4px; line-height:1.6;')}>
          <span style={sx('font-size:12px; font-weight:600; letter-spacing:0.02em;')}>{t.followUp}</span>
          <span style={{ fontSize: 15 }}>{m.followUp}</span>
        </div>
      )}
      {m.hasProducts && (
        <div style={sx('width:100%; display:flex; flex-direction:column; gap:10px;')}>
          <div style={sx('display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;')}>
            <span style={{ fontWeight: 600 }}>{t.recommended}</span>
            <span style={sx('font-size:12px; color:#8B98A9;')}>{m.sourceLine}</span>
          </div>
          <div style={sx('display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;')}>
            {m.products.map(p => (
              <div key={p.id} style={sx('background:#121821; border:1px solid #1E2733; border-radius:14px; overflow:hidden; display:flex; flex-direction:column;')}>
                <ProductImage src={p.image} alt={p.title} fallback={p.imgNote} height={96} />
                <div style={sx('padding:12px; display:flex; flex-direction:column; gap:6px; flex:1;')}>
                  <span style={sx('font-size:12px; color:#8B98A9;')}>{p.brand} · {p.seller}</span>
                  <span style={sx('font-weight:600; line-height:1.4;')}>{p.title}</span>
                  <span style={sx('font-size:16px; font-weight:700;')}>{p.price}</span>
                  <span style={sx(`align-self:flex-start; padding:2px 8px; border-radius:8px; background:${p.compatBg}; color:${p.compatFg}; font-size:12px; font-weight:500;`)}>{p.compatLabel}</span>
                  <button onClick={p.onAdd} disabled={p.addDisabled} style={sx(`margin-top:auto; border:none; border-radius:8px; padding:8px; background:${p.addBg}; color:${p.addFg}; font-size:13px; font-weight:600; cursor:pointer;`)}>{p.addLabel}</button>
                  <button onClick={p.onDelete} style={sx('border:1px solid #7F1D1D; border-radius:8px; padding:7px; background:#2A1215; color:#FCA5A5; font-size:12px; font-weight:600; cursor:pointer;')}>{t.deleteProduct}</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={vm.goProducts} style={sx('align-self:flex-start; border:1px solid #222B37; background:transparent; border-radius:8px; padding:6px 12px; font-size:13px; cursor:pointer; color:#E6EDF5;')}>{t.seeAllCompare}</button>
        </div>
      )}
      {m.isQuote && <PrimaryBtn onClick={vm.goQuote} extra="border-radius:10px; padding:10px 16px;">{t.openQuote}</PrimaryBtn>}
      {m.hasQuick && (
        <div style={sx('display:flex; flex-wrap:wrap; gap:8px; max-width:min(720px, 100%);')}>
          {m.quick.map((qr, i) => (
            <button key={i} onClick={qr.go} style={sx('border:1px solid #F97316; background:#161D27; color:#FDBA74; border-radius:10px; padding:8px 14px; font-size:14px; cursor:pointer; white-space:nowrap; min-height:40px;')}>{qr.text}</button>
          ))}
        </div>
      )}
      {m.hasRoute && (
        <div style={sx('display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:12px;')}>
          {m.doneSteps.map((ds, i) => (
            <span key={i} style={sx(`padding:2px 9px; border-radius:16px; background:${ds.bg}; color:${ds.fg}; white-space:nowrap;`)}>{ds.mark} {ds.label}</span>
          ))}
          <button onClick={m.openRun} style={sx('border:none; background:transparent; color:#FB923C; font-size:12px; cursor:pointer; padding:2px 4px;')}>{t.execDetails}</button>
        </div>
      )}
    </div>
  );
}

function ContextPanel({ vm }: { vm: VM }) {
  const t = vm.t;
  const SMALL_BTN = 'border:1px solid #2A3442; background:#131922; border-radius:8px; padding:4px 10px; font-size:12px; cursor:pointer; color:#E6EDF5; white-space:nowrap;';
  return (
    <aside style={sx('width:340px; flex:none; border-inline-start:1px solid #141B24; background:rgba(15,20,27,0.6); overflow:auto; padding:20px; display:flex; flex-direction:column; gap:20px;')}>
      <section style={sx('display:flex; flex-direction:column; gap:12px;')}>
        <div style={sx('display:flex; align-items:center; justify-content:space-between;')}>
          <h3 style={sx('margin:0; font-size:14px; font-weight:600;')}>{t.vehiclePanel}</h3>
          <button onClick={vm.saveVehicle} style={sx(SMALL_BTN)}>{vm.saveVehicleLabel}</button>
        </div>
        <div style={sx('display:grid; grid-template-columns:1fr 1fr; gap:8px;')}>
          {vm.vFields.map((f, i) => (
            <label key={i} style={sx(`display:flex; flex-direction:column; gap:3px; grid-column:${f.span};`)}>
              <span style={sx('font-size:11px; color:#8B98A9;')}>{f.label}</span>
              <input value={f.value} onChange={f.onChange} placeholder="—" style={sx(`width:100%; padding:7px 9px; border:1px solid ${f.border}; border-radius:8px; background:#161D27; font-size:13px; color:#E6EDF5;`)} />
            </label>
          ))}
        </div>
      </section>
      <section style={sx('display:flex; flex-direction:column; gap:12px; border-top:1px solid #222B37; padding-top:18px;')}>
        <div style={sx('display:flex; align-items:center; justify-content:space-between; gap:8px;')}>
          <h3 style={sx('margin:0; font-size:14px; font-weight:600;')}>{t.progress}</h3>
          <button onClick={vm.openInspector} style={sx(SMALL_BTN)}>{t.inspectorBtn}</button>
        </div>
        {vm.noRun && <p style={sx('margin:0; color:#8B98A9; font-size:13px;')}>{t.noRun}</p>}
        <div style={sx('display:flex; flex-direction:column;')}>
          {vm.panelSteps.map((cs, i) => (
            <div key={i} style={sx('display:flex; gap:12px;')}>
              <div style={sx('display:flex; flex-direction:column; align-items:center;')}>
                <StepDot cs={cs} />
                {cs.notLast && <span style={sx(`width:2px; flex:1; min-height:14px; background:${cs.line};`)} />}
              </div>
              <div style={sx('display:flex; flex-direction:column; gap:1px; padding-bottom:14px; min-width:0;')}>
                <span style={sx(`font-size:13px; font-weight:500; color:${cs.labelFg};`)}>{cs.label}</span>
                <span style={sx(`font-size:11px; color:${cs.stFg};`)}>{cs.stLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section style={sx('display:flex; flex-direction:column; gap:10px; border-top:1px solid #222B37; padding-top:18px;')}>
        <h3 style={sx('margin:0; font-size:14px; font-weight:600;')}>{t.diagSummary}</h3>
        {vm.noDiag && <p style={sx('margin:0; color:#8B98A9; font-size:13px;')}>{t.noDiag}</p>}
        {vm.diagCauses.map((cz, i) => (
          <div key={i} style={sx('display:flex; gap:8px; align-items:flex-start; font-size:13px; line-height:1.5;')}>
            <span style={sx(`flex:none; padding:1px 6px; border-radius:8px; background:${cz.likBg}; color:${cz.likFg}; font-size:11px;`)}>{cz.likLabel}</span>
            <span>{cz.title}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}

export function ChatPage({ vm }: { vm: VM }) {
  const t = vm.t;
  return (
    <div style={sx('display:flex; flex:1; min-height:0; overflow:hidden;')}>
      <section style={sx('flex:1; min-width:0; min-height:0; display:flex; flex-direction:column;')}>
        <div style={sx(`margin:12px ${GUTTER} 0; padding:8px 14px; background:rgba(251,191,36,0.07); color:#FCD34D; font-size:12px; border:1px solid rgba(251,191,36,0.18); border-radius:12px; line-height:1.5; display:flex; align-items:center; gap:12px;`)}>
          <span style={sx('flex:1; min-width:0;')}>{vm.sourceBanner}</span>
          <button onClick={vm.togglePanel} style={sx('flex:none; border:1px solid #4A3A14; background:#2A2110; color:#FBBF24; border-radius:8px; padding:4px 10px; font-size:12px; cursor:pointer; white-space:nowrap;')}>{vm.panelToggleLabel}</button>
        </div>
        <div ref={vm.scrollRef} style={sx(`flex:1; overflow:auto; padding:28px ${GUTTER}; display:flex; flex-direction:column; gap:22px;`)}>
          {vm.chatEmpty && (
            <div style={sx('margin:auto; max-width:520px; display:flex; flex-direction:column; gap:14px; align-items:center; text-align:center; padding:40px 0;')}>
              <h2 style={sx('margin:0; font-size:22px; font-weight:600;')}>{t.chatEmptyTitle}</h2>
              <p style={sx('margin:0; color:#8B98A9; line-height:1.6;')}>{t.dashSub}</p>
              <div style={sx('display:flex; flex-wrap:wrap; gap:8px; justify-content:center;')}>
                {vm.examples.map((ex, i) => (
                  <button key={i} onClick={ex.go} style={sx('border:1px solid #2A3442; background:rgba(255,255,255,0.02); border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; color:#E6EDF5; white-space:nowrap;')}>{ex.text}</button>
                ))}
              </div>
            </div>
          )}
          {vm.messages.map(m => <Message key={m.id} m={m} vm={vm} />)}
        </div>
        <div style={sx(`padding:8px ${GUTTER} 18px; display:flex; flex-direction:column; gap:10px;`)}>
          {vm.quoteHas && (
            <div style={sx('display:flex; align-items:center; gap:12px; padding:8px; padding-inline-start:14px; background:#1E2733; color:#F1F5F9; border-radius:12px; font-size:13px;')}>
              <span style={sx('flex:1; min-width:0;')}>{vm.quoteBarText}</span>
              <button onClick={vm.goQuote} style={sx(`border:none; border-radius:10px; padding:8px 14px; ${PRIMARY} font-weight:600; font-size:13px; cursor:pointer; white-space:nowrap;`)}>{t.openQuote}</button>
            </div>
          )}
          <div style={sx('display:flex; gap:10px; align-items:flex-end; padding:8px; padding-inline-start:18px; background:#121821; border:1px solid #2A3442; border-radius:22px; box-shadow:0 14px 36px -16px rgba(0,0,0,0.8);')}>
            <textarea value={vm.draft} onChange={vm.onDraft} onKeyDown={vm.onDraftKey} placeholder={t.placeholder} rows={2} style={sx('flex:1; min-width:0; resize:none; padding:10px 0; border:none; border-radius:0; background:transparent; font-size:15px; line-height:1.6; color:#E6EDF5; outline:none; box-shadow:none;')} />
            {vm.notBusy && (
              <button onClick={vm.sendDraft} disabled={vm.sendDisabled} style={sx(`min-height:46px; padding:0 22px; border:none; border-radius:16px; background:${vm.sendBg}; color:${vm.sendFg}; font-size:15px; font-weight:600; cursor:pointer;`)}>{t.send}</button>
            )}
            {vm.busy && (
              <button onClick={vm.stopRun} style={sx('min-height:48px; padding:0 18px; border:none; border-radius:12px; background:#1E2733; color:#F1F5F9; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap;')}>
                <span style={sx('width:10px; height:10px; background:#F97316; border-radius:2px;')} />{t.stop}
              </button>
            )}
          </div>
          <span style={sx('font-size:11px; color:#7C8A9C;')}>{t.composerHint}</span>
        </div>
      </section>
      {vm.showPanel && <ContextPanel vm={vm} />}
    </div>
  );
}

