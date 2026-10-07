import React from 'react';
import { X, GitBranch, ArrowRight, ShoppingBag, User, Users, Receipt, DollarSign, CheckCircle2 } from 'lucide-react';
import { Order, Payout, Expense } from '../types';
import { formatCurrency } from '../utils/formatters';

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  linkedPayouts: Payout[];
  linkedExpenses?: Expense[];
}

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  isOpen,
  onClose,
  order,
  linkedPayouts,
  linkedExpenses = [],
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Full Operational Relationship Tree</h2>
              <p className="text-xs text-slate-400">
                End-to-end trace from Sales Order <span className="font-mono text-blue-400 font-bold">{order.id}</span> to Resources & Financial Settlements
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Graph Visualizer Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Level 1: Client & Sales Representative */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block mb-1">
                Client / Brand Partner
              </span>
              <p className="text-sm font-bold text-white">{order.clientName}</p>
              <p className="text-xs text-slate-400 mt-0.5">Contact: {order.clientContact || 'N/A'}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block mb-1">
                Sales Representative
              </span>
              <p className="text-sm font-bold text-blue-400">{order.salesRep}</p>
              <p className="text-xs text-slate-400 mt-0.5">Booking Date: {order.bookingDate}</p>
            </div>
          </div>

          {/* Connection Indicator */}
          <div className="flex justify-center text-slate-600">
            <span className="text-xs font-bold bg-slate-800 px-3 py-1 rounded-full text-slate-400">
              ▼ Generates Core Order
            </span>
          </div>

          {/* Level 2: The Core Order Node */}
          <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-slate-950 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-blue-400" />
                <span className="font-mono text-base font-bold text-blue-300">{order.id}</span>
                <span className="text-xs text-slate-400">• {order.serviceName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {order.deliveryStatus}
                </span>
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium">
                  {order.paymentStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block">Total Value</span>
                <span className="font-bold text-white text-sm">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Client Paid</span>
                <span className="font-bold text-emerald-400 text-sm">{formatCurrency(order.paidAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Client Due</span>
                <span className="font-bold text-rose-400 text-sm">{formatCurrency(order.dueAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Method</span>
                <span className="font-semibold text-slate-300">{order.paymentMethod}</span>
              </div>
            </div>
          </div>

          {/* Connection Indicator */}
          <div className="flex justify-center text-slate-600">
            <span className="text-xs font-bold bg-slate-800 px-3 py-1 rounded-full text-slate-400">
              ▼ Delegated to Assigned Worker(s) & Payouts ({linkedPayouts.length})
            </span>
          </div>

          {/* Level 3: Assigned Resources & Payout Nodes */}
          {linkedPayouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
              No workers or resource payouts assigned to this order yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {linkedPayouts.map(payout => (
                <div key={payout.id} className="rounded-xl border border-amber-500/30 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-400" />
                      <span className="font-mono text-xs font-bold text-amber-300">{payout.id}</span>
                      <span className="text-xs font-bold text-white">{payout.resourceWorkerName}</span>
                    </div>
                    <span className="rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium">
                      {payout.commissionType}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Agreed</span>
                      <span className="font-bold text-white">{formatCurrency(payout.agreedPayoutAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Advance</span>
                      <span className="font-bold text-blue-400">{formatCurrency(payout.advancePaid)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Final Due</span>
                      <span className="font-bold text-amber-400">{formatCurrency(payout.dueFinalPayable)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Delivery: <strong className="text-slate-200">{payout.deliveryStatus}</strong></span>
                    <span>Payment: <strong className="text-emerald-400">{payout.paymentStatus}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Level 4: Net Margin from this order */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Order Operational Yield
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Client Collection ({formatCurrency(order.paidAmount)}) − Resource Commitments ({formatCurrency(linkedPayouts.reduce((sum, p) => sum + p.agreedPayoutAmount, 0))})
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-emerald-300">
                {formatCurrency(order.paidAmount - linkedPayouts.reduce((sum, p) => sum + p.agreedPayoutAmount, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
