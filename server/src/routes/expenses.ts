import { Router } from 'express';
import { store } from '../db/store.js';
import { googleSheetsService } from '../services/sheets.js';
import { telegramService } from '../services/telegram.js';
import { AuthenticatedRequest, requirePermission, requireSuperAdmin } from '../middleware/auth.js';

export const expensesRouter = Router();

// GET all expenses with query filters and record-level access control
expensesRouter.get('/', requirePermission('expenses', 'view'), (req: AuthenticatedRequest, res) => {
  try {
    let expenses = store.getExpenses();
    const user = req.user;
    const role = req.role;

    // Record-level access control
    if (role && !user?.isPrimarySuperAdmin && role.name !== 'Super Admin') {
      const scope = role.recordScope?.expenses || 'all';
      if (scope === 'none') {
        return res.json({ success: true, count: 0, expenses: [] });
      }
      if (scope === 'own') {
        const name = (user?.name || '').toLowerCase();
        expenses = expenses.filter(e => 
          e.approvedBy.toLowerCase() === name ||
          e.vendorReceiverName.toLowerCase() === name ||
          (e.updatedBy && e.updatedBy.toLowerCase() === name)
        );
      }
    }

    const {
      search,
      category,
      paymentMethod,
      approvalStatus,
      paidFromAccount,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      vendor,
    } = req.query as Record<string, string>;

    if (search) {
      const q = search.toLowerCase().trim();
      expenses = expenses.filter(e => 
        e.id.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.subCategoryPurpose.toLowerCase().includes(q) ||
        e.vendorReceiverName.toLowerCase().includes(q) ||
        e.transactionRefId.toLowerCase().includes(q) ||
        e.approvedBy.toLowerCase().includes(q) ||
        e.remarks.toLowerCase().includes(q)
      );
    }

    if (category && category !== 'All') {
      expenses = expenses.filter(e => e.category.toLowerCase() === category.toLowerCase());
    }

    if (paymentMethod && paymentMethod !== 'All') {
      expenses = expenses.filter(e => e.paymentMethod === paymentMethod);
    }

    if (approvalStatus && approvalStatus !== 'All') {
      expenses = expenses.filter(e => e.approvalStatus === approvalStatus);
    }

    if (paidFromAccount && paidFromAccount !== 'All') {
      expenses = expenses.filter(e => e.paidFromAccount === paidFromAccount);
    }

    if (vendor) {
      expenses = expenses.filter(e => e.vendorReceiverName.toLowerCase().includes(vendor.toLowerCase()));
    }

    if (startDate) {
      expenses = expenses.filter(e => (e.dateTime || e.createdAt).slice(0, 10) >= startDate);
    }

    if (endDate) {
      expenses = expenses.filter(e => (e.dateTime || e.createdAt).slice(0, 10) <= endDate);
    }

    if (minAmount) {
      expenses = expenses.filter(e => e.amount >= parseFloat(minAmount));
    }

    if (maxAmount) {
      expenses = expenses.filter(e => e.amount <= parseFloat(maxAmount));
    }

    expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      count: expenses.length,
      expenses,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET expense categories
expensesRouter.get('/categories', (req: AuthenticatedRequest, res) => {
  try {
    const categories = store.getExpenseCategories();
    res.json({ success: true, categories });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add new custom expense category
expensesRouter.post('/categories', requirePermission('expenses', 'create'), (req: AuthenticatedRequest, res) => {
  try {
    const { categoryName } = req.body;
    if (!categoryName || typeof categoryName !== 'string' || !categoryName.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }
    const categories = store.addExpenseCategory(categoryName);
    res.json({ success: true, categories, message: `Category "${categoryName.trim()}" added successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET single expense
expensesRouter.get('/:id', requirePermission('expenses', 'view'), (req: AuthenticatedRequest, res) => {
  const expense = store.getExpenseById(req.params.id);
  if (!expense) {
    return res.status(404).json({ success: false, message: `Expense ${req.params.id} not found.` });
  }

  const auditLogs = store.getAuditLogs().filter(a => a.entityId.toLowerCase() === expense.id.toLowerCase());
  res.json({ success: true, expense, auditLogs });
});

// POST create expense
expensesRouter.post('/', requirePermission('expenses', 'create'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';
    const newExpense = store.createExpense(req.body, actor, 'Dashboard');

    // Async push to Google Sheets
    googleSheetsService.pushExpense(newExpense).catch(err => {
      console.warn('[Expenses] Sheets push error:', err.message);
    });

    // Async Telegram notification (checks high-expense threshold)
    telegramService.notifyNewExpense(newExpense).catch(err => {
      console.warn('[Expenses] Telegram dispatch error:', err.message);
    });

    res.status(201).json({ success: true, expense: newExpense, message: `Expense ${newExpense.id} created successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update expense
expensesRouter.put('/:id', requirePermission('expenses', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';
    const current = store.getExpenseById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: `Expense ${req.params.id} not found.` });
    }

    const updatedExpense = store.updateExpense(req.params.id, req.body, actor, 'Dashboard');

    // Sync to Google Sheets
    googleSheetsService.pushExpense(updatedExpense).catch(err => {
      console.warn('[Expenses] Sheets push error:', err.message);
    });

    res.json({ success: true, expense: updatedExpense, message: `Expense ${updatedExpense.id} updated successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST Approve expense
expensesRouter.post('/:id/approve', requirePermission('expenses', 'approve'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';
    const current = store.getExpenseById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: `Expense ${req.params.id} not found.` });
    }

    const updatedExpense = store.updateExpense(req.params.id, {
      approvalStatus: 'Approved',
      approvedBy: actor,
    }, actor, 'Dashboard');

    googleSheetsService.pushExpense(updatedExpense).catch(() => {});

    res.json({ success: true, expense: updatedExpense, message: `Expense ${updatedExpense.id} marked as Approved by ${actor}.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE expense - Restricted exclusively to Super Admin
expensesRouter.delete('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.user?.name || 'Super Admin';
  const expenseId = req.params.id;

  const expense = store.getExpenseById(expenseId);
  if (!expense) {
    return res.status(404).json({ success: false, message: `Expense ${expenseId} not found.` });
  }

  // Delete from CRM database
  const ok = store.deleteExpense(expenseId, actor, true);
  if (!ok) {
    return res.status(404).json({ success: false, message: `Expense ${expenseId} could not be deleted.` });
  }

  // Propagate deletion to Google Sheets
  googleSheetsService.deleteRecordFromSheets('expense', expenseId).catch(err => {
    console.warn(`[Expenses] Failed to delete ${expenseId} from Sheets:`, err.message);
  });

  res.json({ 
    success: true, 
    message: `Expense ${expenseId} has been permanently deleted by Super Admin and removed from active dataset & Google Sheets.` 
  });
});
