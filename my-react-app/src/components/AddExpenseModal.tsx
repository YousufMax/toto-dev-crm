import React, { useState, useEffect } from 'react';
import { X, Receipt, Plus } from 'lucide-react';
import { Expense } from '../types';
import { api } from '../api';

const DEFAULT_CATEGORIES = [
  'Employee Salary',
  'Employee Advance',
  'Project Cost',
  'Freelancer Payment',
  'Marketing & Ads',
  'Software / Subscription',
  'Hosting / Domain',
  'Office Expense',
  'Transportation',
  'Equipment',
  'Utilities',
  'Internet / Communication',
  'Bank Charges',
  'Refund',
  'Other'
];

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseCreated: (newExpense: Expense) => void;
  categories: string[];
  onCategoryAdded: (cat: string) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onExpenseCreated,
  categories,
  onCategoryAdded,
}) => {
  // Merge prop categories with default fallback list so dropdown is never empty
  const activeCategories = Array.from(new Set([
    ...(categories && categories.length > 0 ? categories : []),
    ...DEFAULT_CATEGORIES
  ]));

  const [category, setCategory] = useState(activeCategories[0] || 'Employee Salary');
  const [subCategoryPurpose, setSubCategoryPurpose] = useState('');
  const [vendorReceiverName, setVendorReceiverName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paidFromAccount, setPaidFromAccount] = useState('City Bank A/C');
  const [transactionRefId, setTransactionRefId] = useState('');
  const [receiptInvoiceLink, setReceiptInvoiceLink] = useState('');
  const [approvedBy, setApprovedBy] = useState('MD Yousuf Ali');
  const [remarks, setRemarks] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Keep selected category synced when modal opens or category list updates
  useEffect(() => {
    if (isOpen && activeCategories.length > 0) {
      if (!category || !activeCategories.includes(category)) {
        setCategory(activeCategories[0]);
      }
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleAddNewCategory = async () => {
    if (!newCatInput.trim()) return;
    try {
      await api.addCategory(newCatInput.trim());
      onCategoryAdded(newCatInput.trim());
      setCategory(newCatInput.trim());
      setNewCatInput('');
      setIsAddingNewCat(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!vendorReceiverName.trim()) {
      setError('Vendor or receiver name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.createExpense({
        category,
        subCategoryPurpose: subCategoryPurpose.trim(),
        vendorReceiverName: vendorReceiverName.trim(),
        amount,
        paymentMethod,
        paidFromAccount,
        transactionRefId: transactionRefId.trim(),
        receiptInvoiceLink: receiptInvoiceLink.trim(),
        approvedBy: approvedBy.trim(),
        remarks: remarks.trim(),
      });

      onExpenseCreated(res.expense);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record New Expense</h2>
              <p className="text-xs text-slate-400">Expense ID is auto-generated and logged to Google Sheets</p>
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

          {/* Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Expense Category <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {isAddingNewCat ? 'Select Existing' : 'Add Custom Category'}
              </button>
            </div>

            {isAddingNewCat ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatInput}
                  onChange={e => setNewCatInput(e.target.value)}
                  placeholder="Enter new category name..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Amount (BDT) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                placeholder="৳0"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-rose-400 font-bold focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Vendor / Receiver Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={vendorReceiverName}
                onChange={e => setVendorReceiverName(e.target.value)}
                placeholder="e.g. Developer Sakib, Cloudflare, Office Landlord"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Sub-Category / Purpose
            </label>
            <input
              type="text"
              value={subCategoryPurpose}
              onChange={e => setSubCategoryPurpose(e.target.value)}
              placeholder="e.g. September 2026 Developer Salary, Server Hosting"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Paid From Account</label>
              <input
                type="text"
                value={paidFromAccount}
                onChange={e => setPaidFromAccount(e.target.value)}
                placeholder="e.g. City Bank A/C, bKash Merchant"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Transaction / Ref ID</label>
              <input
                type="text"
                value={transactionRefId}
                onChange={e => setTransactionRefId(e.target.value)}
                placeholder="e.g. TXN987654321"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Approved By</label>
              <input
                type="text"
                value={approvedBy}
                onChange={e => setApprovedBy(e.target.value)}
                placeholder="e.g. MD Yousuf Ali"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Money Receipt / Invoice Link (Google Drive / URL)
            </label>
            <input
              type="url"
              value={receiptInvoiceLink}
              onChange={e => setReceiptInvoiceLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Remarks / Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Additional internal audit notes..."
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
              className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30 disabled:opacity-50"
            >
              {submitting ? 'Recording Expense...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
