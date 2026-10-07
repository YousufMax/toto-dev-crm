import React, { useState, useEffect } from 'react';
import { X, Users, DollarSign, GitBranch } from 'lucide-react';
import { Payout, Order, CommissionType, OrderDeliveryStatus, OrderPaymentStatus } from '../types';
import { api } from '../api';
import { formatCurrency } from '../utils/formatters';

interface AddPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayoutCreated: (newPayout: Payout) => void;
  initialOrder?: Order | null;
  existingOrders: Order[];
}

export const AddPayoutModal: React.FC<AddPayoutModalProps> = ({
  isOpen,
  onClose,
  onPayoutCreated,
  initialOrder,
  existingOrders,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [clientName, setClientName] = useState('');
  const [resourceWorkerName, setResourceWorkerName] = useState('');
  const [totalProjectBudget, setTotalProjectBudget] = useState<number>(0);
  const [commissionType, setCommissionType] = useState<CommissionType>('Fixed Commission');
  const [commissionRate, setCommissionRate] = useState<number>(30); // 30% default
  const [agreedPayoutAmount, setAgreedPayoutAmount] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [deliveryStatus, setDeliveryStatus] = useState<OrderDeliveryStatus>('In Progress');
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>('Partial');
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [transactionRefId, setTransactionRefId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill when initialOrder is provided or changed
  useEffect(() => {
    if (initialOrder) {
      setSelectedOrderId(initialOrder.id);
      setServiceName(initialOrder.serviceName);
      setClientName(initialOrder.clientName);
      setTotalProjectBudget(initialOrder.totalAmount);
    } else if (existingOrders.length > 0 && !selectedOrderId) {
      const first = existingOrders[0];
      setSelectedOrderId(first.id);
      setServiceName(first.serviceName);
      setClientName(first.clientName);
      setTotalProjectBudget(first.totalAmount);
    }
  }, [initialOrder, existingOrders]);

  // Handle order selection change
  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (orderId === 'NONE' || !orderId) {
      return;
    }
    const found = existingOrders.find(o => o.id === orderId);
    if (found) {
      setServiceName(found.serviceName || '');
      setClientName(found.clientName || '');
      setTotalProjectBudget(found.totalAmount || 0);
      if (commissionType === 'Percentage (%)') {
        setAgreedPayoutAmount(Math.round(((found.totalAmount || 0) * commissionRate) / 100));
      }
    }
  };

  // Recalculate percentage commission if budget or rate changes
  useEffect(() => {
    if (commissionType === 'Percentage (%)' && totalProjectBudget > 0) {
      setAgreedPayoutAmount(Math.round((totalProjectBudget * commissionRate) / 100));
    }
  }, [commissionType, commissionRate, totalProjectBudget]);

  if (!isOpen) return null;

  const dueFinalPayable = Math.max(0, agreedPayoutAmount - advancePaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceWorkerName.trim()) {
      setError('Resource / Worker name is required.');
      return;
    }
    if (agreedPayoutAmount <= 0) {
      setError('Agreed payout amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.createPayout({
        projectOrderId: selectedOrderId === 'NONE' ? '' : selectedOrderId,
        serviceName,
        clientName,
        resourceWorkerName: resourceWorkerName.trim(),
        totalProjectBudget,
        commissionType,
        commissionRate: commissionType === 'Percentage (%)' ? commissionRate : undefined,
        agreedPayoutAmount,
        advancePaid,
        dueFinalPayable,
        deliveryStatus,
        paymentStatus,
        paymentMethod,
        transactionRefId: transactionRefId.trim(),
        remarks: remarks.trim(),
      });

      onPayoutCreated(res.payout);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create payout');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Resource / Project Payout</h2>
              <p className="text-xs text-slate-400">Links resource to Order ID with advance and commission tracking</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          {/* Linked Order ID Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Link to Order ID <span className="text-amber-400">*</span>
              </label>
              <select
                value={selectedOrderId}
                onChange={e => handleOrderChange(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="NONE">-- Independent / No Link --</option>
                {existingOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.id} - {o.clientName} ({o.serviceName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Resource / Worker Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={resourceWorkerName}
                onChange={e => setResourceWorkerName(e.target.value)}
                placeholder="e.g. Freelancer Rahim, Developer Sakib"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Client Name..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Service / Project Name</label>
              <input
                type="text"
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="e.g. Reel, Web Development..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Total Project Budget (BDT) <span className="text-amber-400">*</span>
              </label>
              {selectedOrderId && selectedOrderId !== 'NONE' && (
                <button
                  type="button"
                  onClick={() => {
                    const found = existingOrders.find(o => o.id === selectedOrderId);
                    if (found) {
                      setTotalProjectBudget(found.totalAmount || 0);
                    }
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline font-mono"
                  title="Reset to linked order amount"
                >
                  Sync with Order (৳{(existingOrders.find(o => o.id === selectedOrderId)?.totalAmount || 0).toLocaleString()})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">৳</span>
              <input
                type="number"
                min="0"
                value={totalProjectBudget === 0 ? '' : totalProjectBudget}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                  setTotalProjectBudget(val);
                }}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-7 pr-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Editable project budget used for percentage commission formulas and profit calculations.
            </p>
          </div>

          {/* Commission Calculation */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-amber-400" />
              Commission & Payout Formula
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Commission Type</label>
                <select
                  value={commissionType}
                  onChange={e => setCommissionType(e.target.value as CommissionType)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-white"
                >
                  <option value="Fixed Commission">Fixed Commission</option>
                  <option value="Percentage (%)">Percentage (%)</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Per Unit">Per Unit</option>
                  <option value="Milestone Based">Milestone Based</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {commissionType === 'Percentage (%)' ? (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={commissionRate}
                    onChange={e => setCommissionRate(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-bold"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Agreed Payout (BDT) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={agreedPayoutAmount || ''}
                  onChange={e => setAgreedPayoutAmount(Number(e.target.value))}
                  placeholder="৳0"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-bold focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Advance Paid</label>
                <input
                  type="number"
                  min="0"
                  value={advancePaid || ''}
                  onChange={e => {
                    const adv = Number(e.target.value);
                    setAdvancePaid(adv);
                    if (adv >= agreedPayoutAmount && agreedPayoutAmount > 0) setPaymentStatus('Paid');
                    else if (adv > 0) setPaymentStatus('Partial');
                    else setPaymentStatus('Unpaid');
                  }}
                  placeholder="৳0"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-blue-400 font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Final Payable (Auto)</label>
                <div className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-amber-400 flex items-center">
                  {formatCurrency(dueFinalPayable)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-white"
              >
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Delivery Status</label>
              <select
                value={deliveryStatus}
                onChange={e => setDeliveryStatus(e.target.value as OrderDeliveryStatus)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-white"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Transaction ID</label>
              <input
                type="text"
                value={transactionRefId}
                onChange={e => setTransactionRefId(e.target.value)}
                placeholder="TXN..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Remarks / Worker Instructions</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Cleared after final approval from client..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-500 shadow-lg shadow-amber-600/30 disabled:opacity-50"
            >
              {submitting ? 'Creating Payout...' : 'Create Payout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
