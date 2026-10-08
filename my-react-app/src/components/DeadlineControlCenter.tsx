import React, { useState } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Flame, 
  CheckCircle2, 
  DollarSign, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';
import { Order } from '../types';
import { 
  calculateDeadlineInfo, 
  isActiveOrder, 
  DeadlineInfo 
} from '../utils/deadlines';
import { formatCurrency } from '../utils/formatters';

export type DeadlineQuickFilter = 
  | 'all' 
  | 'running' 
  | 'dueToday' 
  | 'due24h' 
  | 'overdue' 
  | 'unpaid' 
  | 'partial' 
  | 'paid' 
  | 'myOrders';

interface DeadlineControlCenterProps {
  orders: Order[];
  activeFilter: DeadlineQuickFilter;
  onSelectFilter: (filter: DeadlineQuickFilter) => void;
  onSelectOrder: (order: Order) => void;
  currentUserSalesRep?: string;
  nowDhaka: Date;
}

export const DeadlineControlCenter: React.FC<DeadlineControlCenterProps> = ({
  orders,
  activeFilter,
  onSelectFilter,
  onSelectOrder,
  currentUserSalesRep,
  nowDhaka,
}) => {
  const [showAttentionQueue, setShowAttentionQueue] = useState(false);
  const [showTodaySection, setShowTodaySection] = useState(false);

  // Compute metrics dynamically from the authoritative synchronized dataset
  const ordersWithDeadlines = orders.map(order => ({
    order,
    isActive: isActiveOrder(order.deliveryStatus),
    deadline: calculateDeadlineInfo(order.targetDeadline, order.deliveryStatus, nowDhaka),
  }));

  const activeOrders = ordersWithDeadlines.filter(o => o.isActive);

  // KPI Calculations
  const activeCount = activeOrders.length;
  const dueTodayOrders = activeOrders.filter(o => o.deadline.isDueToday);
  const dueTodayCount = dueTodayOrders.length;
  
  const due24hOrders = activeOrders.filter(o => o.deadline.isDueWithin24h);
  const due24hCount = due24hOrders.length;

  const overdueOrders = activeOrders.filter(o => o.deadline.isOverdue);
  const overdueCount = overdueOrders.length;

  const awaitingPaymentOrders = orders.filter(
    o => o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partial'
  );
  const awaitingPaymentCount = awaitingPaymentOrders.length;
  const totalAwaitingDue = awaitingPaymentOrders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  const completedOrders = orders.filter(
    o => o.deliveryStatus === 'Completed' || o.deliveryStatus === 'Delivered'
  );
  const completedCount = completedOrders.length;

  // Payment Breakdown
  const unpaidCount = orders.filter(o => o.paymentStatus === 'Unpaid').length;
  const partialCount = orders.filter(o => o.paymentStatus === 'Partial').length;
  const paidCount = orders.filter(o => o.paymentStatus === 'Paid').length;

  // My Orders Count (if rep is assigned)
  const myOrdersCount = currentUserSalesRep
    ? orders.filter(o => o.salesRep.toLowerCase() === currentUserSalesRep.toLowerCase()).length
    : 0;

  // Needs Attention Queue: Overdue -> Critical -> Urgent -> Due Soon
  const attentionQueue = [...activeOrders]
    .filter(o => o.deadline.urgencyRank <= 4) // Overdue, Critical, Urgent, Due Soon
    .sort((a, b) => {
      if (a.deadline.urgencyRank !== b.deadline.urgencyRank) {
        return a.deadline.urgencyRank - b.deadline.urgencyRank;
      }
      return a.deadline.diffMs - b.deadline.diffMs;
    })
    .slice(0, 6);

  // Today's Deadlines Queue sorted by nearest deadline
  const todayDeadlines = [...dueTodayOrders].sort((a, b) => a.deadline.diffMs - b.deadline.diffMs);

  return (
    <div className="space-y-3">
      {/* Control Center Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                  Active Orders & Deadline Control Center
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative deadline tracking, live countdowns & financial risk queue (Asia/Dhaka)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Quick toggle for Needs Attention Queue */}
            {attentionQueue.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAttentionQueue(!showAttentionQueue)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  showAttentionQueue 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm' 
                    : 'bg-slate-800/80 text-rose-400 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-rose-400 animate-bounce" />
                <span>Needs Attention ({attentionQueue.length})</span>
                {showAttentionQueue ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}

            {/* Quick toggle for Today's Deadlines */}
            <button
              type="button"
              onClick={() => setShowTodaySection(!showTodaySection)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                showTodaySection 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                  : 'bg-slate-800/80 text-amber-400 hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>Today ({dueTodayCount})</span>
              {showTodaySection ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* 6 Click-to-Filter KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3.5">
          {/* 1. Active Orders */}
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === 'running' ? 'all' : 'running')}
            className={`text-left p-3 rounded-xl border transition-all ${
              activeFilter === 'running'
                ? 'bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active / Running</span>
              <Zap className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black text-slate-100 mt-1">{activeCount}</div>
            <div className="text-[10px] text-blue-400 font-medium truncate">In Progress / Review</div>
          </button>

          {/* 2. Due Today */}
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === 'dueToday' ? 'all' : 'dueToday')}
            className={`text-left p-3 rounded-xl border transition-all ${
              activeFilter === 'dueToday'
                ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/40'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due Today</span>
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 mt-1">{dueTodayCount}</div>
            <div className="text-[10px] text-slate-400 font-medium truncate">Dhaka Time Standard</div>
          </button>

          {/* 3. Due Within 24 Hours */}
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === 'due24h' ? 'all' : 'due24h')}
            className={`text-left p-3 rounded-xl border transition-all ${
              activeFilter === 'due24h'
                ? 'bg-orange-950/40 border-orange-500/60 shadow-md shadow-orange-500/10 ring-1 ring-orange-500/40'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Due &le; 24h</span>
              <Clock className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div className="text-xl font-black text-orange-400 mt-1">{due24hCount}</div>
            <div className="text-[10px] text-slate-400 font-medium truncate">&le; 24h Remaining</div>
          </button>

          {/* 4. Overdue */}
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === 'overdue' ? 'all' : 'overdue')}
            className={`text-left p-3 rounded-xl border transition-all ${
              activeFilter === 'overdue'
                ? 'bg-rose-950/40 border-rose-500/60 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/40'
                : overdueCount > 0 
                ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-950/30' 
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Overdue</span>
              <AlertTriangle className={`h-3.5 w-3.5 text-rose-400 ${overdueCount > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <div className="text-xl font-black text-rose-400 mt-1">{overdueCount}</div>
            <div className="text-[10px] text-rose-300 font-medium truncate">
              {overdueCount > 0 ? 'Requires Action' : 'All Clear'}
            </div>
          </button>

          {/* 5. Awaiting Payment */}
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === 'unpaid' ? 'all' : 'unpaid')}
            className={`text-left p-3 rounded-xl border transition-all ${
              activeFilter === 'unpaid' || activeFilter === 'partial'
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Awaiting Pay</span>
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-slate-100 mt-1">{awaitingPaymentCount}</div>
            <div className="text-[10px] text-rose-400 font-semibold truncate">
              {formatCurrency(totalAwaitingDue)} Due
            </div>
          </button>

          {/* 6. Completed / Ready */}
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === 'all' ? 'running' : 'all')}
            className="text-left p-3 rounded-xl border bg-slate-950/70 border-slate-800 hover:border-slate-700/80 hover:bg-slate-950 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1">{completedCount}</div>
            <div className="text-[10px] text-slate-400 font-medium truncate">Delivered Yield</div>
          </button>
        </div>

        {/* Quick Filter Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-800/80 mt-3.5 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filters:
          </span>

          <button
            type="button"
            onClick={() => onSelectFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All Orders ({orders.length})
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('running')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'running'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Running ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('dueToday')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'dueToday'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Due Today ({dueTodayCount})
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('due24h')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'due24h'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Due &le; 24h ({due24hCount})
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('overdue')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-sm'
                : overdueCount > 0
                ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:bg-rose-900/40'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Overdue ({overdueCount})
          </button>

          <span className="text-slate-600 mx-1">|</span>

          <button
            type="button"
            onClick={() => onSelectFilter('unpaid')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'unpaid'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Unpaid ({unpaidCount})
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('partial')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'partial'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Partial ({partialCount})
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('paid')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Paid ({paidCount})
          </button>

          {currentUserSalesRep && (
            <button
              type="button"
              onClick={() => onSelectFilter('myOrders')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                activeFilter === 'myOrders'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-950/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/40'
              }`}
              title="Show only orders booked under your Sales Rep code"
            >
              My Orders ({myOrdersCount})
            </button>
          )}
        </div>
      </div>

      {/* EXPANDABLE SECTION: Needs Attention Priority Queue */}
      {showAttentionQueue && attentionQueue.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/15 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Needs Immediate Attention ({attentionQueue.length} Orders)
              </h4>
              <span className="text-[10px] text-slate-400">
                Priority: Overdue &rarr; Critical (&lt;6h) &rarr; Urgent (&le;24h)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAttentionQueue(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {attentionQueue.map(({ order, deadline }) => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/90 p-3 hover:border-slate-700 hover:bg-slate-850 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-400 group-hover:text-blue-300">
                    {order.id}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${deadline.colorClass.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${deadline.colorClass.dot}`} />
                    {deadline.timeRemainingStr}
                  </span>
                </div>

                <div className="mt-1.5">
                  <p className="text-xs font-semibold text-slate-100 truncate">{order.clientName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{order.serviceName}</p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Rep: {order.salesRep}</span>
                  {order.dueAmount > 0 ? (
                    <span className="font-semibold text-rose-400">
                      {formatCurrency(order.dueAmount)} Due
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Fully Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPANDABLE SECTION: Today's Deadlines View */}
      {showTodaySection && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Today's Work & Deadlines (Dhaka Time)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowTodaySection(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>

          {todayDeadlines.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 italic">
              No active orders are due today. All active orders have deadlines on subsequent days or are open.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {todayDeadlines.map(({ order, deadline }) => (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/90 p-3 hover:border-slate-700 hover:bg-slate-850 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {order.id}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${deadline.colorClass.badge}`}>
                      {deadline.timeRemainingStr}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <p className="text-xs font-semibold text-slate-100 truncate">{order.clientName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{order.serviceName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
