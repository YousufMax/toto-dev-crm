import React, { useState } from 'react';
import { X, ShoppingBag, DollarSign, Calendar, Clock } from 'lucide-react';
import { Order, OrderPaymentStatus, OrderDeliveryStatus } from '../types';
import { api } from '../api';
import { formatCurrency } from '../utils/formatters';
import { getDhakaNow } from '../utils/deadlines';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: Order) => void;
  salesReps: string[];
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  salesReps,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [salesRep, setSalesRep] = useState(salesReps[0] || 'Rajib');
  const [serviceName, setServiceName] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('1 Unit');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>('Unpaid');
  const [deliveryStatus, setDeliveryStatus] = useState<OrderDeliveryStatus>('In Progress');
  
  // Clean Date & Time Picker states
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const dueAmount = Math.max(0, totalAmount - paidAmount);

  const handlePaidChange = (val: number) => {
    setPaidAmount(val);
    if (val >= totalAmount && totalAmount > 0) {
      setPaymentStatus('Paid');
    } else if (val > 0) {
      setPaymentStatus('Partial');
    } else {
      setPaymentStatus('Unpaid');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }
    if (!serviceName.trim()) {
      setError('Service / Project name is required.');
      return;
    }
    if (totalAmount <= 0) {
      setError('Total amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setError('');

    const targetDeadline = deadlineDate 
      ? `${deadlineDate} ${deadlineTime || '18:00'}`.trim()
      : '';

    try {
      const res = await api.createOrder({
        clientName: clientName.trim(),
        clientContact: clientContact.trim(),
        salesRep,
        serviceName: serviceName.trim(),
        quantityUnit: quantityUnit.trim(),
        totalAmount,
        paidAmount,
        paymentMethod,
        paymentStatus,
        deliveryStatus,
        targetDeadline,
        remarks: remarks.trim(),
      });

      onOrderCreated(res.order);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create New Sales Order</h2>
              <p className="text-xs text-slate-400">Order ID will be generated uniquely and synced to Google Sheets</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Client / Brand Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Rajesh / VK Brand"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Client Contact / Phone
              </label>
              <input
                type="text"
                value={clientContact}
                onChange={e => setClientContact(e.target.value)}
                placeholder="e.g. 01711223344"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Service / Project Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="e.g. Graphic Design, Web Development"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity / Unit</label>
              <input
                type="text"
                value={quantityUnit}
                onChange={e => setQuantityUnit(e.target.value)}
                placeholder="e.g. 4 Pcs, 1 Month, 1 System"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Sales Representative</label>
              <select
                value={salesRep}
                onChange={e => setSalesRep(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {salesReps.map(rep => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Target Deadline <span className="text-slate-500 font-normal">(Date & Time)</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {/* Date Input */}
                <div className="col-span-3 relative">
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={e => setDeadlineDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                  />
                </div>
                {/* Time Selector */}
                <div className="col-span-2">
                  <select
                    value={deadlineTime}
                    onChange={e => setDeadlineTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="12:00">12:00 PM (Noon)</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                    <option value="18:00">06:00 PM (EOD)</option>
                    <option value="20:00">08:00 PM</option>
                    <option value="22:00">10:00 PM</option>
                    <option value="23:59">11:59 PM (Midnight)</option>
                  </select>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-slate-500">Quick:</span>
                <button
                  type="button"
                  onClick={() => {
                    const d = getDhakaNow();
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setDeadlineDate(`${y}-${m}-${day}`);
                  }}
                  className="rounded bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = getDhakaNow();
                    d.setDate(d.getDate() + 3);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setDeadlineDate(`${y}-${m}-${day}`);
                  }}
                  className="rounded bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition-colors"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = getDhakaNow();
                    d.setDate(d.getDate() + 7);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setDeadlineDate(`${y}-${m}-${day}`);
                  }}
                  className="rounded bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition-colors"
                >
                  +1 Week
                </button>
                {deadlineDate && (
                  <button
                    type="button"
                    onClick={() => setDeadlineDate('')}
                    className="text-[10px] text-slate-500 hover:text-slate-300 ml-auto"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Financials Calculation Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Financial Calculation (BDT)
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Total Amount <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={totalAmount || ''}
                  onChange={e => setTotalAmount(Number(e.target.value))}
                  placeholder="৳0"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Paid / Advance</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount || ''}
                  onChange={e => handlePaidChange(Number(e.target.value))}
                  placeholder="৳0"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-emerald-400 font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Due Amount (Auto)</label>
                <div className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-bold text-rose-400 flex items-center">
                  {formatCurrency(dueAmount)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-white"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as OrderPaymentStatus)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-white"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                  <option value="Refunded">Refunded</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Delivery Status</label>
                <select
                  value={deliveryStatus}
                  onChange={e => setDeliveryStatus(e.target.value as OrderDeliveryStatus)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-white"
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
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Remarks / Project Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Logo & Social banner specifications, brand colors..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {submitting ? 'Creating Order...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
