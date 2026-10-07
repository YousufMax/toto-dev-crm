import { store } from '../db/store.js';
import { Order, Expense, Payout } from '../types/index.js';

export interface DateFilterRange {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

// Helper to check if a date string falls inside filter range
function isDateInRange(dateStr: string, filter?: DateFilterRange): boolean {
  if (!filter || (!filter.startDate && !filter.endDate)) return true;
  if (!dateStr) return false;

  const itemDate = dateStr.slice(0, 10);
  if (filter.startDate && itemDate < filter.startDate) return false;
  if (filter.endDate && itemDate > filter.endDate) return false;
  return true;
}

export class ReportsService {
  // --- Executive Dashboard Financial KPIs ---
  public getDashboardKPIs(filter?: DateFilterRange) {
    const orders = store.getOrders().filter(o => isDateInRange(o.bookingDate || o.createdAt, filter));
    const expenses = store.getExpenses().filter(e => isDateInRange(e.dateTime || e.createdAt, filter));
    const payouts = store.getPayouts().filter(p => isDateInRange(p.createdAt, filter));

    // Today's values
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = store.getOrders().filter(o => (o.bookingDate || o.createdAt).startsWith(todayStr));
    const todayExpenses = store.getExpenses().filter(e => (e.dateTime || e.createdAt).startsWith(todayStr));

    // Sales Metrics
    const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalCollection = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const totalOutstanding = orders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

    const todaySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const todayCollection = todayOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);

    // Expense Metrics
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const todayExpenseAmount = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const approvedExpenses = expenses
      .filter(e => e.approvalStatus === 'Approved' || e.approvalStatus === 'Paid')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Payout Metrics
    const totalPayoutAgreed = payouts.reduce((sum, p) => sum + (p.agreedPayoutAmount || 0), 0);
    const totalAdvancePaid = payouts.reduce((sum, p) => sum + (p.advancePaid || 0), 0);
    const totalDuePayable = payouts.reduce((sum, p) => sum + (p.dueFinalPayable || 0), 0);
    const totalPayoutCleared = payouts
      .filter(p => p.approvalStatus === 'Final Paid' || p.paymentStatus === 'Paid')
      .reduce((sum, p) => sum + (p.agreedPayoutAmount || 0), 0);

    // Net Operating Result = Collected Cash - Approved Expenses - Paid/Agreed Payouts
    const estimatedOperatingResult = totalCollection - totalExpenses - totalPayoutAgreed;

    // Order Counts
    const activeOrders = orders.filter(o => o.deliveryStatus === 'In Progress' || o.deliveryStatus === 'Pending').length;
    const completedOrders = orders.filter(o => o.deliveryStatus === 'Completed' || o.deliveryStatus === 'Delivered').length;
    const reviewOrders = orders.filter(o => o.deliveryStatus === 'Review' || o.deliveryStatus === 'Revision').length;

    return {
      sales: {
        totalSales,
        totalCollection,
        totalOutstanding,
        todaySales,
        todayCollection,
        ordersCount: orders.length,
        activeOrders,
        completedOrders,
        reviewOrders,
      },
      expenses: {
        totalExpenses,
        todayExpenseAmount,
        approvedExpenses,
        expensesCount: expenses.length,
      },
      payouts: {
        totalPayoutAgreed,
        totalAdvancePaid,
        totalDuePayable,
        totalPayoutCleared,
        payoutsCount: payouts.length,
      },
      profitability: {
        collectedRevenue: totalCollection,
        totalExpenses,
        totalPayouts: totalPayoutAgreed,
        estimatedOperatingResult,
        profitMarginPercent: totalCollection > 0 
          ? Math.round((estimatedOperatingResult / totalCollection) * 100) 
          : 0,
      },
    };
  }

  // --- Hourly Distribution Report (00:00 to 23:00) ---
  public getHourlyReport(targetDate?: string) {
    const dateStr = targetDate || new Date().toISOString().slice(0, 10);
    const orders = store.getOrders().filter(o => (o.bookingDate || o.createdAt).startsWith(dateStr));
    const expenses = store.getExpenses().filter(e => (e.dateTime || e.createdAt).startsWith(dateStr));
    const payouts = store.getPayouts().filter(p => (p.createdAt).startsWith(dateStr));

    const hourlyData: Array<{
      hour: string;
      label: string;
      sales: number;
      collections: number;
      expenses: number;
      payouts: number;
      ordersCount: number;
    }> = [];

    for (let h = 0; h < 24; h++) {
      const hourStr = String(h).padStart(2, '0');
      const nextHourStr = String((h + 1) % 24).padStart(2, '0');
      const label = `${hourStr}:00–${nextHourStr}:00`;

      // Filter by hour in bookingDate / dateTime
      const hourOrders = orders.filter(o => {
        const timePart = (o.bookingDate || o.createdAt).split(' ')[1] || (o.bookingDate || o.createdAt).split('T')[1] || '';
        return timePart.startsWith(hourStr);
      });

      const hourExpenses = expenses.filter(e => {
        const timePart = (e.dateTime || e.createdAt).split(' ')[1] || (e.dateTime || e.createdAt).split('T')[1] || '';
        return timePart.startsWith(hourStr);
      });

      const hourPayouts = payouts.filter(p => {
        const timePart = (p.createdAt).split('T')[1] || (p.createdAt).split(' ')[1] || '';
        return timePart.startsWith(hourStr);
      });

      const sales = hourOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const collections = hourOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
      const expenseAmount = hourExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const payoutAmount = hourPayouts.reduce((sum, p) => sum + (p.agreedPayoutAmount || 0), 0);

      hourlyData.push({
        hour: hourStr,
        label,
        sales,
        collections,
        expenses: expenseAmount,
        payouts: payoutAmount,
        ordersCount: hourOrders.length,
      });
    }

    return {
      date: dateStr,
      hourlyData,
      summary: {
        totalSales: hourlyData.reduce((sum, d) => sum + d.sales, 0),
        totalCollections: hourlyData.reduce((sum, d) => sum + d.collections, 0),
        totalExpenses: hourlyData.reduce((sum, d) => sum + d.expenses, 0),
        totalPayouts: hourlyData.reduce((sum, d) => sum + d.payouts, 0),
        totalOrders: hourlyData.reduce((sum, d) => sum + d.ordersCount, 0),
      }
    };
  }

  // --- Daily Rollup (e.g. last 14 or 30 days) ---
  public getDailyReport(days = 14) {
    const orders = store.getOrders();
    const expenses = store.getExpenses();
    const payouts = store.getPayouts();

    const dailyMap: Record<string, {
      date: string;
      sales: number;
      collections: number;
      expenses: number;
      payouts: number;
      netResult: number;
      ordersCount: number;
    }> = {};

    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      dailyMap[dateStr] = {
        date: dateStr,
        sales: 0,
        collections: 0,
        expenses: 0,
        payouts: 0,
        netResult: 0,
        ordersCount: 0,
      };
    }

    // Populate orders
    for (const o of orders) {
      const dateStr = (o.bookingDate || o.createdAt).slice(0, 10);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].sales += o.totalAmount || 0;
        dailyMap[dateStr].collections += o.paidAmount || 0;
        dailyMap[dateStr].ordersCount += 1;
      }
    }

    // Populate expenses
    for (const e of expenses) {
      const dateStr = (e.dateTime || e.createdAt).slice(0, 10);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].expenses += e.amount || 0;
      }
    }

    // Populate payouts
    for (const p of payouts) {
      const dateStr = (p.createdAt).slice(0, 10);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].payouts += p.agreedPayoutAmount || 0;
      }
    }

    const result = Object.values(dailyMap).map(row => ({
      ...row,
      netResult: row.collections - row.expenses - row.payouts,
    }));

    return result;
  }

  // --- Monthly Rollup (12 Months of the current year) ---
  public getMonthlyReport(year = new Date().getFullYear()) {
    const orders = store.getOrders();
    const expenses = store.getExpenses();
    const payouts = store.getPayouts();

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthlyData = months.map((monthName, idx) => {
      const monthPrefix = `${year}-${String(idx + 1).padStart(2, '0')}`;
      const mOrders = orders.filter(o => (o.bookingDate || o.createdAt).startsWith(monthPrefix));
      const mExpenses = expenses.filter(e => (e.dateTime || e.createdAt).startsWith(monthPrefix));
      const mPayouts = payouts.filter(p => (p.createdAt).startsWith(monthPrefix));

      const sales = mOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const collections = mOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
      const expAmount = mExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const payAmount = mPayouts.reduce((sum, p) => sum + (p.agreedPayoutAmount || 0), 0);
      const netResult = collections - expAmount - payAmount;

      return {
        month: monthName,
        monthKey: monthPrefix,
        sales,
        collections,
        expenses: expAmount,
        payouts: payAmount,
        netResult,
        ordersCount: mOrders.length,
        completedOrders: mOrders.filter(o => o.deliveryStatus === 'Completed' || o.deliveryStatus === 'Delivered').length,
      };
    });

    return {
      year,
      monthlyData,
    };
  }

  // --- Employee / Resource Performance Analysis ---
  public getEmployeePerformance(filter?: DateFilterRange) {
    const payouts = store.getPayouts().filter(p => isDateInRange(p.createdAt, filter));
    const orders = store.getOrders().filter(o => isDateInRange(o.bookingDate || o.createdAt, filter));

    // Unique workers/employees
    const workerMap: Record<string, {
      workerName: string;
      assignedProjects: number;
      completedProjects: number;
      inProgressProjects: number;
      delayedProjects: number;
      totalBudgetHandled: number;
      totalAgreedPayout: number;
      totalAdvanceReceived: number;
      totalFinalPaid: number;
      totalOutstanding: number;
      completionRate: number;
      recentProjects: string[];
    }> = {};

    for (const p of payouts) {
      const name = p.resourceWorkerName || 'Unassigned';
      if (!workerMap[name]) {
        workerMap[name] = {
          workerName: name,
          assignedProjects: 0,
          completedProjects: 0,
          inProgressProjects: 0,
          delayedProjects: 0,
          totalBudgetHandled: 0,
          totalAgreedPayout: 0,
          totalAdvanceReceived: 0,
          totalFinalPaid: 0,
          totalOutstanding: 0,
          completionRate: 0,
          recentProjects: [],
        };
      }

      const w = workerMap[name];
      w.assignedProjects += 1;
      w.totalBudgetHandled += p.totalProjectBudget || 0;
      w.totalAgreedPayout += p.agreedPayoutAmount || 0;
      w.totalAdvanceReceived += p.advancePaid || 0;
      w.totalOutstanding += p.dueFinalPayable || 0;

      if (p.deliveryStatus === 'Completed' || p.deliveryStatus === 'Delivered') {
        w.completedProjects += 1;
      } else if (p.deliveryStatus === 'In Progress' || p.deliveryStatus === 'Review') {
        w.inProgressProjects += 1;
      }

      if (p.paymentStatus === 'Paid' || p.approvalStatus === 'Final Paid') {
        w.totalFinalPaid += (p.agreedPayoutAmount - p.advancePaid);
      }

      if (p.projectOrderId && !w.recentProjects.includes(p.projectOrderId)) {
        w.recentProjects.push(p.projectOrderId);
      }
    }

    // Calculate completion rates
    const list = Object.values(workerMap).map(w => ({
      ...w,
      completionRate: w.assignedProjects > 0 ? Math.round((w.completedProjects / w.assignedProjects) * 100) : 0,
    }));

    return list.sort((a, b) => b.totalAgreedPayout - a.totalAgreedPayout);
  }

  // --- Breakdown Reports (Categories, Reps, Payment Methods) ---
  public getBreakdownReports(filter?: DateFilterRange) {
    const orders = store.getOrders().filter(o => isDateInRange(o.bookingDate || o.createdAt, filter));
    const expenses = store.getExpenses().filter(e => isDateInRange(e.dateTime || e.createdAt, filter));

    // Expense Categories
    const categoryMap: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0);
    }
    const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
    })).sort((a, b) => b.amount - a.amount);

    // Sales Representatives
    const repMap: Record<string, { rep: string; sales: number; collections: number; count: number }> = {};
    for (const o of orders) {
      const rep = o.salesRep || 'Direct';
      if (!repMap[rep]) repMap[rep] = { rep, sales: 0, collections: 0, count: 0 };
      repMap[rep].sales += o.totalAmount || 0;
      repMap[rep].collections += o.paidAmount || 0;
      repMap[rep].count += 1;
    }
    const repBreakdown = Object.values(repMap).sort((a, b) => b.sales - a.sales);

    // Payment Methods
    const methodMap: Record<string, number> = {};
    for (const o of orders) {
      const m = o.paymentMethod || 'Unknown';
      methodMap[m] = (methodMap[m] || 0) + (o.paidAmount || 0);
    }
    const paymentMethodBreakdown = Object.entries(methodMap).map(([method, amount]) => ({
      method,
      amount,
    })).sort((a, b) => b.amount - a.amount);

    return {
      categoryBreakdown,
      repBreakdown,
      paymentMethodBreakdown,
    };
  }
}

export const reportsService = new ReportsService();
