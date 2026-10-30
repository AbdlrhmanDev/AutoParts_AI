import { sx, PRIMARY, CARD } from '../lib/sx';
import type { ViewModel as VM } from '../types';

export function DashboardPage({ vm }: { vm: VM }) {
  const t = vm.t;
  return (
    <div style={sx('padding:32px; display:flex; flex-direction:column; gap:28px; max-width:1180px; width:100%;')}>
      <section style={sx('background:#10161E; color:#F1F5F9; border:1px solid #1C2430; border-radius:20px; padding:36px; display:flex; flex-direction:column; gap:20px; background-image:radial-gradient(600px 220px at 85% 0%, rgba(249,115,22,0.10), transparent 70%);')}>
        <div style={sx('display:flex; flex-direction:column; gap:6px;')}>
          <h2 style={sx('margin:0; font-size:32px; font-weight:700; letter-spacing:-0.01em; text-wrap:pretty;')}>{t.dashHello}</h2>
          <p style={sx('margin:0; color:#A9B4C2; font-size:15px; max-width:640px; text-wrap:pretty;')}>{t.dashSub}</p>
        </div>
        <div style={sx('display:flex; gap:10px; flex-wrap:wrap;')}>
          <input value={vm.dashDraft} onChange={vm.onDashDraft} onKeyDown={vm.onDashKey} placeholder={t.placeholder} style={sx('flex:1; min-width:240px; padding:15px 22px; border:1px solid #2A3442; border-radius:999px; background:#0B0F14; color:#F1F5F9; font-size:15px; outline:none;')} />
          <button onClick={vm.dashStart} style={sx(`padding:0 30px; min-height:52px; border:none; border-radius:999px; ${PRIMARY} font-size:15px; font-weight:600; cursor:pointer;`)}>{t.start}</button>
        </div>
        <div style={sx('display:flex; flex-wrap:wrap; gap:8px; align-items:center;')}>
          <span style={sx('font-size:12px; color:#7C8A9C;')}>{t.tryThis}</span>
          {vm.examples.map((ex, i) => (
            <button key={i} onClick={ex.go} style={sx('border:1px solid #2A3442; background:rgba(255,255,255,0.02); color:#CBD5E1; border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; white-space:nowrap;')}>{ex.text}</button>
          ))}
        </div>
      </section>
      <div style={sx('display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;')}>
        <section style={sx(CARD + 'gap:12px;')}>
          <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{t.savedVehicles}</h3>
          {vm.noVehicles && <p style={sx('margin:0; color:#8B98A9; line-height:1.6;')}>{t.noVehicles}</p>}
          {vm.savedVehicles.map((v, i) => (
            <div key={i} style={sx('display:flex; align-items:center; gap:12px; padding:12px; border:1px solid #1C2430; border-radius:10px; background:#161D27;')}>
              <div style={sx('flex:1; display:flex; flex-direction:column; gap:2px;')}>
                <span style={{ fontWeight: 600 }}>{v.label}</span>
                <span style={sx('font-size:12px; color:#8B98A9;')}>{v.meta}</span>
              </div>
              <button onClick={v.chat} style={sx('border:1px solid #222B37; background:transparent; color:#E6EDF5; border-radius:8px; padding:6px 10px; font-size:13px; cursor:pointer;')}>{t.newChat}</button>
              <button onClick={v.remove} style={sx('border:none; background:transparent; color:#8B98A9; font-size:13px; cursor:pointer;')}>{t.remove}</button>
            </div>
          ))}
        </section>
        <section style={sx(CARD + 'gap:12px;')}>
          <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{t.recentQuotes}</h3>
          {vm.noQuotes && <p style={sx('margin:0; color:#8B98A9; line-height:1.6;')}>{t.noQuotes}</p>}
          {vm.recentQuotes.map((q, i) => (
            <div key={i} style={sx('display:flex; align-items:center; gap:12px; padding:12px; border:1px solid #1C2430; border-radius:10px; background:#161D27;')}>
              <div style={sx('flex:1; display:flex; flex-direction:column; gap:2px;')}>
                <span style={sx("font-family:'IBM Plex Mono', monospace; font-size:13px;")}>{q.no}</span>
                <span style={sx('font-size:12px; color:#8B98A9;')}>{q.meta}</span>
              </div>
              <span style={{ fontWeight: 600 }}>{q.total}</span>
            </div>
          ))}
        </section>
        <section style={sx(CARD + 'gap:12px;')}>
          <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{t.connections}</h3>
          {vm.conns.map((cn, i) => (
            <div key={i} style={sx('display:flex; align-items:flex-start; gap:10px;')}>
              <span style={sx(`width:8px; height:8px; margin-top:6px; border-radius:50%; background:${cn.dot}; flex:none;`)} />
              <div style={sx('display:flex; flex-direction:column; gap:2px;')}>
                <span style={sx('font-weight:600; font-size:13px;')}>{cn.name}</span>
                <span style={sx('font-size:12px; color:#8B98A9; line-height:1.5;')}>{cn.long}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
