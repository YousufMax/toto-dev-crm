import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Download, 
  DollarSign, 
  ExternalLink,
  CheckCircle,
  Clock,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { Payout, Order } from '../types';
import { PaymentBadge, DeliveryBadge, ApprovalBadge, SourceBadge } from '../components/Badges';
import { formatCurrency, formatDate, exportToCSV } from '../utils/formatters';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface PayoutsViewProps {
  onOpenNewPayout: () => void;
  onSelectOrderById: (orderId: string) => void;
  userRole: string;
}

export const PayoutsView: React.FC<PayoutsViewProps> = ({
  onOpenNewPayout,
  onSelectOrderById,
  userRole,
}) => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(
    currentUser?.isPrimarySuperAdmin ||
    currentUser?.role === 'Super Admin' ||
    userRole === 'Super Admin'
  );

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutToDelete, setPayoutToDelete] = useState<Payout | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [worker, setWorker] = useState('All');
  const [deliveryStatus, setDeliveryStatus] = useState('All');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [commissionType, setCommissionType] = useState('All');

  // Quick Pay Modal State
  const [payModalItem, setPayModalItem] = useState<Payout | null>(null);
  const [payType, setPayType] = useState<'advance' | 'final'>('advance');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('bKash');
  const [payTxn, setPayTxn] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (worker !== 'All') params.worker = worker;
      if (deliveryStatus !== 'All') params.deliveryStatus = deliveryStatus;
      if (paymentStatus !== 'All') params.paymentStatus = paymentStatus;
      if (commissionType !== 'All') params.commissionType = commissionType;

      const res = await api.getPayouts(params);
      setPayouts(res.payouts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [search, worker, deliveryStatus, paymentStatus, commissionType]);

  const uniqueWorkers = Array.from(new Set(payouts.map(p => p.resourceWorkerName).filter(Boolean)));

  const handleOpenPayModal = (payout: Payout, type: 'advance' | 'final') => {
    setPayModalItem(payout);
    setPayType(type);
    setPayAmount(type === 'final' ? payout.dueFinalPayable : 1000);
    setPayMethod(payout.paymentMethod || 'bKash');
    setPayTxn('');
  };

  const handleConfirmPayment = async () => {
    if (!payModalItem) return;
    setPaying(true);
    try {
      await api.payPayout(payModalItem.id, {
        type: payType,
        amount: payAmount,
        paymentMethod: payMethod,
        transactionRefId: payTxn,
      });
      setPayModalItem(null);
      fetchPayouts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmDeletePayout = async () => {
    if (!payoutToDelete) return;
    await api.deletePayout(payoutToDelete.id, true);
    setPayoutToDelete(null);
    fetchPayouts();
  };

  const handleExportCSV = () => {
    const headers = [
      'Payout ID',
      'Project / Order ID',
      'Service Name',
      'Client Name',
      'Resource / Worker Name',
      'Total Project Budget (BDT)',
      'Commission Type',
      'Agreed Payout Amount (BDT)',
      'Advance Paid (BDT)',
      'Due / Final Payable (BDT)',
      'Delivery Status',
      'Payment Status',
      'Payment Method',
      'Transaction / Ref ID',
      'Remarks',
      'Data Source',
    ];

    const rows = payouts.map(p => [
      p.id,
      p.projectOrderId,
      p.serviceName,
      p.clientName,
      p.resourceWorkerName,
      p.totalProjectBudget,
      p.commissionType,
      p.agreedPayoutAmount,
      p.advancePaid,
      p.dueFinalPayable,
      p.deliveryStatus,
      p.paymentStatus,
      p.paymentMethod,
      p.transactionRefId,
      p.remarks,
      p.source,
    ]);

    exportToCSV('resource_payouts_report', headers, rows);
  };

  const totalAgreed = payouts.reduce((sum, p) => sum + (p.agreedPayoutAmount || 0), 0);
  const totalAdvance = payouts.reduce((sum, p) => sum + (p.advancePaid || 0), 0);
  const totalDue = payouts.reduce((sum, p) => sum + (p.dueFinalPayable || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" />
            Module C — Resource & Project Payouts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized with Google Sheets worksheet <span className="font-mono text-emerald-400">Project_Payouts</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export CSV ({payouts.length})
          </button>

          <button
            onClick={onOpenNewPayout}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/30"
          >
            <Plus className="h-3.5 w-3.5" />
            New Payout
          </button>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span className="text-[11px] text-slate-400 block">Total Agreed Payout</span>
          <span className="text-base font-bold text-amber-400">{formatCurrency(totalAgreed)}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span className="text-[11px] text-slate-400 block">Total Advances Disbursed</span>
          <span className="text-base font-bold text-blue-400">{formatCurrency(totalAdvance)}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <span className="text-[11px] text-slate-400 block">Total Outstanding Payable</span>
          <span className="text-base font-bold text-rose-400">{formatCurrency(totalDue)}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Payout ID, Order ID, worker, client..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={worker}
            onChange={e => setWorker(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Resources / Workers</option>
            {uniqueWorkers.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          <select
            value={commissionType}
            onChange={e => setCommissionType(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Commission Types</option>
            <option value="Fixed Commission">Fixed Commission</option>
            <option value="Percentage (%)">Percentage (%)</option>
            <option value="Hourly">Hourly</option>
            <option value="Per Unit">Per Unit</option>
            <option value="Milestone Based">Milestone Based</option>
          </select>

          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
          </select>

          <select
            value={deliveryStatus}
            onChange={e => setDeliveryStatus(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Delivery Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Payout ID</th>
                <th className="py-3 px-4">Parent Order</th>
                <th className="py-3 px-4">Resource / Worker</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Commission</th>
                <th className="py-3 px-4 text-right">Agreed (BDT)</th>
                <th className="py-3 px-4 text-right">Advance Paid</th>
                <th className="py-3 px-4 text-right">Final Due</th>
                <th className="py-3 px-4">Delivery</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-center">Actions</th>
                <th className="py-3 px-4">Source</th>
                {isSuperAdmin && <th className="py-3 px-4 text-center">Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 13 : 12} className="py-12 text-center text-slate-500">
                    Loading payouts from database...
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 13 : 12} className="py-12 text-center text-slate-500">
                    No resource payouts found matching criteria.
                  </td>
                </tr>
              ) : (
                payouts.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {pay.id}
                    </td>
                    <td className="py-3 px-4">
                      {pay.projectOrderId ? (
                        <button
                          onClick={() => onSelectOrderById(pay.projectOrderId)}
                          className="font-mono font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          title="Open Parent Order"
                        >
                          {pay.projectOrderId}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {pay.resourceWorkerName}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {pay.serviceName}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {pay.commissionType}
                      {pay.commissionRate ? ` (${pay.commissionRate}%)` : ''}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {formatCurrency(pay.agreedPayoutAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-400">
                      {formatCurrency(pay.advancePaid)}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      pay.dueFinalPayable > 0 ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {formatCurrency(pay.dueFinalPayable)}
                    </td>
                    <td className="py-3 px-4">
                      <DeliveryBadge status={pay.deliveryStatus} />
                    </td>
                    <td className="py-3 px-4">
                      <PaymentBadge status={pay.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {pay.dueFinalPayable > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenPayModal(pay, 'advance')}
                            className="rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] hover:bg-blue-600/40"
                          >
                            +Advance
                          </button>
                          <button
                            onClick={() => handleOpenPayModal(pay, 'final')}
                            className="rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] hover:bg-emerald-600/40"
                          >
                            Pay Final
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Cleared
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <SourceBadge source={pay.source} />
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setPayoutToDelete(pay)}
                          title="Super Admin: Permanently Delete Payout"
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Delete Confirmation Modal */}
      {payoutToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(payoutToDelete)}
          onClose={() => setPayoutToDelete(null)}
          onConfirm={handleConfirmDeletePayout}
          title="Delete Resource Payout Record"
          recordId={payoutToDelete.id}
          recordDescription={`${payoutToDelete.resourceWorkerName} — ${payoutToDelete.serviceName} (৳${payoutToDelete.agreedPayoutAmount?.toLocaleString()})`}
          moduleName="Resource Payout"
        />
      )}

      {/* Disburse Payment Modal */}
      {payModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              Record {payType === 'final' ? 'Final Settlement' : 'Advance Payment'}
            </h3>
            <p className="text-xs text-slate-400">
              Disbursing payment for {payModalItem.resourceWorkerName} on {payModalItem.projectOrderId}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Payment Amount (BDT)</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Payment Method / Gateway</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Transaction / Reference ID</label>
                <input
                  type="text"
                  value={payTxn}
                  onChange={e => setPayTxn(e.target.value)}
                  placeholder="e.g. TRX998877"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPayModalItem(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={paying}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30"
              >
                {paying ? 'Processing...' : 'Confirm & Disburse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
