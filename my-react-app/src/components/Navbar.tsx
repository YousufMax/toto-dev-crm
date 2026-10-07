import React, { useState } from 'react';
import { 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ShieldCheck, 
  Crown,
  Sun,
  Moon,
  Monitor,
  LogOut,
  User as UserIcon,
  Shield
} from 'lucide-react';
import { User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  users: User[];
  currentUser: User;
  onSwitchUser: (user: User) => void;
  onOpenSearch: () => void;
  onSyncSheets: () => void;
  isSyncing: boolean;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncedAt?: string;
  conflictsCount: number;
  onOpenConflicts: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  users,
  currentUser,
  onSwitchUser,
  onOpenSearch,
  onSyncSheets,
  isSyncing,
  syncStatus = 'idle',
  lastSyncedAt,
  conflictsCount,
  onOpenConflicts,
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 md:px-6 backdrop-blur-md">
      {/* Brand & Workspace Title */}
      <div className="flex items-center gap-3">
        <img
          src="https://cdn.jsdelivr.net/gh/YousufMax/image-server-001@main/toto%20new%20new%20logo.jpg"
          alt="TOTO Development Logo"
          className="h-9 w-9 rounded-xl object-cover border border-slate-700/50 shadow-md shadow-blue-500/10 flex-shrink-0"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white">TOTO Development</h1>
            <span className="hidden sm:inline-block rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
              OPERATIONS OS
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Business, Sales & Financial Control</p>
        </div>
      </div>

      {/* Global Search Button */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <span>Search Order, Voucher, Payout, Client, Worker...</span>
          </div>
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Sync & User Profile & Theme */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Conflicts Alert if any */}
        {conflictsCount > 0 && (
          <button
            onClick={onOpenConflicts}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all animate-pulse"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{conflictsCount} Conflict{conflictsCount > 1 ? 's' : ''}</span>
          </button>
        )}

        {/* Google Sheets Sync Pill & Action */}
        <button
          onClick={onSyncSheets}
          disabled={isSyncing}
          className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all ${
            isSyncing 
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' 
              : syncStatus === 'error'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40'
          }`}
          title={lastSyncedAt ? `Last synced: ${lastSyncedAt}` : 'Sync with Google Sheets'}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
          <span className="hidden sm:inline">
            {isSyncing ? 'Syncing Sheets...' : 'Google Sheets'}
          </span>
          {!isSyncing && <CheckCircle2 className="h-3 w-3 text-emerald-400 opacity-80" />}
        </button>

        {/* Theme Selector Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            title={`Current theme: ${theme} (${resolvedTheme})`}
          >
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-indigo-400" />
            ) : theme === 'light' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Monitor className="h-4 w-4 text-blue-400" />
            )}
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl z-50">
              <button
                onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  theme === 'light' ? 'bg-amber-500/10 text-amber-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Light</span>
              </button>
              <button
                onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  theme === 'system' ? 'bg-blue-500/10 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Monitor className="h-3.5 w-3.5 text-blue-400" />
                <span>System</span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Role Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-700 transition-colors"
          >
            <div className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
              currentUser.isPrimarySuperAdmin 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'bg-slate-800 text-blue-400 border border-slate-700'
            }`}>
              {currentUser.isPrimarySuperAdmin ? (
                <Crown className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                currentUser.name.slice(0, 1)
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1">
                <p className="font-semibold leading-none text-slate-100">{currentUser.name}</p>
                {currentUser.isPrimarySuperAdmin && (
                  <Crown className="h-3 w-3 text-amber-400 inline" />
                )}
              </div>
              <p className="text-[10px] text-blue-400 leading-tight flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />
                {currentUser.role}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                    currentUser.isPrimarySuperAdmin 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                      : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {currentUser.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-white">{currentUser.name}</p>
                      {currentUser.isPrimarySuperAdmin && (
                        <Crown className="h-3 w-3 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">@{currentUser.username || currentUser.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fast RBAC Switcher for testing/demo */}
              <div className="border-t border-slate-800/60 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                  Switch Active Perspective
                </p>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSwitchUser(u);
                        setShowUserDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        u.id === currentUser.id 
                          ? 'bg-blue-600/20 text-blue-300 font-semibold' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div>
                        <p className="flex items-center gap-1">
                          {u.name}
                          {u.isPrimarySuperAdmin && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                        </p>
                        <p className="text-[10px] text-slate-400">{u.role}</p>
                      </div>
                      {u.id === currentUser.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logout Action */}
              <div className="border-t border-slate-800/80 pt-1">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out of CRM</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
