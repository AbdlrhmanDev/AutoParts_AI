import { sx, CARD } from '../lib/sx';
import { Segmented } from '../components/ui/Buttons';
import type { ViewModel as VM } from '../types';

const INPUT = 'width:100%; padding:9px 11px; border:1px solid #2A3442; border-radius:8px; font-size:14px; background:#161D27; color:#E6EDF5;';

function Fields({ title, fields }: { title: string; fields: any[] }) {
  return (
    <section style={sx(CARD + 'gap:12px;')}>
      <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{title}</h3>
      {fields.map((f, i) => (
        <label key={i} style={sx('display:flex; flex-direction:column; gap:4px;')}>
          <span style={sx('font-size:12px; color:#8B98A9;')}>{f.label}</span>
          <input value={f.value} onChange={f.onChange} style={sx(INPUT)} />
        </label>
      ))}
    </section>
  );
}

export function SettingsPage({ vm }: { vm: VM }) {
  const t = vm.t;
  return (
    <div style={sx('padding:28px 32px; display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; max-width:1100px; width:100%;')}>
      <section style={sx(CARD + 'gap:16px;')}>
        <div style={sx('display:flex; flex-direction:column; gap:8px;')}>
          <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{t.language}</h3>
          <Segmented items={vm.langBtns} pad="8px 16px" long extra="align-self:flex-start;" />
        </div>
        <div style={sx('display:flex; flex-direction:column; gap:8px;')}>
          <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{t.tax}</h3>
          <label style={sx('display:flex; flex-direction:column; gap:4px;')}>
            <span style={sx('font-size:12px; color:#8B98A9;')}>{t.vatRate}</span>
            <input value={vm.vatRate} onChange={vm.onVat} inputMode="decimal" style={sx(INPUT.replace('width:100%', 'width:120px'))} />
          </label>
          <span style={sx('font-size:12px; color:#8B98A9;')}>{t.currency}: {t.sar}</span>
        </div>
        <button onClick={vm.resetAll} style={sx('align-self:flex-start; border:1px solid #EF4444; color:#EF4444; background:transparent; border-radius:8px; padding:7px 12px; font-size:12px; cursor:pointer;')}>{t.reset}</button>
      </section>
      <Fields title={t.customerInfo} fields={vm.custFields} />
      <Fields title={t.companyInfo} fields={vm.compFields} />
      <section style={sx(CARD + 'gap:12px;')}>
        <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{vm.lang === 'ar' ? 'ذاكرة التفضيلات' : 'Preference memory'}</h3>
        <label style={sx('display:flex; align-items:center; gap:9px; font-size:13px; color:#D8E1EB;')}>
          <input type="checkbox" checked={vm.memoryConsent} onChange={vm.memoryToggle} />
          {vm.lang === 'ar' ? 'أوافق على حفظ تفضيلاتي واستخدامها في الطلبات القادمة' : 'I agree to save and reuse my preferences'}
        </label>
        {vm.memoryConsent && <>
          {vm.preferenceFields.map((field: any) => <label key={field.key} style={sx('display:flex; flex-direction:column; gap:4px;')}><span style={sx('font-size:12px; color:#8B98A9;')}>{field.label}</span><input value={field.value} onChange={field.onChange} style={sx(INPUT)} /></label>)}
          <label style={sx('display:flex; flex-direction:column; gap:4px;')}><span style={sx('font-size:12px; color:#8B98A9;')}>{vm.lang === 'ar' ? 'أولوية الشراء' : 'Buying priority'}</span><select value={vm.buyingPreference} onChange={vm.onBuyingPreference} style={sx(INPUT)}><option value="">—</option><option value="oem">OEM</option><option value="cheap">{vm.lang === 'ar' ? 'الأرخص' : 'Cheapest'}</option></select></label>
        </>}
        <span style={sx('font-size:12px; color:#8B98A9; line-height:1.6;')}>{vm.lang === 'ar' ? 'يمكنك إيقاف الذاكرة في أي وقت؛ عند إيقافها تُمسح التفضيلات المحفوظة.' : 'You can disable memory at any time; disabling it clears saved preferences.'}</span>
      </section>
      <section style={sx(CARD + 'gap:12px;')}>
        <h3 style={sx('margin:0; font-size:15px; font-weight:600;')}>{vm.lang === 'ar' ? 'ذاكرة المحادثة الحالية' : 'Current conversation memory'}</h3>
        {vm.memoryLoading ? <span style={sx('font-size:13px; color:#8B98A9;')}>{vm.lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</span> : vm.conversationMemory ? <>
          <p style={sx('margin:0; font-size:13px; color:#D8E1EB; line-height:1.7; white-space:pre-wrap;')}>{vm.conversationMemory.summary || (vm.lang === 'ar' ? 'لم يُنشأ ملخص نصي بعد.' : 'No text summary yet.')}</p>
          <span style={sx('font-size:12px; color:#8B98A9;')}>{vm.lang === 'ar' ? `تم ضغط ${vm.conversationMemory.summarizedMessageCount} رسالة قديمة.` : `${vm.conversationMemory.summarizedMessageCount} older messages compacted.`}</span>
          {!vm.confirmMemoryClear ? <button onClick={vm.askClearMemory} style={sx('align-self:flex-start; border:1px solid #EF4444; color:#EF4444; background:transparent; border-radius:8px; padding:7px 12px; font-size:12px; cursor:pointer;')}>{vm.lang === 'ar' ? 'مسح ذاكرة هذه المحادثة' : 'Clear this conversation memory'}</button> : <div style={sx('display:flex; flex-direction:column; gap:9px; padding:12px; background:#211417; border:1px solid #512329; border-radius:8px;')}>
            <span style={sx('font-size:12px; color:#FCA5A5;')}>{vm.lang === 'ar' ? 'سيُحذف الملخص والحقائق وذاكرة LangGraph لهذه المحادثة فقط.' : 'This deletes the summary, facts and LangGraph memory for this conversation only.'}</span>
            <div style={sx('display:flex; gap:8px;')}><button onClick={vm.clearConversationMemory} style={sx('border:none; background:#DC2626; color:white; border-radius:7px; padding:7px 12px; cursor:pointer;')}>{vm.lang === 'ar' ? 'تأكيد المسح' : 'Confirm clear'}</button><button onClick={vm.cancelClearMemory} style={sx('border:1px solid #3B4655; background:transparent; color:#D8E1EB; border-radius:7px; padding:7px 12px; cursor:pointer;')}>{vm.lang === 'ar' ? 'إلغاء' : 'Cancel'}</button></div>
          </div>}
        </> : <span style={sx('font-size:13px; color:#8B98A9; line-height:1.6;')}>{vm.lang === 'ar' ? 'لا توجد ذاكرة مضغوطة بعد؛ ستُنشأ تلقائيًا عندما تطول المحادثة.' : 'No compacted memory yet; it will be created automatically as the conversation grows.'}</span>}
      </section>
    </div>
  );
}
