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
  Trash2
} from 'lucide-react';
import { Order, OrderPaymentStatus, OrderDeliveryStatus } from '../types';
import { PaymentBadge, DeliveryBadge, SourceBadge } from '../components/Badges';
import { formatCurrency, formatDate, exportToCSV } from '../utils/formatters';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface OrdersViewProps {
  onSelectOrder: (order: Order) => void;
  onOpenNewOrder: () => void;
  userRole: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onSelectOrder,
  onOpenNewOrder,
  userRole,
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
  }, [search, paymentStatus, deliveryStatus, salesRep, startDate, endDate]);

  // Unique sales reps for filter dropdown
  const uniqueReps = Array.from(new Set(orders.map(o => o.salesRep).filter(Boolean)));

  const handleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(o => o.id));
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

  // CSV Export respecting current active filters!
  const handleExportCSV = () => {
    const headers = [
      'Order ID',
      'Booking Date/Time',
      'Target Deadline',
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

    const rows = orders.map(o => [
      o.id,
      o.bookingDate,
      o.targetDeadline,
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
    ]);

    exportToCSV('sales_orders_report', headers, rows);
  };

  // Financial aggregates of currently filtered orders
  const totalFilteredSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalFilteredPaid = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalFilteredDue = orders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
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
            Export CSV ({orders.length})
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

      {/* Financial Bar of Current Filter */}
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
              placeholder="Filter by Order ID, client, service, phone..."
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
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-slate-500 hover:text-white"
            >
              Clear
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

      {/* Main Orders Data Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-3 w-8 text-center">
                  <button onClick={handleSelectAll}>
                    {selectedIds.length === orders.length && orders.length > 0 ? (
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
                <th className="py-3 px-3 text-right">Total (BDT)</th>
                <th className="py-3 px-3 text-right">Paid</th>
                <th className="py-3 px-3 text-right">Due</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3">Delivery</th>
                <th className="py-3 px-3">Source</th>
                {isSuperAdmin && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 12 : 11} className="py-12 text-center text-slate-500">
                    Loading orders from database...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 12 : 11} className="py-12 text-center text-slate-500">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const isSelected = selectedIds.includes(order.id);
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
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                        {formatCurrency(order.paidAmount)}
                      </td>
                      <td className={`py-3 px-3 text-right font-semibold ${
                        order.dueAmount > 0 ? 'text-rose-400' : 'text-slate-500'
                      }`}>
                        {formatCurrency(order.dueAmount)}
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
