import React, { useState, useEffect } from 'react';
import { Search, X, ShoppingBag, Receipt, Users, User, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { Order, Expense, Payout } from '../types';
import { formatCurrency } from '../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
  onSelectExpense: (expense: Expense) => void;
  onSelectPayout: (payout: Payout) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
  onSelectExpense,
  onSelectPayout,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    orders: Order[];
    expenses: Expense[];
    payouts: Payout[];
    clients: string[];
    employees: string[];
  }>({
    orders: [],
    expenses: [],
    payouts: [],
    clients: [],
    employees: [],
  });

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ orders: [], expenses: [], payouts: [], clients: [], employees: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.searchGlobal(query);
        setResults(res.results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults = 
    results.orders.length + 
    results.expenses.length + 
    results.payouts.length + 
    results.clients.length + 
    results.employees.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3 bg-slate-950">
          <Search className="h-5 w-5 text-slate-400 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by Order ID (ORD-1001), Expense ID, Payout ID, Client, Worker..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300 p-1">
              <X className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="ml-2 rounded px-2 py-0.5 text-xs text-slate-400 bg-slate-800 border border-slate-700">
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Searching database...
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm">
              No matching records found for "{query}".
            </div>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-slate-500 text-xs">
              Type to quickly find Orders, Expenses, Payouts, Clients, or Team Members.
            </div>
          )}

          {/* Matching Orders */}
          {results.orders.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />
                Orders ({results.orders.length})
              </p>
              <div className="space-y-1.5">
                {results.orders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => {
                      onSelectOrder(order);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:border-blue-500/50 hover:bg-slate-800/50 cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-400">{order.id}</span>
                        <span className="text-xs font-medium text-slate-200">{order.clientName}</span>
                        <span className="text-[11px] text-slate-400">• {order.serviceName}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Rep: {order.salesRep} | Status: {order.deliveryStatus} | {order.bookingDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-[10px] text-slate-400">Due: {formatCurrency(order.dueAmount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matching Expenses */}
          {results.expenses.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-rose-400" />
                Expenses ({results.expenses.length})
              </p>
              <div className="space-y-1.5">
                {results.expenses.map(exp => (
                  <div
                    key={exp.id}
                    onClick={() => {
                      onSelectExpense(exp);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:border-rose-500/50 hover:bg-slate-800/50 cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-rose-400">{exp.id}</span>
                        <span className="text-xs font-medium text-slate-200">{exp.category}</span>
                        <span className="text-[11px] text-slate-400">• {exp.vendorReceiverName}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{exp.subCategoryPurpose}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-rose-400">{formatCurrency(exp.amount)}</p>
                      <span className="text-[10px] text-slate-400">{exp.approvalStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matching Payouts */}
          {results.payouts.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                Resource Payouts ({results.payouts.length})
              </p>
              <div className="space-y-1.5">
                {results.payouts.map(pay => (
                  <div
                    key={pay.id}
                    onClick={() => {
                      onSelectPayout(pay);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:border-amber-500/50 hover:bg-slate-800/50 cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{pay.id}</span>
                        <span className="text-xs font-medium text-slate-200">{pay.resourceWorkerName}</span>
                        <span className="text-[11px] text-slate-400">Order: {pay.projectOrderId}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{pay.serviceName} • {pay.commissionType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-amber-400">{formatCurrency(pay.agreedPayoutAmount)}</p>
                      <span className="text-[10px] text-slate-400">Due: {formatCurrency(pay.dueFinalPayable)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
