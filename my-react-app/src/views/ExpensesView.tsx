import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Download, 
  Filter, 
  CheckCircle, 
  ExternalLink,
  DollarSign,
  Layers,
  Trash2
} from 'lucide-react';
import { Expense } from '../types';
import { ApprovalBadge, SourceBadge } from '../components/Badges';
import { formatCurrency, formatDate, exportToCSV } from '../utils/formatters';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface ExpensesViewProps {
  onOpenNewExpense: () => void;
  categories: string[];
  userRole: string;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onOpenNewExpense,
  categories,
  userRole,
}) => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(
    currentUser?.isPrimarySuperAdmin ||
    currentUser?.role === 'Super Admin' ||
    userRole === 'Super Admin'
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [approvalStatus, setApprovalStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== 'All') params.category = category;
      if (paymentMethod !== 'All') params.paymentMethod = paymentMethod;
      if (approvalStatus !== 'All') params.approvalStatus = approvalStatus;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.getExpenses(params);
      setExpenses(res.expenses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [search, category, paymentMethod, approvalStatus, startDate, endDate]);

  const handleApprove = async (id: string, status = 'Approved') => {
    try {
      await api.approveExpense(id, status);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    await api.deleteExpense(expenseToDelete.id, true);
    setExpenseToDelete(null);
    fetchExpenses();
  };

  const handleExportCSV = () => {
    const headers = [
      'Expense ID',
      'Date & Time',
      'Expense Category',
      'Sub-Category / Purpose',
      'Vendor / Receiver Name',
      'Amount (BDT)',
      'Payment Method',
      'Paid From Account',
      'Transaction / Ref ID',
      'Money Receipt Link',
      'Approved By',
      'Approval Status',
      'Remarks',
      'Data Source',
    ];

    const rows = expenses.map(e => [
      e.id,
      e.dateTime,
      e.category,
      e.subCategoryPurpose,
      e.vendorReceiverName,
      e.amount,
      e.paymentMethod,
      e.paidFromAccount,
      e.transactionRefId,
      e.receiptInvoiceLink,
      e.approvedBy,
      e.approvalStatus,
      e.remarks,
      e.source,
    ]);

    exportToCSV('expenses_report', headers, rows);
  };

  const totalFilteredAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalApproved = expenses
    .filter(e => e.approvalStatus === 'Approved' || e.approvalStatus === 'Paid')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-rose-400" />
            Module B — Expense & Cost Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized with Google Sheets worksheet <span className="font-mono text-emerald-400">Expenses</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export CSV ({expenses.length})
          </button>

          <button
            onClick={onOpenNewExpense}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/30"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Filtered Total Cost</p>
          <p className="text-base font-bold text-rose-400 mt-0.5">{formatCurrency(totalFilteredAmount)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{expenses.length} Records</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Approved & Cleared</p>
          <p className="text-base font-bold text-emerald-400 mt-0.5">{formatCurrency(totalApproved)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Audited Outflow</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Active Categories</p>
          <p className="text-base font-bold text-blue-400 mt-0.5">{categories.length} Categories</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Configurable</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] text-slate-400">Payment Channels</p>
          <p className="text-base font-bold text-amber-400 mt-0.5">Bank / Cards / Mobile</p>
          <p className="text-[10px] text-slate-500 mt-0.5">City Bank & bKash</p>
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
              placeholder="Filter by Expense ID, vendor, purpose, approver..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={approvalStatus}
            onChange={e => setApprovalStatus(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="All">All Approval States</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="All">All Payment Methods</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Cash">Cash</option>
          </select>
        </div>

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

      {/* Expenses Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Expense ID</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Vendor / Receiver</th>
                <th className="py-3 px-4 text-right">Amount (BDT)</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Approver</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Receipt</th>
                <th className="py-3 px-4">Source</th>
                {isSuperAdmin && <th className="py-3 px-4 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 13 : 12} className="py-12 text-center text-slate-500">
                    Loading expenses from database...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 13 : 12} className="py-12 text-center text-slate-500">
                    No expense records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">
                      {exp.id}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {exp.dateTime}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {exp.category}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {exp.subCategoryPurpose}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-100">
                      {exp.vendorReceiverName}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-400">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {exp.paidFromAccount}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {exp.approvedBy || (
                        <button
                          onClick={() => handleApprove(exp.id, 'Approved')}
                          className="rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] hover:bg-blue-600/40"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <ApprovalBadge status={exp.approvalStatus} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {exp.receiptInvoiceLink ? (
                        <a
                          href={exp.receiptInvoiceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-blue-400 hover:text-blue-300 p-1"
                          title="Open Money Receipt Link"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <SourceBadge source={exp.source} />
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setExpenseToDelete(exp)}
                          title="Super Admin: Permanently Delete Expense"
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
      {expenseToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(expenseToDelete)}
          onClose={() => setExpenseToDelete(null)}
          onConfirm={handleConfirmDeleteExpense}
          title="Delete Expense Record"
          recordId={expenseToDelete.id}
          recordDescription={`${expenseToDelete.category} — ${expenseToDelete.vendorReceiverName} (৳${expenseToDelete.amount?.toLocaleString()})`}
          moduleName="Expense"
        />
      )}
    </div>
  );
};
