import { sx, PRIMARY } from '../../lib/sx';
import { Icon } from '../ui/Icon';
import { BrandMark } from '../ui/BrandMark';
import type { ViewModel } from '../../types';

export function Sidebar({ vm }: { vm: ViewModel }) {
  const t = vm.t;
  return (
    <aside style={sx(`width:${vm.sideW}; flex:none; margin:12px; margin-inline-end:0; background:#0F141B; color:#E6EDF5; border:1px solid #1A222D; border-radius:20px; display:flex; flex-direction:column; gap:28px; padding:20px 12px; height:calc(100vh - 24px); overflow:auto;`)}>
      <div style={sx('display:flex; align-items:center; gap:12px; min-height:42px; padding:0 4px; flex-shrink:0;')}>
        <BrandMark size={40} />
        {vm.showLabels && (
          <div style={sx('display:flex; flex-direction:column; gap:3px; min-width:0; line-height:1.2;')}>
            <div dir="ltr" style={sx('font-weight:650; font-size:15px; letter-spacing:-0.015em; color:#F4F7FA; white-space:nowrap;')}>AutoParts <span style={{ color: '#FB7A22' }}>AI</span></div>
            <div style={sx('font-size:11.5px; line-height:1.35; color:#8B98A9; white-space:nowrap;')}>{t.tagline}</div>
          </div>
        )}
      </div>

      <nav style={sx('display:flex; flex-direction:column; gap:2px; flex-shrink:0;')}>
        {vm.nav.map((item, i) => (
          <button key={i} onClick={item.go} title={item.label} style={sx(`display:flex; align-items:center; gap:12px; padding:11px 12px; border:none; border-radius:12px; background:${item.bg}; color:${item.fg}; font-size:14px; cursor:pointer; text-align:start;`)}>
            <Icon d={item.d} />
            {vm.showLabels && <span style={{ flex: 1 }}>{item.label}</span>}
            {item.hasBadge && (
              <span style={sx(`min-width:20px; padding:1px 6px; border-radius:14px; ${PRIMARY} font-family:'IBM Plex Mono', monospace; font-size:11px; text-align:center;`)}>{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {vm.showLabels && (
        <>
          <div style={sx('display:flex; flex-direction:column; gap:6px; flex-shrink:0;')}>
            <div style={sx('display:flex; align-items:center; justify-content:space-between; padding:0 10px;')}>
              <span style={sx('font-size:12px; color:#7C8A9C; letter-spacing:0.04em;')}>{t.recentChats}</span>
              <button onClick={vm.newChat} style={sx('border:1px solid #222B37; background:transparent; color:#E6EDF5; border-radius:8px; padding:2px 8px; font-size:12px; cursor:pointer; white-space:nowrap;')}>+ {t.newChat}</button>
            </div>
            {vm.convList.map((c, i) => (
              <button key={i} onClick={c.open} style={sx(`display:flex; flex-direction:column; gap:2px; padding:8px 10px; border:none; border-radius:10px; background:${c.bg}; color:#E6EDF5; cursor:pointer; text-align:start;`)}>
                <span style={sx('font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;')}>{c.title}</span>
                <span style={sx('font-size:11px; color:#7C8A9C;')}>{c.meta}</span>
              </button>
            ))}
          </div>
          <div style={sx('margin-top:auto; flex-shrink:0; display:flex; flex-direction:column; gap:6px; padding:12px 10px; border-top:1px solid #222B37;')}>
            {vm.conns.map((cn, i) => (
              <div key={i} title={cn.long} style={sx('display:flex; align-items:center; gap:8px; font-size:11px; color:#7C8A9C;')}>
                <span style={sx(`width:7px; height:7px; border-radius:50%; background:${cn.dot}; flex:none;`)} />
                <span style={{ color: '#E6EDF5' }}>{cn.name}</span>
                <span style={sx('overflow:hidden; text-overflow:ellipsis; white-space:nowrap;')}>{cn.short}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
