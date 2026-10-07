import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  DollarSign, 
  Receipt, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  ArrowUpRight,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { api } from '../api';
import { DashboardKPIs, Order, Expense, Payout } from '../types';
import { StatCard } from '../components/StatCard';
import { PaymentBadge, DeliveryBadge } from '../components/Badges';
import { formatCurrency, formatDate } from '../utils/formatters';

interface DashboardViewProps {
  onSelectOrder: (order: Order) => void;
  onOpenNewOrder: () => void;
  onOpenNewExpense: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectOrder,
  onOpenNewOrder,
  onOpenNewExpense,
}) => {
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'year' | 'all'>('month');
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [breakdowns, setBreakdowns] = useState<any>({ categoryBreakdown: [], repBreakdown: [] });
  const [loading, setLoading] = useState(true);

  // Compute start/end dates based on preset
  const getDateRange = (): Record<string, string> => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (datePreset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (datePreset === '7days') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: d.toISOString().slice(0, 10), endDate: todayStr };
    }
    if (datePreset === 'month') {
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { startDate: startOfMonth, endDate: todayStr };
    }
    if (datePreset === 'year') {
      return { startDate: `${now.getFullYear()}-01-01`, endDate: todayStr };
    }
    return {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      const [kpiRes, dailyRes, ordersRes, breakRes] = await Promise.all([
        api.getKPIs(range),
        api.getDailyReport(14),
        api.getOrders(),
        api.getBreakdowns(range),
      ]);

      setKpis(kpiRes.kpis);
      setDailyData(dailyRes.dailyData || []);
      setRecentOrders(ordersRes.orders.slice(0, 5));
      setBreakdowns(breakRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [datePreset]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Executive Control Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time business telemetry, sales pipelines, expenses, and operational yields
          </p>
        </div>

        {/* Date Filter Presets */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'year', label: 'This Year' },
            { id: 'all', label: 'All Time' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id as any)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                datePreset === p.id 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales & Pipeline */}
        <StatCard
          title="Total Booked Sales"
          value={formatCurrency(kpis?.sales.totalSales)}
          subtext={`Today: ${formatCurrency(kpis?.sales.todaySales)}`}
          icon={<ShoppingBag className="h-5 w-5 text-blue-400" />}
          color="blue"
          trend={{ value: `${kpis?.sales.ordersCount || 0} Orders`, isPositive: true }}
        />

        {/* Total Collected Revenue */}
        <StatCard
          title="Cash Collected"
          value={formatCurrency(kpis?.sales.totalCollection)}
          subtext={`Receivables: ${formatCurrency(kpis?.sales.totalOutstanding)}`}
          icon={<DollarSign className="h-5 w-5 text-emerald-400" />}
          color="emerald"
          highlight
          trend={{ value: `${formatCurrency(kpis?.sales.todayCollection)} Today`, isPositive: true }}
        />

        {/* Total Operational Expenses */}
        <StatCard
          title="Total Expenses"
          value={formatCurrency(kpis?.expenses.totalExpenses)}
          subtext={`Today: ${formatCurrency(kpis?.expenses.todayExpenseAmount)}`}
          icon={<Receipt className="h-5 w-5 text-rose-400" />}
          color="rose"
          trend={{ value: `${kpis?.expenses.expensesCount || 0} Records`, isPositive: false }}
        />

        {/* Estimated Net Operating Result */}
        <StatCard
          title="Estimated Net Result"
          value={formatCurrency(kpis?.profitability.estimatedOperatingResult)}
          subtext="Cash Collected − Expenses − Payouts"
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          color={kpis && kpis.profitability.estimatedOperatingResult >= 0 ? 'emerald' : 'rose'}
          trend={{ 
            value: `${kpis?.profitability.profitMarginPercent || 0}% Margin`, 
            isPositive: kpis ? kpis.profitability.estimatedOperatingResult >= 0 : true 
          }}
        />
      </div>

      {/* Secondary Quick Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Total Resource Payouts</p>
          <p className="text-base font-bold text-amber-400 mt-0.5">
            {formatCurrency(kpis?.payouts.totalPayoutAgreed)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Advance: {formatCurrency(kpis?.payouts.totalAdvancePaid)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Outstanding Payouts</p>
          <p className="text-base font-bold text-white mt-0.5">
            {formatCurrency(kpis?.payouts.totalDuePayable)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Final due to workers</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Active Workload</p>
          <p className="text-base font-bold text-blue-400 mt-0.5">
            {kpis?.sales.activeOrders || 0} Orders
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">In Progress or Review</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Completed Orders</p>
          <p className="text-base font-bold text-emerald-400 mt-0.5">
            {kpis?.sales.completedOrders || 0} Delivered
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Client Approved</p>
        </div>
      </div>

      {/* Main Chart Section: 14-Day Performance Trend */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Daily Financial Trajectory (Last 14 Days)</h3>
            <p className="text-xs text-slate-400">Sales vs Collections vs Operational Costs</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Booked Sales
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Cash Collected
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expenses
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="collectGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `৳${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => formatCurrency(val)}
              />
              <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" name="Sales" />
              <Area type="monotone" dataKey="collections" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#collectGrad)" name="Collections" />
              <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#expGrad)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Grid: Category Breakdown & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Category Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Expense Distribution by Category</h3>
            <p className="text-xs text-slate-400 mb-4">Major operational cost centers</p>

            <div className="space-y-3">
              {breakdowns.categoryBreakdown.slice(0, 5).map((cat: any, idx: number) => {
                const total = kpis?.expenses.totalExpenses || 1;
                const percent = Math.round((cat.amount / total) * 100);
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{cat.category}</span>
                      <span className="font-bold text-slate-300">{formatCurrency(cat.amount)} ({percent}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-blue-500" 
                        style={{ width: `${percent}%`, backgroundColor: COLORS[idx % COLORS.length] }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Recorded Cost:</span>
            <span className="text-sm font-bold text-rose-400">{formatCurrency(kpis?.expenses.totalExpenses)}</span>
          </div>
        </div>

        {/* Recent High-Priority Orders */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Active Orders</h3>
              <p className="text-xs text-slate-400">Click any row to open full detail drawer</p>
            </div>
            <button
              onClick={onOpenNewOrder}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              + New Order
            </button>
          </div>

          <div className="space-y-2">
            {recentOrders.map(order => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:border-blue-500/50 hover:bg-slate-800/40 cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">{order.id}</span>
                    <span className="text-xs font-bold text-slate-200">{order.clientName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {order.serviceName} • Rep: {order.salesRep}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">{formatCurrency(order.totalAmount)}</p>
                  <div className="mt-1 flex items-center gap-1 justify-end">
                    <DeliveryBadge status={order.deliveryStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
