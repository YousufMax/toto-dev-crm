import React, { useState, useEffect } from 'react';
import { Clock, Calendar, BarChart3, TrendingUp, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api';
import { HourlyReportItem } from '../types';
import { formatCurrency, exportToCSV } from '../utils/formatters';

export const HourlyReportView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [hourlyData, setHourlyData] = useState<HourlyReportItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHourly = async () => {
    setLoading(true);
    try {
      const res = await api.getHourlyReport(selectedDate);
      setHourlyData(res.hourlyData || []);
      setSummary(res.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHourly();
  }, [selectedDate]);

  const handleExport = () => {
    const headers = ['Hour Window', 'Booked Sales (BDT)', 'Collections (BDT)', 'Expenses (BDT)', 'Payouts (BDT)', 'Orders Count'];
    const rows = hourlyData.map(h => [
      h.label,
      h.sales,
      h.collections,
      h.expenses,
      h.payouts,
      h.ordersCount,
    ]);
    exportToCSV(`hourly_report_${selectedDate}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-400" />
            24-Hour Operations & Time-Based Distribution
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hourly transaction density analysis across sales, collections, expenses, and payouts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span className="text-slate-400">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none"
            />
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards for Selected Day */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
          <p className="text-[11px] text-slate-400">Day Sales</p>
          <p className="text-lg font-bold text-blue-400 mt-1">{formatCurrency(summary?.totalSales)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{summary?.totalOrders || 0} Orders</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
          <p className="text-[11px] text-slate-400">Day Collection</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(summary?.totalCollections)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Cash Inflow</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
          <p className="text-[11px] text-slate-400">Day Expenses</p>
          <p className="text-lg font-bold text-rose-400 mt-1">{formatCurrency(summary?.totalExpenses)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Operational Cost</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
          <p className="text-[11px] text-slate-400">Day Payouts</p>
          <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(summary?.totalPayouts)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Resource Commitments</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 col-span-2 sm:col-span-1">
          <p className="text-[11px] text-slate-400">Day Net Result</p>
          <p className={`text-lg font-bold mt-1 ${
            (summary?.totalCollections - summary?.totalExpenses - summary?.totalPayouts) >= 0 
              ? 'text-emerald-400' 
              : 'text-rose-400'
          }`}>
            {formatCurrency(summary?.totalCollections - summary?.totalExpenses - summary?.totalPayouts)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Inflow − Expenses − Payouts</p>
        </div>
      </div>

      {/* Hourly Bar Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white mb-1">Hourly Distribution Histogram</h3>
        <p className="text-xs text-slate-400 mb-4">Volume per hourly slot for {selectedDate}</p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={h => `${h}:00`} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => formatCurrency(val)}
              />
              <Bar dataKey="sales" fill="#3b82f6" name="Sales" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collections" fill="#10b981" name="Collections" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#f43f5e" name="Expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly Detail Data Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Full 24-Hour Interval Breakdown</h3>
          <span className="text-xs text-slate-400">Dhaka Local Time (Asia/Dhaka)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Time Window</th>
                <th className="py-3 px-4">Orders Count</th>
                <th className="py-3 px-4">Booked Sales</th>
                <th className="py-3 px-4">Collections</th>
                <th className="py-3 px-4">Expenses</th>
                <th className="py-3 px-4">Payouts</th>
                <th className="py-3 px-4 text-right">Net Slot Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {hourlyData.map(slot => {
                const net = slot.collections - slot.expenses - slot.payouts;
                const hasActivity = slot.sales > 0 || slot.collections > 0 || slot.expenses > 0 || slot.payouts > 0;
                return (
                  <tr 
                    key={slot.hour} 
                    className={`hover:bg-slate-800/40 transition-colors ${hasActivity ? 'bg-blue-950/10' : ''}`}
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-200">
                      {slot.label}
                    </td>
                    <td className="py-2.5 px-4">
                      {slot.ordersCount > 0 ? (
                        <span className="rounded bg-blue-500/10 text-blue-400 px-2 py-0.5 font-bold">
                          {slot.ordersCount}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-blue-400">
                      {slot.sales > 0 ? formatCurrency(slot.sales) : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-emerald-400">
                      {slot.collections > 0 ? formatCurrency(slot.collections) : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-rose-400">
                      {slot.expenses > 0 ? formatCurrency(slot.expenses) : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-amber-400">
                      {slot.payouts > 0 ? formatCurrency(slot.payouts) : '—'}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-bold ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                      {hasActivity ? formatCurrency(net) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
