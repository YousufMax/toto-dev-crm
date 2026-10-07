import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { HourlyReportView } from './views/HourlyReportView';
import { OrdersView } from './views/OrdersView';
import { ExpensesView } from './views/ExpensesView';
import { PayoutsView } from './views/PayoutsView';
import { EmployeesView } from './views/EmployeesView';
import { AuditLogView } from './views/AuditLogView';
import { SettingsView } from './views/SettingsView';
import { UsersView } from './views/UsersView';
import { RolesView } from './views/RolesView';
import { LoginView } from './views/LoginView';

import { OrderDetailDrawer } from './components/OrderDetailDrawer';
import { AddOrderModal } from './components/AddOrderModal';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AddPayoutModal } from './components/AddPayoutModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { RelationshipModal } from './components/RelationshipModal';

import { Order, Expense, Payout, User } from './types';
import { api, setActiveUser } from './api';

function AppContent() {
  const { user: currentUser, isAuthenticated, isLoading: authLoading, switchUser, hasPermission } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [users, setUsers] = useState<User[]>([]);

  // Orders, Expenses, Payouts cache for counts & selectors
  const [orders, setOrders] = useState<Order[]>([]);
  const [expensesCount, setExpensesCount] = useState<number>(0);
  const [payoutsCount, setPayoutsCount] = useState<number>(0);
  const [categories, setCategories] = useState<string[]>([]);

  // Modals & Drawers
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  const [payoutInitialOrder, setPayoutInitialOrder] = useState<Order | null>(null);
  
  // Relationship Modal
  const [relationshipOrder, setRelationshipOrder] = useState<Order | null>(null);
  const [relationshipPayouts, setRelationshipPayouts] = useState<Payout[]>([]);

  // Sync Telemetry
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [conflictsCount, setConflictsCount] = useState<number>(0);

  // Initial Data Fetch
  const refreshCoreState = async () => {
    try {
      const [uRes, oRes, eRes, pRes, syncRes, catRes] = await Promise.allSettled([
        api.getUsers(),
        api.getOrders(),
        api.getExpenses(),
        api.getPayouts(),
        api.getSyncStatus(),
        api.getCategories(),
      ]);

      if (uRes.status === 'fulfilled') setUsers(uRes.value.users || []);
      if (oRes.status === 'fulfilled') setOrders(oRes.value.orders || []);
      if (eRes.status === 'fulfilled') setExpensesCount(eRes.value.count || 0);
      if (pRes.status === 'fulfilled') setPayoutsCount(pRes.value.count || 0);
      if (catRes.status === 'fulfilled') setCategories(catRes.value.categories || []);

      if (syncRes.status === 'fulfilled') {
        setSyncStatus(syncRes.value.config?.lastSyncStatus || 'idle');
        setLastSyncedAt(syncRes.value.config?.lastSyncedAt || '');
        setConflictsCount(syncRes.value.pendingConflictsCount || 0);
      }
    } catch (err) {
      console.error('[App] Failed to load core system state:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshCoreState();
    }
  }, [isAuthenticated, currentUser?.id]);

  // Adjust active tab if user lacks permission for currentTab
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Check permission for current tab
    const tabModuleMap: Record<NavigationTab, string> = {
      dashboard: 'dashboard',
      hourly: 'reports',
      orders: 'orders',
      expenses: 'expenses',
      payouts: 'payouts',
      employees: 'employees',
      relationships: 'orders',
      audit: 'audit',
      users: 'users',
      roles: 'roles',
      settings: 'settings',
    };

    const targetModule = tabModuleMap[currentTab];
    if (targetModule && !hasPermission(targetModule as any, 'view')) {
      // Find first accessible tab
      const candidateTabs: NavigationTab[] = [
        'dashboard',
        'orders',
        'payouts',
        'expenses',
        'employees',
        'hourly',
        'audit',
        'users',
        'roles',
        'settings'
      ];
      const firstAllowed = candidateTabs.find(tab => {
        const mod = tabModuleMap[tab];
        return hasPermission(mod as any, 'view');
      });
      if (firstAllowed) {
        setCurrentTab(firstAllowed);
      }
    }
  }, [currentUser?.roleId, isAuthenticated]);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Role Switch
  const handleSwitchUser = async (user: User) => {
    try {
      await switchUser(user);
      refreshCoreState();
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Google Sheets Sync
  const handleSyncSheets = async () => {
    setIsSyncing(true);
    setSyncStatus('syncing');
    try {
      const res = await api.syncNow();
      setSyncStatus(res.success ? 'success' : 'error');
      refreshCoreState();
    } catch (err) {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Open Relationship Graph for any order
  const handleInspectRelationship = async (order: Order) => {
    try {
      const res = await api.getOrderById(order.id);
      setRelationshipOrder(res.order);
      setRelationshipPayouts(res.linkedPayouts || []);
    } catch (err) {
      setRelationshipOrder(order);
      setRelationshipPayouts([]);
    }
  };

  // Loading Splash Screen while verifying auth token
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app,#0b0f17)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img
            src="https://cdn.jsdelivr.net/gh/YousufMax/image-server-001@main/toto%20new%20new%20logo.jpg"
            alt="TOTO Development"
            className="h-16 w-16 rounded-2xl object-cover border border-slate-700 shadow-xl shadow-blue-500/20"
          />
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Loading TOTO Development Operations OS...
          </p>
        </div>
      </div>
    );
  }

  // If unauthenticated, show high-trust Login view
  if (!isAuthenticated || !currentUser) {
    return <LoginView />;
  }

  // Unique sales reps
  const salesReps = Array.from(new Set(
    users.filter(u => u.role === 'Sales Representative' || u.role === 'Sales Manager' || u.salesRepCode)
      .map(u => u.salesRepCode || u.name)
      .concat(['Rajib', 'Tanvir'])
  ));

  return (
    <div className="min-h-screen bg-[var(--bg-app,#0b0f17)] text-[var(--text-main,#f8fafc)] flex flex-col antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Top Application Header */}
      <Navbar
        users={users}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onOpenSearch={() => setIsSearchOpen(true)}
        onSyncSheets={handleSyncSheets}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        conflictsCount={conflictsCount}
        onOpenConflicts={() => setCurrentTab('settings')}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          userRole={currentUser.role}
          ordersCount={orders.length}
          expensesCount={expensesCount}
          payoutsCount={payoutsCount}
        />

        {/* Center Main Stage Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              onSelectOrder={order => setSelectedOrderId(order.id)}
              onOpenNewOrder={() => setIsAddOrderOpen(true)}
              onOpenNewExpense={() => setIsAddExpenseOpen(true)}
            />
          )}

          {currentTab === 'hourly' && (
            <HourlyReportView />
          )}

          {currentTab === 'orders' && (
            <OrdersView
              onSelectOrder={order => setSelectedOrderId(order.id)}
              onOpenNewOrder={() => setIsAddOrderOpen(true)}
              userRole={currentUser.role}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesView
              onOpenNewExpense={() => setIsAddExpenseOpen(true)}
              categories={categories}
              userRole={currentUser.role}
            />
          )}

          {currentTab === 'payouts' && (
            <PayoutsView
              onOpenNewPayout={() => {
                setPayoutInitialOrder(null);
                setIsAddPayoutOpen(true);
              }}
              onSelectOrderById={id => setSelectedOrderId(id)}
              userRole={currentUser.role}
            />
          )}

          {currentTab === 'employees' && (
            <EmployeesView
              onSelectOrderById={id => setSelectedOrderId(id)}
            />
          )}

          {currentTab === 'relationships' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Operational Relationship Inspector</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select an order below to visualize the end-to-end operational pathway from Client ➔ Order ➔ Rep ➔ Worker ➔ Payout ➔ Settlement
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orders.map(o => (
                  <div
                    key={o.id}
                    onClick={() => handleInspectRelationship(o)}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/50 hover:bg-slate-800/40 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400">{o.id}</span>
                      <span className="text-[11px] text-emerald-400 font-bold">৳{o.totalAmount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-bold text-white">{o.clientName}</p>
                    <p className="text-[11px] text-slate-400">{o.serviceName} • Rep: {o.salesRep}</p>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-blue-400 font-medium">
                      <span>Inspect Tree</span>
                      <span>➔</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'audit' && (
            <AuditLogView />
          )}

          {currentTab === 'users' && (
            <UsersView />
          )}

          {currentTab === 'roles' && (
            <RolesView />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Global Command Palette / Search Modal (Cmd+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectOrder={order => setSelectedOrderId(order.id)}
        onSelectExpense={exp => {
          setCurrentTab('expenses');
        }}
        onSelectPayout={pay => {
          setCurrentTab('payouts');
        }}
      />

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onOrderUpdated={refreshCoreState}
        onAddPayoutForOrder={order => {
          setPayoutInitialOrder(order);
          setIsAddPayoutOpen(true);
        }}
        onSelectPayout={payout => {
          setSelectedOrderId(null);
          setCurrentTab('payouts');
        }}
        userRole={currentUser.role}
      />

      {/* Create Order Modal */}
      <AddOrderModal
        isOpen={isAddOrderOpen}
        onClose={() => setIsAddOrderOpen(false)}
        onOrderCreated={newOrder => {
          refreshCoreState();
          setSelectedOrderId(newOrder.id);
        }}
        salesReps={salesReps}
      />

      {/* Record Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onExpenseCreated={() => {
          refreshCoreState();
          setCurrentTab('expenses');
        }}
        categories={categories}
        onCategoryAdded={cat => setCategories(prev => [...prev, cat])}
      />

      {/* Create Resource Payout Modal */}
      <AddPayoutModal
        isOpen={isAddPayoutOpen}
        onClose={() => {
          setIsAddPayoutOpen(false);
          setPayoutInitialOrder(null);
        }}
        onPayoutCreated={() => {
          refreshCoreState();
          setCurrentTab('payouts');
        }}
        initialOrder={payoutInitialOrder}
        existingOrders={orders}
      />

      {/* Relationship Graph Modal */}
      <RelationshipModal
        isOpen={Boolean(relationshipOrder)}
        onClose={() => setRelationshipOrder(null)}
        order={relationshipOrder}
        linkedPayouts={relationshipPayouts}
      />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
