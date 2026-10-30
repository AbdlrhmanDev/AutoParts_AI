import { Fragment, useMemo } from 'react';
import { Background, Controls, Handle, MiniMap, Position, ReactFlow } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { sx, MONO } from '../lib/sx';
import { Icon } from '../components/ui/Icon';
import { Segmented, PrimaryBtn } from '../components/ui/Buttons';
import type { ViewModel as VM } from '../types';

function CustomerView({ vm }: { vm: VM }) {
  const { w, cv } = vm;
  return (
    <section style={sx('background:#161D27; border:1px solid #222B37; border-radius:20px; padding:32px; display:flex; flex-direction:column; gap:28px; max-width:1100px; width:100%; margin:0 auto;')}>
      <div style={sx('display:flex; flex-direction:column; gap:6px;')}>
        <span style={sx('font-size:12px; color:#8B98A9;')}>{w.yourRequest}</span>
        <span style={sx('font-size:20px; font-weight:600; line-height:1.5; text-wrap:pretty;')}>{cv.text}</span>
        <span style={sx(`font-size:13px; color:${cv.statusFg};`)}>{cv.statusLine}</span>
      </div>
      <div style={sx('display:flex; flex-wrap:wrap; gap:20px 0;')}>
        {cv.steps.map((cs, i) => (
          <div key={i} style={sx('flex:1 1 150px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center;')}>
            <div style={sx('display:flex; align-items:center; width:100%;')}>
              <span style={sx(`flex:1; height:3px; border-radius:2px; background:${cs.lineIn};`)} />
              <span style={sx(`width:54px; height:54px; flex:none; border-radius:50%; display:grid; place-items:center; background:${cs.bg}; color:${cs.fg}; border:2px solid ${cs.border}; animation:${cs.anim};`)}>
                <Icon d={cs.icon} size={22} sw={1.9} />
              </span>
              <span style={sx(`flex:1; height:3px; border-radius:2px; background:${cs.lineOut};`)} />
            </div>
            <span style={sx(`font-size:15px; font-weight:600; color:${cs.labelFg}; padding:0 8px;`)}>{cs.label}</span>
            <span style={sx(`font-size:12px; font-weight:500; color:${cs.stFg};`)}>{cs.stLabel}</span>
            <span style={sx('font-size:12px; color:#8B98A9; line-height:1.5; padding:0 10px;')}>{cs.note}</span>
          </div>
        ))}
      </div>
      <div style={sx('display:flex; flex-wrap:wrap; gap:10px; padding-top:20px; border-top:1px solid #1C2430;')}>
        {cv.hasProducts && <PrimaryBtn onClick={vm.goProducts}>{w.viewProducts}</PrimaryBtn>}
        {cv.hasQuote && <PrimaryBtn onClick={vm.goQuote}>{w.viewQuote}</PrimaryBtn>}
        <button onClick={vm.toDevView} style={sx('border:1px solid #2A3442; border-radius:10px; padding:10px 16px; background:transparent; color:#E6EDF5; cursor:pointer;')}>{w.toDev}</button>
      </div>
    </section>
  );
}

function WorkflowNode({ data }: any) {
  const n = data.node; const wf = data.wf;
  return (
    <div dir={data.dir} style={sx(`width:220px; height:68px; display:flex; align-items:center; gap:10px; padding:0 12px; border-radius:18px; border:${n.borderW} ${n.borderStyle} ${n.border}; background:${n.bg}; color:${wf.text}; opacity:${n.opacity}; box-shadow:${n.shadow}; animation:${n.anim}; outline:${n.outline}; outline-offset:3px; font-family:inherit; box-sizing:border-box;`)}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span style={sx(`width:38px; height:38px; flex:none; border-radius:11px; display:grid; place-items:center; background:${n.iconBg}; color:${n.iconFg};`)}><Icon d={n.icon} size={18} sw={1.8} /></span>
      <span style={sx('flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;')}>
        <span style={sx('font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{n.label}</span>
        <span style={sx(MONO + `font-size:10.5px; color:${wf.sub}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`)}>{n.tool}</span>
      </span>
      <span style={sx('display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex:none;')}>
        <span style={sx(`font-size:10.5px; font-weight:500; color:${n.stFg}; white-space:nowrap;`)}>{n.stLabel}</span>
        <span style={sx(MONO + `font-size:10px; color:${wf.sub};`)} dir="ltr">{n.ms}</span>
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNode };

function Canvas({ vm }: { vm: VM }) {
  const { wf } = vm;
  const { nodes, edges } = useMemo(() => {
    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: 'TB', ranksep: 58, nodesep: 42, marginx: 30, marginy: 30 });
    vm.wfNodes.forEach((node: any, i: number) => graph.setNode(String(i), { width: 220, height: 68 }));
    vm.wfConnections.forEach((edge: any) => graph.setEdge(String(edge.source), String(edge.target)));
    dagre.layout(graph);
    return {
      nodes: vm.wfNodes.map((node: any, i: number) => { const p = graph.node(String(i)); return { id: String(i), type: 'workflow', position: { x: p.x - 110, y: p.y - 34 }, data: { node, wf, dir: vm.dir } }; }),
      edges: vm.wfConnections.map((edge: any, i: number) => ({
        id: `e${i}`, source: String(edge.source), target: String(edge.target), label: edge.label,
        animated: edge.visual?.anim !== 'none',
        style: { stroke: edge.visual?.color ?? wf.edge, strokeWidth: edge.visual?.w ?? 1.5, opacity: edge.visual?.op ?? 1 },
        labelStyle: { fill: wf.sub, fontSize: 11 }, labelBgStyle: { fill: wf.ctrl, fillOpacity: .92 },
      })),
    };
  }, [vm.wfNodes, vm.wfConnections, vm.dir, wf]);
  return (
    <div style={sx(`position:relative; flex:1 1 560px; min-width:0; min-height:540px; border-radius:20px; overflow:hidden; border:1px solid ${wf.border}; background:${wf.canvas};`)}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12, minZoom: 0.65, maxZoom: 1 }} minZoom={0.3} maxZoom={1.8}
        onNodeClick={(_, node) => (node.data as any).node.select()} colorMode={vm.wfTheme} proOptions={{ hideAttribution: true }}>
        <Background color={wf.dot} gap={22} size={1.2} />
        <Controls position={vm.dir === 'rtl' ? 'bottom-right' : 'bottom-left'} />
        <MiniMap pannable zoomable nodeColor={(node: any) => node.data.node.iconBg} maskColor={vm.wfTheme === 'dark' ? 'rgba(3,7,12,.68)' : 'rgba(230,235,241,.65)'} />
      </ReactFlow>
      <div data-wf-ui="1" style={sx(`position:absolute; top:14px; inset-inline-start:14px; display:flex; flex-wrap:wrap; gap:10px; padding:7px 12px; border-radius:14px; border:1px solid ${wf.border}; background:${wf.ctrl}; font-size:11px; color:${wf.sub}; max-width:calc(100% - 28px);`)}>
        {vm.wfLegend.map((lg, i) => (
          <span key={i} style={sx('display:flex; align-items:center; gap:6px; white-space:nowrap;')}>
            <span style={sx(`width:10px; height:10px; border-radius:3px; background:${lg.bg}; border:1.5px ${lg.style} ${lg.border};`)} />{lg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Inspector({ vm }: { vm: VM }) {
  const { wf, sel, w, src, t } = vm;
  const PRE = MONO + `margin:0; padding:12px 14px; background:${wf.pre}; color:${wf.preFg}; border-radius:12px; font-size:12px; line-height:1.6; white-space:pre-wrap; word-break:break-word;`;
  return (
    <aside style={sx(`flex:0 1 380px; min-width:300px; min-height:540px; display:flex; flex-direction:column; border-radius:20px; border:1px solid ${wf.border}; background:${wf.panel}; color:${wf.text}; overflow:hidden;`)}>
      <div style={sx(`display:flex; align-items:center; gap:12px; padding:16px; border-bottom:1px solid ${wf.panelLine};`)}>
        <span style={sx(`width:42px; height:42px; flex:none; border-radius:16px; display:grid; place-items:center; background:${sel.iconBg}; color:${sel.iconFg};`)}><Icon d={sel.icon} size={20} sw={1.8} /></span>
        <div style={sx('flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;')}>
          <span style={sx('font-size:15px; font-weight:600;')}>{sel.label}</span>
          <span style={sx(MONO + `font-size:11px; color:${wf.sub};`)}>{sel.tool}</span>
        </div>
        <span style={sx(`padding:3px 10px; border-radius:20px; background:${sel.stBg}; color:${sel.stFg}; font-size:12px; font-weight:500; white-space:nowrap;`)}>{sel.stLabel}</span>
      </div>
      <div style={sx(`display:flex; align-items:center; gap:4px; padding:10px 12px; border-bottom:1px solid ${wf.panelLine}; flex-wrap:wrap;`)}>
        {vm.tabBtns.map((b, i) => (
          <button key={i} onClick={b.on} style={sx(`border:none; padding:6px 10px; border-radius:999px; background:${b.bg}; color:${b.fg}; font-size:12px; cursor:pointer; white-space:nowrap;`)}>{b.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={sel.prev} disabled={sel.noPrev} style={sx(`border:1px solid ${wf.panelLine}; background:transparent; color:${sel.prevFg}; border-radius:10px; padding:5px 9px; font-size:12px; cursor:pointer;`)}>{w.prev}</button>
        <button onClick={sel.next} disabled={sel.noNext} style={sx(`border:1px solid ${wf.panelLine}; background:transparent; color:${sel.nextFg}; border-radius:10px; padding:5px 9px; font-size:12px; cursor:pointer;`)}>{w.next}</button>
      </div>
      <div style={sx('flex:1; min-height:0; overflow:auto; padding:16px; display:flex; flex-direction:column; gap:14px;')}>
        {vm.isTabSummary && (
          <>
            <p style={sx('margin:0; font-size:14px; line-height:1.75; text-wrap:pretty;')}>{sel.summary}</p>
            {sel.isShared && <div style={sx(`padding:10px 12px; border-radius:12px; background:${wf.pre}; color:${wf.sub}; font-size:12px; line-height:1.6;`)}>{w.shared}</div>}
            {sel.isFailed && <div style={sx('padding:10px 12px; border-radius:12px; background:#2A1215; color:#FCA5A5; font-size:12px; line-height:1.6; overflow-wrap:anywhere;')}>{sel.errorText}</div>}
            {sel.hasRetries && (
              <div style={sx('display:flex; flex-direction:column; gap:4px; padding:10px 12px; border-radius:12px; border:1px solid #92400E; font-size:12px;')}>
                <span style={{ fontWeight: 600 }}>{w.retries}</span>
                {sel.retries.map(rt => <span key={rt.n} style={sx(MONO + 'font-size:11px; overflow-wrap:anywhere;')}>{rt.n}. {rt.text}</span>)}
              </div>
            )}
            <div style={sx('display:grid; grid-template-columns:auto minmax(0, 1fr); gap:10px 16px; font-size:13px; padding-top:4px;')}>
              {sel.meta.map((mt, i) => (
                <Fragment key={i}>
                  <span style={{ color: wf.sub }}>{mt.k}</span>
                  <span style={sx(MONO + 'font-size:12px; text-align:end; overflow-wrap:anywhere;')}>{mt.v}</span>
                </Fragment>
              ))}
            </div>
          </>
        )}
        {vm.isTabIO && (
          <>
            <span style={sx(`font-size:12px; color:${wf.sub};`)}>{t.input}</span>
            <pre dir="ltr" style={sx(PRE)}>{sel.input}</pre>
            <span style={sx(`font-size:12px; color:${wf.sub};`)}>{t.output}</span>
            <pre dir="ltr" style={sx(PRE)}>{sel.output}</pre>
          </>
        )}
        {vm.isTabSources && (
          <>
            {vm.hasSources && (
              <>
                <div style={sx(`display:flex; flex-direction:column; gap:3px; padding:12px; border-radius:12px; background:${wf.pre};`)}>
                  <span style={sx(`font-size:11px; color:${wf.sub};`)}>{w.provider}</span>
                  <span style={sx('font-size:13px; font-weight:600;')}>{src.provider}</span>
                  <span style={sx(`font-size:11px; color:${wf.sub}; margin-top:6px;`)}>{w.retrieved}</span>
                  <span style={sx(MONO + 'font-size:12px;')}>{src.at}</span>
                </div>
                {src.items.map((it, i) => (
                  <div key={i} style={sx(`display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid ${wf.panelLine}; border-radius:12px;`)}>
                    <div style={sx('flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;')}>
                      <span style={sx(MONO + 'font-size:12px;')} dir="ltr">{it.partNo}</span>
                      <span style={sx(`font-size:12px; color:${wf.sub};`)}>{it.seller}</span>
                    </div>
                    <span style={sx(`font-size:11px; color:${wf.sub}; white-space:nowrap;`)}>{it.url}</span>
                  </div>
                ))}
              </>
            )}
            {vm.noSources && <p style={sx(`margin:0; font-size:13px; color:${wf.sub};`)}>{w.noSources}</p>}
          </>
        )}
      </div>
      <div style={sx(`padding:10px 16px; border-top:1px solid ${wf.panelLine}; font-size:11px; color:${wf.sub}; line-height:1.6;`)}>{w.privacy}</div>
    </aside>
  );
}

export function GraphPage({ vm }: { vm: VM }) {
  const { w } = vm;
  return (
    <div style={sx(`display:flex; flex-direction:column; gap:16px; padding:20px 24px; height:${vm.graphPageH}; min-height:0; overflow:auto;`)}>
      <div style={sx('display:flex; align-items:center; flex-wrap:wrap; gap:12px;')}>
        <div style={sx('display:flex; gap:2px; padding:4px; background:#121821; border:1px solid #1C2430; border-radius:999px;')}>
          {vm.viewBtns.map((b, i) => (
            <button key={i} onClick={b.on} style={sx(`border:none; padding:7px 14px; border-radius:999px; background:${b.bg}; color:${b.fg}; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap;`)}>{b.label}</button>
          ))}
        </div>
        {vm.isDevView && (
          <>
            <div style={sx('display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1; min-width:0;')}>
              <span style={sx('font-size:12px; color:#8B98A9; white-space:nowrap;')}>{w.history}</span>
              {vm.runChips.map((rc, i) => (
                <button key={i} onClick={rc.go} title={rc.title} style={sx(`display:flex; align-items:center; gap:6px; padding:5px 10px; border-radius:10px; border:1px solid ${rc.border}; background:${rc.bg}; color:#E6EDF5; font-size:12px; cursor:pointer; white-space:nowrap;`)}>
                  <span style={sx(`width:7px; height:7px; border-radius:50%; background:${rc.dot}; flex:none;`)} />
                  <span style={sx("font-family:'IBM Plex Mono', 'IBM Plex Sans Arabic', monospace;")}>{rc.label}</span>
                </button>
              ))}
            </div>
            <Segmented items={vm.themeBtns} pad="6px 12px" size={12} />
          </>
        )}
      </div>
      {vm.noRuns && (
        <div style={sx('margin:40px auto; max-width:520px; padding:36px; text-align:center; border:1px dashed #334050; border-radius:18px; display:flex; flex-direction:column; gap:14px; align-items:center;')}>
          <p style={sx('margin:0; color:#8B98A9; line-height:1.7;')}>{w.noRuns}</p>
          <PrimaryBtn onClick={vm.goChat}>{vm.t.goChat}</PrimaryBtn>
        </div>
      )}
      {vm.showCustomerView && <CustomerView vm={vm} />}
      {vm.showDevView && (
        <div style={sx('flex:1; min-height:0; display:flex; flex-wrap:wrap; gap:16px;')}>
          <Canvas vm={vm} />
          <Inspector vm={vm} />
        </div>
      )}
    </div>
  );
}
