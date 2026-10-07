import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  KeyRound,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(usernameOrEmail.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (identifier: string) => {
    setUsernameOrEmail(identifier);
    setPassword('admin123');
    setError('');
  };

  const demoAccounts = [
    {
      title: 'Primary Super Admin (Owner)',
      identifier: 'admin@totodev.com',
      role: 'Super Admin',
      desc: 'Full system control & security configuration',
      badge: '👑 Owner / Primary',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    {
      title: 'Sales Manager',
      identifier: 'rajib@totodev.com',
      role: 'Sales Manager',
      desc: 'Oversees entire sales team orders & performance',
      badge: 'Team Pipeline',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    },
    {
      title: 'Sales Officer',
      identifier: 'tanvir@totodev.com',
      role: 'Sales Officer',
      desc: 'Record-level restricted: sees only assigned orders',
      badge: 'Assigned Only',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    },
    {
      title: 'Finance Manager',
      identifier: 'finance@totodev.com',
      role: 'Finance Manager',
      desc: 'Expense approvals, payouts settlement & financials',
      badge: 'Financial Control',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      title: 'Project Manager',
      identifier: 'hasan@totodev.com',
      role: 'Project Manager',
      desc: 'Milestones, delivery tracking & resource allocations',
      badge: 'Delivery Ops',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    },
    {
      title: 'Employee / Freelancer',
      identifier: 'rahim@freelance.local',
      role: 'Employee',
      desc: 'Restricted worker: sees only own payout records',
      badge: 'Worker Scope',
      badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 transition-colors relative">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4 flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-lg z-20">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
            theme === 'light' ? 'bg-amber-500/10 text-amber-500 font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title="Light Mode"
        >
          <Sun className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
            theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title="Dark Mode"
        >
          <Moon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
            theme === 'system' ? 'bg-blue-500/10 text-blue-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
          title="System Default"
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Login Card */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle accent glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header & Logo */}
          <div className="flex items-center gap-3.5 mb-6">
            <img
              src="https://cdn.jsdelivr.net/gh/YousufMax/image-server-001@main/toto%20new%20new%20logo.jpg"
              alt="TOTO Development Logo"
              className="h-12 w-12 rounded-xl object-cover border border-slate-700/60 shadow-lg shadow-blue-500/20 flex-shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">TOTO Development</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  SECURE OS
                </span>
              </div>
              <p className="text-xs text-slate-400">Centralized Enterprise Management Portal</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold text-white tracking-tight">Sign in to your account</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter your corporate email or username and password to proceed.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address or Username
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. admin@totodev.com or tanvir"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-slate-500">Default: admin123</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Security footnote */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Role-Based Access Control Enabled
            </span>
            <span>Asia/Dhaka</span>
          </div>
        </div>

        {/* Right Column: 1-Click Role Accounts for Evaluation */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Pre-Configured Role Accounts
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">1-Click Fill</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Click any account below to test how the system dynamically restricts modules, actions, and record scoping:
            </p>

            <div className="space-y-2">
              {demoAccounts.map(acc => (
                <button
                  key={acc.identifier}
                  type="button"
                  onClick={() => handleQuickFill(acc.identifier)}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {acc.title}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${acc.badgeColor}`}>
                      {acc.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{acc.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
