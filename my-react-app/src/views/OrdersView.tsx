import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  CheckSquare, 
  Square, 
  MoreHorizontal, 
  ArrowUpDown, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet, 
  Trash2,
  Clock,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { Order, OrderPaymentStatus, OrderDeliveryStatus } from '../types';
import { PaymentBadge, DeliveryBadge, SourceBadge } from '../components/Badges';
import { formatCurrency, formatDate, exportToCSV } from '../utils/formatters';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { DeadlineControlCenter, DeadlineQuickFilter } from '../components/DeadlineControlCenter';
import { calculateDeadlineInfo, getDhakaNow, isActiveOrder } from '../utils/deadlines';

interface OrdersViewProps {
  onSelectOrder: (order: Order) => void;
  onOpenNewOrder: () => void;
  userRole: string;
  refreshTrigger?: number;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onSelectOrder,
  onOpenNewOrder,
  userRole,
  refreshTrigger,
}) => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(
    currentUser?.isPrimarySuperAdmin ||
    currentUser?.role === 'Super Admin' ||
    userRole === 'Super Admin'
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // Live Timer grounded in Asia/Dhaka (updates every 30s locally with 0 API calls)
  const [nowDhaka, setNowDhaka] = useState<Date>(() => getDhakaNow());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDhaka(getDhakaNow());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Control Center Quick Filter State
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineQuickFilter>('all');

  // Filters
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [deliveryStatus, setDeliveryStatus] = useState('All');
  const [salesRep, setSalesRep] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Row selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkActing, setIsBulkActing] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (paymentStatus !== 'All') params.paymentStatus = paymentStatus;
      if (deliveryStatus !== 'All') params.deliveryStatus = deliveryStatus;
      if (salesRep !== 'All') params.salesRep = salesRep;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.getOrders(params);
      setOrders(res.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, paymentStatus, deliveryStatus, salesRep, startDate, endDate, refreshTrigger]);

  // Unique sales reps for filter dropdown
  const uniqueReps = Array.from(new Set(orders.map(o => o.salesRep).filter(Boolean)));

  // Client-side Deadline & Status filter pipeline
  const filteredOrders = orders.filter(order => {
    if (deadlineFilter === 'all') return true;
    const isActive = isActiveOrder(order.deliveryStatus);
    const deadline = calculateDeadlineInfo(order.targetDeadline, order.deliveryStatus, nowDhaka);

    if (deadlineFilter === 'running') return isActive;
    if (deadlineFilter === 'dueToday') return isActive && deadline.isDueToday;
    if (deadlineFilter === 'due24h') return isActive && deadline.isDueWithin24h;
    if (deadlineFilter === 'overdue') return isActive && deadline.isOverdue;
    if (deadlineFilter === 'unpaid') return order.paymentStatus === 'Unpaid';
    if (deadlineFilter === 'partial') return order.paymentStatus === 'Partial';
    if (deadlineFilter === 'paid') return order.paymentStatus === 'Paid';
    if (deadlineFilter === 'myOrders') {
      const rep = (currentUser?.salesRepCode || currentUser?.name || '').toLowerCase();
      return order.salesRep.toLowerCase() === rep;
    }
    return true;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = async (delivery?: string, payment?: string) => {
    if (selectedIds.length === 0) return;
    setIsBulkActing(true);
    try {
      await api.bulkUpdateOrders(selectedIds, delivery, payment);
      setSelectedIds([]);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    await api.deleteOrder(orderToDelete.id, true);
    setOrderToDelete(null);
    fetchOrders();
  };

  // CSV Export respecting ALL currently active filters & deadline status!
  const handleExportCSV = () => {
    const headers = [
      'Order ID',
      'Booking Date/Time',
      'Target Deadline',
      'Time Remaining (Dhaka)',
      'Deadline State',
      'Client / Brand Name',
      'Client Contact',
      'Sales Representative',
      'Service / Project Name',
      'Quantity / Unit',
      'Total Amount (BDT)',
      'Paid Amount (BDT)',
      'Due Amount (BDT)',
      'Payment Method',
      'Payment Status',
      'Delivery Status',
      'Remarks',
      'Data Source',
    ];

    const rows = filteredOrders.map(o => {
      const dInfo = calculateDeadlineInfo(o.targetDeadline, o.deliveryStatus, nowDhaka);
      return [
        o.id,
        o.bookingDate,
        o.targetDeadline,
        dInfo.timeRemainingStr,
        dInfo.state,
        o.clientName,
        o.clientContact,
        o.salesRep,
        o.serviceName,
        o.quantityUnit,
        o.totalAmount,
        o.paidAmount,
        o.dueAmount,
        o.paymentMethod,
        o.paymentStatus,
        o.deliveryStatus,
        o.remarks,
        o.source,
      ];
    });

    exportToCSV('sales_orders_report', headers, rows);
  };

  // Financial aggregates of currently filtered orders
  const totalFilteredSales = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalFilteredPaid = filteredOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalFilteredDue = filteredOrders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-blue-400" />
            Module A — Sales & Order Operations
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized with Google Sheets worksheet <span className="font-mono text-emerald-400">Sales_Orders</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
            title="Export filtered records to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export CSV ({filteredOrders.length})
          </button>

          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
          >
            <Plus className="h-3.5 w-3.5" />
            New Order
          </button>
        </div>
      </div>

      {/* ACTIVE ORDERS & DEADLINE CONTROL CENTER */}
      <DeadlineControlCenter
        orders={orders}
        activeFilter={deadlineFilter}
        onSelectFilter={setDeadlineFilter}
        onSelectOrder={onSelectOrder}
        currentUserSalesRep={currentUser?.salesRepCode || currentUser?.name}
        nowDhaka={nowDhaka}
      />

      {/* Financial Bar of Current Active Filter */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span className="text-[11px] text-slate-400 block">Filtered Booked Sales</span>
          <span className="text-base font-bold text-blue-400">{formatCurrency(totalFilteredSales)}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span className="text-[11px] text-slate-400 block">Filtered Collections</span>
          <span className="text-base font-bold text-emerald-400">{formatCurrency(totalFilteredPaid)}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span className="text-[11px] text-slate-400 block">Filtered Outstanding Receivables</span>
          <span className="text-base font-bold text-rose-400">{formatCurrency(totalFilteredDue)}</span>
        </div>
      </div>

      {/* Combinable Multi-Filter Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by Order ID, client, service, phone, notes..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Delivery Status */}
          <select
            value={deliveryStatus}
            onChange={e => setDeliveryStatus(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Delivery Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Review">Review</option>
            <option value="Revision">Revision</option>
            <option value="Completed">Completed</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Payment Status */}
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
            <option value="Refunded">Refunded</option>
          </select>

          {/* Sales Rep Filter */}
          <select
            value={salesRep}
            onChange={e => setSalesRep(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Sales Reps</option>
            {uniqueReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        </div>

        {/* Date Filter Range */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Date:</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          />
          {(startDate || endDate || search || paymentStatus !== 'All' || deliveryStatus !== 'All' || salesRep !== 'All' || deadlineFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setPaymentStatus('All');
                setDeliveryStatus('All');
                setSalesRep('All');
                setStartDate('');
                setEndDate('');
                setDeadlineFilter('all');
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 ml-1 font-semibold"
            >
              Reset All
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Controls */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-blue-950/40 border border-blue-500/30 px-4 py-2 text-xs">
          <span className="text-blue-300 font-semibold">
            {selectedIds.length} orders selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('Completed', undefined)}
              disabled={isBulkActing}
              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Mark Completed
            </button>
            <button
              onClick={() => handleBulkStatusChange(undefined, 'Paid')}
              disabled={isBulkActing}
              className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Mark Paid
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white ml-2"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Main Orders Data Table with Live Deadlines */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-3 w-8 text-center">
                  <button onClick={handleSelectAll}>
                    {selectedIds.length === filteredOrders.length && filteredOrders.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-600" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Order ID</th>
                <th className="py-3 px-3">Client / Brand</th>
                <th className="py-3 px-3">Service</th>
                <th className="py-3 px-3">Sales Rep</th>
                <th className="py-3 px-3">Target Deadline</th>
                <th className="py-3 px-3">Time Remaining</th>
                <th className="py-3 px-3 text-right">Total (BDT)</th>
                <th className="py-3 px-3 text-right">Due / Paid</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3">Delivery Status</th>
                <th className="py-3 px-3">Source</th>
                {isSuperAdmin && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 13 : 12} className="py-12 text-center text-slate-500">
                    Loading orders from database...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 13 : 12} className="py-12 text-center text-slate-500">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isSelected = selectedIds.includes(order.id);
                  const deadline = calculateDeadlineInfo(order.targetDeadline, order.deliveryStatus, nowDhaka);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center" onClick={e => handleToggleSelect(order.id, e)}>
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-400 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-400">
                        {order.id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-100 block">{order.clientName}</span>
                        <span className="text-[10px] text-slate-500">{order.clientContact || 'No contact'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-200 block">{order.serviceName}</span>
                        <span className="text-[10px] text-slate-500">{order.quantityUnit}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {order.salesRep}
                      </td>

                      {/* Target Deadline */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {order.targetDeadline ? (
                          <div>
                            <span className="font-medium text-slate-200 block text-[11px]">
                              {order.targetDeadline}
                            </span>
                            <span className={`text-[10px] font-semibold ${deadline.colorClass.text}`}>
                              {deadline.state}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Open</span>
                        )}
                      </td>

                      {/* Time Remaining Live Countdown */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {deadline.hasDeadline ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${deadline.colorClass.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${deadline.colorClass.dot}`} />
                            {deadline.timeRemainingStr}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">—</span>
                        )}
                      </td>

                      {/* Financials */}
                      <td className="py-3 px-3 text-right font-bold text-slate-100">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {order.dueAmount > 0 ? (
                          <div>
                            <span className="font-bold text-rose-400 block text-[11px]">
                              {formatCurrency(order.dueAmount)} Due
                            </span>
                            <span className="text-[10px] text-emerald-400">
                              Paid: {formatCurrency(order.paidAmount)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-emerald-400 block text-[11px]">
                              Paid In Full
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatCurrency(order.paidAmount)}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <PaymentBadge status={order.paymentStatus} />
                      </td>
                      <td className="py-3 px-3">
                        <DeliveryBadge status={order.deliveryStatus} />
                      </td>
                      <td className="py-3 px-3">
                        <SourceBadge source={order.source} />
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            title="Super Admin: Permanently Delete Order"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Delete Confirmation Modal */}
      {orderToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(orderToDelete)}
          onClose={() => setOrderToDelete(null)}
          onConfirm={handleConfirmDeleteOrder}
          title="Delete Order Record"
          recordId={orderToDelete.id}
          recordDescription={`${orderToDelete.clientName} — ${orderToDelete.serviceName} (৳${orderToDelete.totalAmount?.toLocaleString()})`}
          moduleName="Sales Order"
        />
      )}
    </div>
  );
};
