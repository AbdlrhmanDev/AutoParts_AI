import { sx } from '../../lib/sx';
import { Segmented } from '../ui/Buttons';
import type { ViewModel } from '../../types';

export function Header({ vm }: { vm: ViewModel }) {
  return (
    <>
      <header style={sx('height:64px; flex:none; display:flex; align-items:center; gap:16px; padding:0 32px; border-bottom:1px solid #141B24; background:rgba(11,15,20,0.55); backdrop-filter:blur(12px);')}>
        <h1 style={sx('margin:0; font-size:20px; font-weight:600; letter-spacing:-0.01em; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{vm.pageTitle}</h1>
        <Segmented items={vm.langBtns} pad="6px 10px" />
      </header>
      {vm.dbError && (
        <div role="alert" style={sx('margin:12px 32px 0; padding:10px 14px; background:#2A1215; color:#FCA5A5; border:1px solid #7F1D1D; border-radius:12px; font-size:13px; line-height:1.5;')}>
          {vm.t.dbError}
        </div>
      )}
    </>
  );
}
