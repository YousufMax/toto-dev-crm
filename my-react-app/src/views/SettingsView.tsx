import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Sheet, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  ShieldCheck, 
  Layers, 
  Sliders,
  Link2,
  Zap,
  Globe,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { api } from '../api';
import { GoogleSheetsConfig, TelegramConfig, SyncConflict } from '../types';
import { useTheme } from '../context/ThemeContext';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(null);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable Sheets state
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [deploymentId, setDeploymentId] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [salesTab, setSalesTab] = useState('Sales_Orders');
  const [expTab, setExpTab] = useState('Expenses');
  const [payTab, setPayTab] = useState('Project_Payouts');

  // Editable Telegram state
  const [salesToken, setSalesToken] = useState('');
  const [salesChatId, setSalesChatId] = useState('');
  const [salesEnabled, setSalesEnabled] = useState(false);

  const [expToken, setExpToken] = useState('');
  const [expChatId, setExpChatId] = useState('');
  const [expEnabled, setExpEnabled] = useState(false);
  const [expThreshold, setExpThreshold] = useState(10000);

  const [payToken, setPayToken] = useState('');
  const [payChatId, setPayChatId] = useState('');
  const [payEnabled, setPayEnabled] = useState(false);

  // Status feedback
  const [statusMsg, setStatusMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [testingBot, setTestingBot] = useState<'sales' | 'expense' | 'payout' | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [syncRes, teleRes] = await Promise.all([
        api.getSyncStatus(),
        api.getTelegramConfig(),
      ]);

      setSheetsConfig(syncRes.config);
      setConflicts(syncRes.conflicts || []);
      setAppsScriptUrl(syncRes.config.appsScriptUrl || '');
      setDeploymentId(syncRes.config.deploymentId || '');
      setSpreadsheetId(syncRes.config.spreadsheetId || '');
      setServiceAccountEmail(syncRes.config.serviceAccountEmail || '');
      setSalesTab(syncRes.config.salesOrdersSheetName || 'Sales_Orders');
      setExpTab(syncRes.config.expensesSheetName || 'Expenses');
      setPayTab(syncRes.config.payoutsSheetName || 'Project_Payouts');

      setTelegramConfig(teleRes.config);
      setSalesChatId(teleRes.config.salesBot.chatId || '');
      setSalesEnabled(teleRes.config.salesBot.enabled);

      setExpChatId(teleRes.config.expenseBot.chatId || '');
      setExpEnabled(teleRes.config.expenseBot.enabled);
      setExpThreshold(teleRes.config.expenseBot.largeExpenseThreshold || 10000);

      setPayChatId(teleRes.config.payoutBot.chatId || '');
      setPayEnabled(teleRes.config.payoutBot.enabled);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSheets = async () => {
    try {
      const payload: any = {
        appsScriptUrl,
        deploymentId,
        spreadsheetId,
        serviceAccountEmail,
        salesOrdersSheetName: salesTab,
        expensesSheetName: expTab,
        payoutsSheetName: payTab,
      };
      if (privateKey) payload.privateKey = privateKey;

      await api.saveSyncConfig(payload);
      setStatusMsg('Google Sheets configuration saved successfully.');
      setTimeout(() => setStatusMsg(''), 4000);
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInitHeaders = async () => {
    try {
      const res = await api.initSheetHeaders();
      alert(res.message);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncNow();
      alert(res.message);
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTelegram = async () => {
    try {
      await api.saveTelegramConfig({
        salesBot: {
          enabled: salesEnabled || Boolean(salesToken && salesChatId),
          botToken: salesToken,
          chatId: salesChatId,
        },
        expenseBot: {
          enabled: expEnabled || Boolean(expToken && expChatId),
          botToken: expToken,
          chatId: expChatId,
          largeExpenseThreshold: expThreshold,
        },
        payoutBot: {
          enabled: payEnabled || Boolean(payToken && payChatId),
          botToken: payToken,
          chatId: payChatId,
        },
      });
      setStatusMsg('Telegram bot settings saved and active successfully.');
      setTimeout(() => setStatusMsg(''), 4000);
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestBot = async (botType: 'sales' | 'expense' | 'payout') => {
    setTestingBot(botType);
    try {
      let tokenToTest = '';
      let chatIdToTest = '';

      if (botType === 'sales') {
        tokenToTest = salesToken;
        chatIdToTest = salesChatId;
      } else if (botType === 'expense') {
        tokenToTest = expToken;
        chatIdToTest = expChatId;
      } else if (botType === 'payout') {
        tokenToTest = payToken;
        chatIdToTest = payChatId;
      }

      const res = await api.sendTelegramTest(botType, tokenToTest, chatIdToTest);
      alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Telegram connection test failed. Please verify Bot Token and Chat IDs.');
    } finally {
      setTestingBot(null);
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: 'keep_sheet' | 'keep_dashboard') => {
    try {
      await api.resolveConflict(conflictId, resolution);
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-blue-400" />
          Integrations & System Settings
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure Google Sheets bidirectional synchronization, 3 independent Telegram notification bots, and conflict resolvers
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {statusMsg}
        </div>
      )}

      {/* Sync Conflict Resolution Center if any */}
      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300">
              {conflicts.length} Pending Synchronization Conflict{conflicts.length > 1 ? 's' : ''}
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            Records were modified in Google Sheets and the Dashboard concurrently. Review differences and pick which source of truth to retain:
          </p>

          <div className="space-y-3">
            {conflicts.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white">
                    {c.entityType} ID: {c.entityId}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolveConflict(c.id, 'keep_sheet')}
                      className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-500"
                    >
                      Use Google Sheets Version
                    </button>
                    <button
                      onClick={() => handleResolveConflict(c.id, 'keep_dashboard')}
                      className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500"
                    >
                      Use Dashboard Version
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                    <span className="text-emerald-400 font-bold block mb-1">Google Sheets Row</span>
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono">
                      {JSON.stringify(c.sheetData, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                    <span className="text-blue-400 font-bold block mb-1">Dashboard Local Record</span>
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono">
                      {JSON.stringify(c.dashboardData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYSTEM APPEARANCE & THEME CONTROL */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/30">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">System Appearance & Desktop Theme</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-slate-800 text-amber-400 border-slate-700">
                  {theme} mode active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Toggle between high-contrast Dark, crisp Light, or automatic PC System default.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
              theme === 'light'
                ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40 text-slate-900 font-bold'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Sun className="h-5 w-5 text-amber-400" />
            <div>
              <span className="text-xs font-bold block">Light Theme</span>
              <span className="text-[10px] text-slate-400">Clean white cards & dark text</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
              theme === 'dark'
                ? 'bg-indigo-500/15 border-indigo-500/60 ring-1 ring-indigo-500/40 text-white font-bold'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Moon className="h-5 w-5 text-indigo-400" />
            <div>
              <span className="text-xs font-bold block">Dark Theme</span>
              <span className="text-[10px] text-slate-400">High contrast navy & slate</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
              theme === 'system'
                ? 'bg-blue-500/15 border-blue-500/60 ring-1 ring-blue-500/40 text-white font-bold'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Monitor className="h-5 w-5 text-blue-400" />
            <div>
              <span className="text-xs font-bold block">System Default</span>
              <span className="text-[10px] text-slate-400">Matches PC Windows theme</span>
            </div>
          </button>
        </div>
      </div>

      {/* SYNC SOURCE-OF-TRUTH RECONCILIATION TELEMETRY */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              sheetsConfig?.lastSyncStatus === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : sheetsConfig?.lastSyncStatus === 'error'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            }`}>
              <Sheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Google Sheets Single Source-of-Truth Telemetry</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                  sheetsConfig?.lastSyncStatus === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : sheetsConfig?.lastSyncStatus === 'error'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : isSyncing
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isSyncing ? 'Syncing...' : sheetsConfig?.lastSyncStatus === 'success' ? 'Synchronized' : sheetsConfig?.lastSyncStatus === 'error' ? 'Sync Failed' : 'Idle'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                The CRM displays exclusively the active records present in Google Sheets. Records deleted in Google Sheets are purged on sync.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Reconciling Dataset...' : 'Sync Now (Reconcile)'}</span>
            </button>
          </div>
        </div>

        {/* Sync Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Active Operational Records</span>
            <span className="text-xl font-black text-white mt-1 block">
              {sheetsConfig?.syncSummary ? sheetsConfig.syncSummary.totalActiveRecords : 'Synchronized'}
            </span>
            <span className="text-[10px] text-slate-400">Strictly matching Google Sheets</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Sales & Orders</span>
            <span className="text-xl font-black text-blue-400 mt-1 block">
              {sheetsConfig?.syncSummary ? sheetsConfig.syncSummary.orders.totalActive : 'Active'}
            </span>
            <span className="text-[10px] text-slate-400">
              {sheetsConfig?.syncSummary ? `+${sheetsConfig.syncSummary.orders.added} new • -${sheetsConfig.syncSummary.orders.removed} removed` : 'ID matching'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Expenses & Costs</span>
            <span className="text-xl font-black text-amber-400 mt-1 block">
              {sheetsConfig?.syncSummary ? sheetsConfig.syncSummary.expenses.totalActive : 'Active'}
            </span>
            <span className="text-[10px] text-slate-400">
              {sheetsConfig?.syncSummary ? `+${sheetsConfig.syncSummary.expenses.added} new • -${sheetsConfig.syncSummary.expenses.removed} removed` : 'ID matching'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Resource Payouts</span>
            <span className="text-xl font-black text-emerald-400 mt-1 block">
              {sheetsConfig?.syncSummary ? sheetsConfig.syncSummary.payouts.totalActive : 'Active'}
            </span>
            <span className="text-[10px] text-slate-400">
              {sheetsConfig?.syncSummary ? `+${sheetsConfig.syncSummary.payouts.added} new • -${sheetsConfig.syncSummary.payouts.removed} removed` : 'ID matching'}
            </span>
          </div>
        </div>

        {/* Detailed Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-slate-950 border border-slate-800/80 px-3.5 py-2.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Last Successful Sync:</span>
            <span className="font-mono text-emerald-400 font-medium">
              {sheetsConfig?.lastSyncedAt ? new Date(sheetsConfig.lastSyncedAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }) + ' (BST)' : 'Not synced yet'}
            </span>
          </div>
          <div className="truncate max-w-md text-slate-400 text-[10px]">
            {sheetsConfig?.lastSyncMessage || 'Ready to synchronize.'}
          </div>
        </div>
      </div>

      {/* SECTION 1: Google Sheets Configuration */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <Sheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google Sheets Integration Layer</h3>
              <p className="text-xs text-slate-400">
                Primary business data source for Sales_Orders, Expenses, and Project_Payouts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInitHeaders}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              title="Create sheet tabs and standard headers automatically"
            >
              Initialize Sheet Tabs
            </button>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Mode 1: Google Apps Script Web App (Recommended & Quick) */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Google Apps Script Web App Connection (Recommended)
              </h4>
            </div>
            {appsScriptUrl ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" /> Connected & Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                Not Connected
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Direct two-way synchronization via your Google Apps Script Web App. Does not require Google Cloud Console service account credentials or private keys.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Apps Script Web App Exec URL <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="url"
                  value={appsScriptUrl}
                  onChange={e => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Deployment ID
              </label>
              <div className="relative">
                <Link2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={deploymentId}
                  onChange={e => setDeploymentId(e.target.value)}
                  placeholder="AKfycbx6QcViFYDS4KN..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mode 2: Google Cloud Console Service Account (Alternative) */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Google Cloud Service Account (Alternative Direct API Access)
            </h4>
          </div>
          <p className="text-[11px] text-slate-400">
            Optional direct Google Sheets API v4 integration using a Service Account JSON private key.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Google Spreadsheet ID
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={e => setSpreadsheetId(e.target.value)}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Found in sheet URL: docs.google.com/spreadsheets/d/<strong>YOUR_SPREADSHEET_ID</strong>/edit
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Service Account Client Email
              </label>
              <input
                type="email"
                value={serviceAccountEmail}
                onChange={e => setServiceAccountEmail(e.target.value)}
                placeholder="toto-crm-sync@your-project.iam.gserviceaccount.com"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Service Account Private Key {sheetsConfig?.hasPrivateKey && <span className="text-emerald-400 font-normal">(Configured)</span>}
              </label>
              <textarea
                rows={1}
                value={privateKey}
                onChange={e => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-white font-mono focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Sheet Tab Names */}
        <div className="pt-2 border-t border-slate-800/80">
          <p className="text-xs font-semibold text-slate-300 mb-2">Worksheet / Tab Names Mapping</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Module A: Sales Tab</label>
              <input
                type="text"
                value={salesTab}
                onChange={e => setSalesTab(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Module B: Expenses Tab</label>
              <input
                type="text"
                value={expTab}
                onChange={e => setExpTab(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Module C: Payouts Tab</label>
              <input
                type="text"
                value={payTab}
                onChange={e => setPayTab(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveSheets}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            Save Google Sheets Configuration
          </button>
        </div>
      </div>

      {/* SECTION 2: Telegram Bots Configuration (3 Independent Bots) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Three Independent Telegram Notification Bots</h3>
            <p className="text-xs text-slate-400">
              Dispatches instant alerts for Sales, Expenses, and Resource Payouts (credentials stored securely on backend)
            </p>
          </div>
        </div>

        {/* BOT 1: Sales & Orders Bot */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-blue-400">BOT 1 — Sales & Orders Telegram Bot</span>
              <span className="text-[10px] text-slate-500">(New orders, payments, delivery updates)</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={salesEnabled}
                  onChange={e => setSalesEnabled(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Active</span>
              </label>
              <button
                type="button"
                onClick={() => handleTestBot('sales')}
                disabled={testingBot === 'sales'}
                className="rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 text-xs hover:bg-blue-600/40"
              >
                {testingBot === 'sales' ? 'Sending...' : 'Test Bot 1'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Bot Token {telegramConfig?.salesBot.hasToken && <span className="text-emerald-400">({telegramConfig.salesBot.botTokenMasked})</span>}
              </label>
              <input
                type="password"
                value={salesToken}
                onChange={e => setSalesToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">Target Chat IDs / Channel Usernames</label>
                {salesChatId && (
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    {salesChatId.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length} Target(s) Configured
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={salesChatId}
                onChange={e => setSalesChatId(e.target.value)}
                placeholder="e.g. -100123456789, @totodevsales, 987654321"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Support multiple Chat IDs separated by commas, semicolons, or new lines.
              </p>
            </div>
          </div>
        </div>

        {/* BOT 2: Expense & Cost Bot */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-rose-400">BOT 2 — Expense & Cost Telegram Bot</span>
              <span className="text-[10px] text-slate-500">(New costs, large expenses, approvals)</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expEnabled}
                  onChange={e => setExpEnabled(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>Active</span>
              </label>
              <button
                type="button"
                onClick={() => handleTestBot('expense')}
                disabled={testingBot === 'expense'}
                className="rounded bg-rose-600/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 text-xs hover:bg-rose-600/40"
              >
                {testingBot === 'expense' ? 'Sending...' : 'Test Bot 2'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Bot Token {telegramConfig?.expenseBot.hasToken && <span className="text-emerald-400">({telegramConfig.expenseBot.botTokenMasked})</span>}
              </label>
              <input
                type="password"
                value={expToken}
                onChange={e => setExpToken(e.target.value)}
                placeholder="Bot Token..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">Target Chat IDs</label>
                {expChatId && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                    {expChatId.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length} Target(s) Configured
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={expChatId}
                onChange={e => setExpChatId(e.target.value)}
                placeholder="e.g. -100123456789, @expenses_channel"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Support multiple Chat IDs separated by commas or new lines.
              </p>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Large Expense Threshold (BDT)</label>
              <input
                type="number"
                value={expThreshold}
                onChange={e => setExpThreshold(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-bold"
              />
            </div>
          </div>
        </div>

        {/* BOT 3: Project Payout Bot */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-400">BOT 3 — Project & Payout Telegram Bot</span>
              <span className="text-[10px] text-slate-500">(Advances, settlements, delayed project alerts)</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payEnabled}
                  onChange={e => setPayEnabled(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Active</span>
              </label>
              <button
                type="button"
                onClick={() => handleTestBot('payout')}
                disabled={testingBot === 'payout'}
                className="rounded bg-amber-600/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 text-xs hover:bg-amber-600/40"
              >
                {testingBot === 'payout' ? 'Sending...' : 'Test Bot 3'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Bot Token {telegramConfig?.payoutBot.hasToken && <span className="text-emerald-400">({telegramConfig.payoutBot.botTokenMasked})</span>}
              </label>
              <input
                type="password"
                value={payToken}
                onChange={e => setPayToken(e.target.value)}
                placeholder="Bot Token..."
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">Target Chat IDs</label>
                {payChatId && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {payChatId.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length} Target(s) Configured
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={payChatId}
                onChange={e => setPayChatId(e.target.value)}
                placeholder="e.g. -100123456789, @payouts_channel"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Support multiple Chat IDs separated by commas or new lines.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveTelegram}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            Save Telegram Settings
          </button>
        </div>
      </div>
    </div>
  );
};
