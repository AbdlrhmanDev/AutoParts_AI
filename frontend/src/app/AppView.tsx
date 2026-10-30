import { sx } from '../lib/sx';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { DashboardPage } from '../pages/DashboardPage';
import { ChatPage } from '../pages/ChatPage';
import { ProductsPage } from '../pages/ProductsPage';
import { QuotePage } from '../pages/QuotePage';
import { GraphPage } from '../pages/GraphPage';
import { SettingsPage } from '../pages/SettingsPage';
import { DeleteProductDialog } from '../components/ui/DeleteProductDialog';
import type { ViewModel } from '../types';

export function AppView({ vm }: { vm: ViewModel }) {
  return (
    <div dir={vm.dir} lang={vm.lang} style={sx("display:flex; height:100vh; overflow:hidden; font-family:'Readex Pro', 'IBM Plex Sans Arabic', system-ui, sans-serif; color:#E6EDF5; background:#0B0F14; font-size:14px;")}>
      <Sidebar vm={vm} />
      <main style={sx('flex:1; min-width:0; min-height:0; height:100vh; display:flex; flex-direction:column; overflow:auto; background:radial-gradient(900px 420px at 0% -10%, rgba(34,211,238,0.06), transparent 60%), radial-gradient(800px 380px at 100% -10%, rgba(249,115,22,0.06), transparent 60%);')}>
        <Header vm={vm} />
        {vm.isDashboard && <DashboardPage vm={vm} />}
        {vm.isChat && <ChatPage vm={vm} />}
        {vm.isProducts && <ProductsPage vm={vm} />}
        {vm.isQuote && <QuotePage vm={vm} />}
        {vm.isGraph && <GraphPage vm={vm} />}
        {vm.isSettings && <SettingsPage vm={vm} />}
      </main>
      <DeleteProductDialog dialog={vm.deleteDialog} />
    </div>
  );
}
