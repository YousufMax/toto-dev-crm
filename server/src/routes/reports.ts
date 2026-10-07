import { Router } from 'express';
import { reportsService } from '../services/reports.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const reportsRouter = Router();

// GET Executive KPIs
reportsRouter.get('/kpis', requirePermission('dashboard', 'view'), (req: AuthenticatedRequest, res) => {
  const { startDate, endDate } = req.query as Record<string, string>;
  const kpis = reportsService.getDashboardKPIs({ startDate, endDate });
  res.json({ success: true, kpis });
});

// GET Hourly Analysis (00:00 - 23:00)
reportsRouter.get('/hourly', requirePermission('reports', 'view'), (req: AuthenticatedRequest, res) => {
  const { date } = req.query as { date?: string };
  const data = reportsService.getHourlyReport(date);
  res.json({ success: true, ...data });
});

// GET Daily Trend
reportsRouter.get('/daily', requirePermission('reports', 'view'), (req: AuthenticatedRequest, res) => {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 14;
  const data = reportsService.getDailyReport(days);
  res.json({ success: true, dailyData: data });
});

// GET Monthly & Annual Summary
reportsRouter.get('/monthly', requirePermission('reports', 'view'), (req: AuthenticatedRequest, res) => {
  const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
  const data = reportsService.getMonthlyReport(year);
  res.json({ success: true, ...data });
});

// GET Employee Performance Matrix
reportsRouter.get('/employees', requirePermission('employees', 'view'), (req: AuthenticatedRequest, res) => {
  const { startDate, endDate } = req.query as Record<string, string>;
  const performance = reportsService.getEmployeePerformance({ startDate, endDate });
  res.json({ success: true, count: performance.length, performance });
});

// GET Breakdowns (Category, Sales Rep, Payment Gateway)
reportsRouter.get('/breakdowns', requirePermission('reports', 'view'), (req: AuthenticatedRequest, res) => {
  const { startDate, endDate } = req.query as Record<string, string>;
  const breakdowns = reportsService.getBreakdownReports({ startDate, endDate });
  res.json({ success: true, ...breakdowns });
});
