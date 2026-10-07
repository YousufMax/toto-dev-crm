import React, { useState, useEffect } from 'react';
import { History, Search, ShieldCheck, Filter } from 'lucide-react';
import { api } from '../api';
import { AuditLog } from '../types';
import { SourceBadge } from '../components/Badges';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entityType, setEntityType] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (entityType !== 'All') params.entityType = entityType;
      if (search) params.entityId = search;

      const res = await api.getAuditLogs(params);
      setLogs(res.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityType, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <History className="h-6 w-6 text-slate-400" />
          System Operational Audit Log
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable audit record tracking actors, field-level mutations, Google Sheets synchronization, and system events
        </p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by Entity ID (ORD-1001, EXP-2026-1001, PAY-PRJ-501)..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Entity Types</option>
            <option value="Order">Orders</option>
            <option value="Expense">Expenses</option>
            <option value="Payout">Payouts</option>
            <option value="Settings">Settings</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Timestamp (Dhaka)</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Record ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Details / Field Change</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      {log.entityId}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        log.action === 'STATUS_CHANGE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        log.action === 'DELETE' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-100">
                      {log.changedBy}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.details || (
                        <span>
                          <strong className="text-slate-200">{log.fieldChanged}</strong>: {log.previousValue} ➔ {log.newValue}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <SourceBadge source={log.source} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
