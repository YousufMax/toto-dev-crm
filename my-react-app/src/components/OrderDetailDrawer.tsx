import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingBag, 
  Calendar, 
  User, 
  Phone, 
  Clock, 
  DollarSign, 
  CreditCard, 
  FileText, 
  GitBranch, 
  History, 
  Plus, 
  Edit3, 
  Trash2,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { Order, Payout, AuditLog, OrderPaymentStatus, OrderDeliveryStatus } from '../types';
import { PaymentBadge, DeliveryBadge, SourceBadge } from './Badges';
import { formatCurrency, formatDate } from '../utils/formatters';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
  onOrderUpdated: () => void;
  onAddPayoutForOrder: (order: Order) => void;
  onSelectPayout: (payout: Payout) => void;
  userRole: string;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  orderId,
  onClose,
  onOrderUpdated,
  onAddPayoutForOrder,
  onSelectPayout,
  userRole,
}) => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(
    currentUser?.isPrimarySuperAdmin ||
    currentUser?.role === 'Super Admin' ||
    userRole === 'Super Admin'
  );

  const [order, setOrder] = useState<Order | null>(null);
  const [linkedPayouts, setLinkedPayouts] = useState<Payout[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [newPaidAmount, setNewPaidAmount] = useState<number>(0);
  const [newPaymentStatus, setNewPaymentStatus] = useState<OrderPaymentStatus>('Partial');
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Edit Target Deadline state
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [editDeadlineDate, setEditDeadlineDate] = useState('');
  const [editDeadlineTime, setEditDeadlineTime] = useState('18:00');

  const handleDeleteOrder = async () => {
    if (!order) return;
    await api.deleteOrder(order.id, true);
    setIsDeleteModalOpen(false);
    onOrderUpdated();
    onClose();
  };

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }

    setLoading(true);
    api.getOrderById(orderId)
      .then(res => {
        setOrder(res.order);
        setLinkedPayouts(res.linkedPayouts || []);
        setAuditLogs(res.auditLogs || []);
        setNewPaidAmount(res.order.paidAmount);
        setNewPaymentStatus(res.order.paymentStatus);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (!orderId) return null;

  const handleUpdatePayment = async () => {
    if (!order) return;
    try {
      await api.updateOrder(order.id, {
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
      });
      setIsEditingPayment(false);
      onOrderUpdated();
      // Reload drawer
      const res = await api.getOrderById(order.id);
      setOrder(res.order);
      setAuditLogs(res.auditLogs);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateDeliveryStatus = async (status: OrderDeliveryStatus) => {
    if (!order) return;
    try {
      await api.updateOrder(order.id, { deliveryStatus: status });
      setIsUpdatingDelivery(false);
      onOrderUpdated();
      const res = await api.getOrderById(order.id);
      setOrder(res.order);
      setAuditLogs(res.auditLogs);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveDeadline = async () => {
    if (!order) return;
    const formattedDeadline = editDeadlineDate 
      ? `${editDeadlineDate} ${editDeadlineTime || '18:00'}`.trim()
      : '';
    try {
      await api.updateOrder(order.id, { targetDeadline: formattedDeadline });
      setIsEditingDeadline(false);
      onOrderUpdated();
      const res = await api.getOrderById(order.id);
      setOrder(res.order);
      setAuditLogs(res.auditLogs);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-mono text-white">{order?.id || orderId}</h2>
                {order && <SourceBadge source={order.source} />}
              </div>
              <p className="text-xs text-slate-400">{order?.serviceName || 'Order Details'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && order && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                title="Super Admin: Permanently Delete Order"
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading || !order ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Loading order details...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Payment</span>
                  <PaymentBadge status={order.paymentStatus} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Delivery</span>
                  <DeliveryBadge status={order.deliveryStatus} />
                </div>
              </div>

              {/* Delivery Status Quick Changer */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Update Status:</span>
                <select
                  value={order.deliveryStatus}
                  onChange={e => handleUpdateDeliveryStatus(e.target.value as OrderDeliveryStatus)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Review">Review</option>
                  <option value="Revision">Revision</option>
                  <option value="Completed">Completed</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Financial Overview Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  Financial Summary
                </h3>
                <button
                  onClick={() => setIsEditingPayment(!isEditingPayment)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  {isEditingPayment ? 'Cancel' : 'Update Payment'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Total Amount</p>
                  <p className="text-lg font-bold text-white mt-1">{formatCurrency(order.totalAmount)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{order.quantityUnit}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Paid Amount</p>
                  <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(order.paidAmount)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Via {order.paymentMethod}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <p className="text-[11px] text-slate-400">Due Amount</p>
                  <p className={`text-lg font-bold mt-1 ${order.dueAmount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {formatCurrency(order.dueAmount)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {order.dueAmount === 0 ? 'Fully Paid' : 'Outstanding'}
                  </p>
                </div>
              </div>

              {/* Edit Payment Inline Panel */}
              {isEditingPayment && (
                <div className="mt-3 p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-3">
                  <p className="text-xs font-semibold text-blue-300">Update Client Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Paid Amount (BDT)</label>
                      <input
                        type="number"
                        value={newPaidAmount}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setNewPaidAmount(val);
                          if (val >= order.totalAmount) setNewPaymentStatus('Paid');
                          else if (val > 0) setNewPaymentStatus('Partial');
                          else setNewPaymentStatus('Unpaid');
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Payment Status</label>
                      <select
                        value={newPaymentStatus}
                        onChange={e => setNewPaymentStatus(e.target.value as OrderPaymentStatus)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      >
                        <option value="Unpaid">Unpaid</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                        <option value="Refunded">Refunded</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsEditingPayment(false)}
                      className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdatePayment}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500"
                    >
                      Save Payment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Client & Booking Overview */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Client / Brand:</span>
                  <span className="font-semibold text-slate-200">{order.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Client Contact:</span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {order.clientContact || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sales Representative:</span>
                  <span className="font-semibold text-blue-400">{order.salesRep}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Booking Date:</span>
                  <span className="font-semibold text-slate-200">{order.bookingDate}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 block">Target Deadline:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditingDeadline) {
                          // Pre-fill date and time
                          const raw = order.targetDeadline || '';
                          const parts = raw.split(' ');
                          setEditDeadlineDate(parts[0] || '');
                          setEditDeadlineTime(parts[1] || '18:00');
                        }
                        setIsEditingDeadline(!isEditingDeadline);
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {isEditingDeadline ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  {!isEditingDeadline ? (
                    <span className="font-semibold text-amber-400 block mt-0.5">
                      {order.targetDeadline || 'Open (No Deadline)'}
                    </span>
                  ) : (
                    <div className="mt-1 space-y-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="date"
                          value={editDeadlineDate}
                          onChange={e => setEditDeadlineDate(e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white [color-scheme:dark]"
                        />
                        <select
                          value={editDeadlineTime}
                          onChange={e => setEditDeadlineTime(e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-white"
                        >
                          <option value="12:00">12:00 PM</option>
                          <option value="14:00">02:00 PM</option>
                          <option value="16:00">04:00 PM</option>
                          <option value="18:00">06:00 PM</option>
                          <option value="20:00">08:00 PM</option>
                          <option value="22:00">10:00 PM</option>
                          <option value="23:59">11:59 PM</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setEditDeadlineDate('')}
                          className="text-[10px] text-slate-500 hover:text-slate-300"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDeadline}
                          className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block">Payment Method:</span>
                  <span className="font-semibold text-slate-200">{order.paymentMethod}</span>
                </div>
              </div>

              {order.remarks && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-500 block">Remarks / Notes:</span>
                  <p className="text-xs text-slate-300 italic mt-0.5">{order.remarks}</p>
                </div>
              )}
            </div>

            {/* Linked Resource Payouts (Module C Relationship) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-amber-400" />
                  Assigned Resources & Payouts ({linkedPayouts.length})
                </h3>
                <button
                  onClick={() => onAddPayoutForOrder(order)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign Resource
                </button>
              </div>

              {linkedPayouts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                  No resources or payouts linked to this order yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedPayouts.map(payout => (
                    <div
                      key={payout.id}
                      onClick={() => onSelectPayout(payout)}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-amber-500/50 hover:bg-slate-800/40 cursor-pointer transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{payout.id}</span>
                          <span className="text-xs font-semibold text-slate-200">{payout.resourceWorkerName}</span>
                          <span className="text-[10px] text-slate-400">({payout.commissionType})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Status: {payout.deliveryStatus} | Payment: {payout.paymentStatus}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">{formatCurrency(payout.agreedPayoutAmount)}</p>
                        <p className="text-[10px] text-amber-400">Advance: {formatCurrency(payout.advancePaid)} | Due: {formatCurrency(payout.dueFinalPayable)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visual Relationship Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <GitBranch className="h-4 w-4 text-blue-400" />
                Operational Relationship Trail
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 font-medium">
                  Client: {order.clientName}
                </span>
                <span className="text-slate-600">➔</span>
                <span className="rounded bg-blue-950/40 border border-blue-800/40 px-2 py-1 text-blue-300 font-mono font-bold">
                  {order.id}
                </span>
                <span className="text-slate-600">➔</span>
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 font-medium">
                  Rep: {order.salesRep}
                </span>
                <span className="text-slate-600">➔</span>
                <span className="rounded bg-amber-950/40 border border-amber-800/40 px-2 py-1 text-amber-300 font-medium">
                  {linkedPayouts.length > 0 
                    ? linkedPayouts.map(p => p.resourceWorkerName).join(', ') 
                    : 'Awaiting Resource'}
                </span>
              </div>
            </div>

            {/* Activity Timeline / Audit Trail */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <History className="h-4 w-4 text-slate-400" />
                Activity Timeline & Audit History
              </h3>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No activity logged yet.</p>
              ) : (
                <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
                  {auditLogs.map((log, idx) => (
                    <div key={log.id || idx} className="relative text-xs">
                      <span className="absolute -left-6 top-1 h-2 w-2 rounded-full bg-blue-500 ring-4 ring-slate-900" />
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-slate-200">
                          {log.action} by {log.changedBy}
                        </span>
                        <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                      </div>
                      <p className="text-slate-400 mt-0.5">
                        {log.details || (log.fieldChanged ? `${log.fieldChanged}: ${log.previousValue} → ${log.newValue}` : log.action)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Super Admin Delete Confirmation Modal */}
      {isDeleteModalOpen && order && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteOrder}
          title="Delete Order Record"
          recordId={order.id}
          recordDescription={`${order.clientName} — ${order.serviceName} (৳${order.totalAmount?.toLocaleString()})`}
          moduleName="Sales Order"
        />
      )}
    </div>
  );
};
