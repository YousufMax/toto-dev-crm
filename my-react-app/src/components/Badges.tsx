import React from 'react';
import { OrderPaymentStatus, OrderDeliveryStatus, ExpenseApprovalStatus, PayoutApprovalStatus } from '../types';

export const PaymentBadge: React.FC<{ status: OrderPaymentStatus | string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Unpaid: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    Refunded: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const style = styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status}
    </span>
  );
};

export const DeliveryBadge: React.FC<{ status: OrderDeliveryStatus | string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Delivered: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Review: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    Revision: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'On Hold': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    Cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const style = styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
};

export const ApprovalBadge: React.FC<{ status: ExpenseApprovalStatus | PayoutApprovalStatus | string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Final Paid': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Advance Paid': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Pending Approval': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    Rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const style = styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
};

export const SourceBadge: React.FC<{ source: 'Google Sheets' | 'Dashboard' | 'API' | string }> = ({ source }) => {
  const isSheets = source === 'Google Sheets';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
      isSheets ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-slate-800 text-slate-300 border border-slate-700/50'
    }`}>
      {isSheets && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />}
      {source}
    </span>
  );
};
