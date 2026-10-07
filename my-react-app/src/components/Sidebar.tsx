import React from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  ShoppingBag, 
  Receipt, 
  Users, 
  UserCheck, 
  GitBranch, 
  History, 
  Settings,
  Shield,
  UserCog,
  Sliders
} from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

export type NavigationTab = 
  | 'dashboard'
  | 'hourly'
  | 'orders'
  | 'expenses'
  | 'payouts'
  | 'employees'
  | 'relationships'
  | 'audit'
  | 'users'
  | 'roles'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  userRole?: UserRole;
  ordersCount?: number;
  expensesCount?: number;
  payoutsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  ordersCount,
  expensesCount,
  payoutsCount,
}) => {
  const { hasPermission } = useAuth();

  const canDashboard = hasPermission('dashboard', 'view');
  const canReports = hasPermission('reports', 'view');
  const canOrders = hasPermission('orders', 'view');
  const canExpenses = hasPermission('expenses', 'view');
  const canPayouts = hasPermission('payouts', 'view');
  const canEmployees = hasPermission('employees', 'view');
  const canAudit = hasPermission('audit', 'view');
  const canUsers = hasPermission('users', 'view');
  const canRoles = hasPermission('roles', 'view');
  const canSettings = hasPermission('settings', 'view');

  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Executive Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      visible: canDashboard,
    },
    {
      id: 'hourly' as NavigationTab,
      label: 'Hourly & Time Reports',
      icon: <Clock className="h-4 w-4" />,
      visible: canReports,
    },
    {
      section: 'CORE MODULES',
      visible: canOrders || canExpenses || canPayouts,
    },
    {
      id: 'orders' as NavigationTab,
      label: 'Sales & Orders',
      icon: <ShoppingBag className="h-4 w-4" />,
      badge: ordersCount,
      visible: canOrders,
    },
    {
      id: 'expenses' as NavigationTab,
      label: 'Expenses & Costs',
      icon: <Receipt className="h-4 w-4" />,
      badge: expensesCount,
      visible: canExpenses,
    },
    {
      id: 'payouts' as NavigationTab,
      label: 'Resource Payouts',
      icon: <Users className="h-4 w-4" />,
      badge: payoutsCount,
      visible: canPayouts,
    },
    {
      section: 'OPERATIONS & TELEMETRY',
      visible: canEmployees || canOrders || canPayouts,
    },
    {
      id: 'employees' as NavigationTab,
      label: 'Employee Directory',
      icon: <UserCheck className="h-4 w-4" />,
      visible: canEmployees,
    },
    {
      id: 'relationships' as NavigationTab,
      label: 'Relationship Inspector',
      icon: <GitBranch className="h-4 w-4" />,
      visible: canOrders || canPayouts,
    },
    {
      id: 'audit' as NavigationTab,
      label: 'Audit History',
      icon: <History className="h-4 w-4" />,
      visible: canAudit,
    },
    {
      section: 'ADMIN PANEL',
      visible: canUsers || canRoles || canSettings,
    },
    {
      id: 'users' as NavigationTab,
      label: 'User Management',
      icon: <UserCog className="h-4 w-4" />,
      visible: canUsers,
    },
    {
      id: 'roles' as NavigationTab,
      label: 'Roles & Permissions',
      icon: <Shield className="h-4 w-4" />,
      visible: canRoles,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Sync & Bot Settings',
      icon: <Settings className="h-4 w-4" />,
      visible: canSettings,
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col justify-between p-3 min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        {navItems.map((item, idx) => {
          if (!item.visible) return null;

          if ('section' in item) {
            return (
              <div key={idx} className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  {item.section}
                </p>
              </div>
            );
          }

          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Footer Info */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 mt-4 space-y-2">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
          <img
            src="https://cdn.jsdelivr.net/gh/YousufMax/image-server-001@main/toto%20new%20new%20logo.jpg"
            alt="TOTO Dev"
            className="h-6 w-6 rounded-lg object-cover border border-slate-700/50"
          />
          <span className="text-[11px] font-bold text-white tracking-tight">TOTO Dev OS</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Timezone:</span>
          <span className="font-semibold text-slate-300">Asia/Dhaka</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Currency:</span>
          <span className="font-semibold text-slate-300">BDT (৳)</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Storage:</span>
          <span className="font-semibold text-emerald-400">Google Sheets</span>
        </div>
      </div>
    </aside>
  );
};
