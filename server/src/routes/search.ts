import { Router } from 'express';
import { store } from '../db/store.js';

export const searchRouter = Router();

// GET Universal Global Search
searchRouter.get('/', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  if (!query) {
    return res.json({
      success: true,
      query: '',
      results: {
        orders: [],
        expenses: [],
        payouts: [],
        employees: [],
        clients: [],
      }
    });
  }

  const orders = store.getOrders().filter(o => 
    o.id.toLowerCase().includes(query) ||
    o.clientName.toLowerCase().includes(query) ||
    o.clientContact.toLowerCase().includes(query) ||
    o.salesRep.toLowerCase().includes(query) ||
    o.serviceName.toLowerCase().includes(query) ||
    o.remarks.toLowerCase().includes(query)
  );

  const expenses = store.getExpenses().filter(e => 
    e.id.toLowerCase().includes(query) ||
    e.category.toLowerCase().includes(query) ||
    e.subCategoryPurpose.toLowerCase().includes(query) ||
    e.vendorReceiverName.toLowerCase().includes(query) ||
    e.transactionRefId.toLowerCase().includes(query) ||
    e.approvedBy.toLowerCase().includes(query)
  );

  const payouts = store.getPayouts().filter(p => 
    p.id.toLowerCase().includes(query) ||
    p.projectOrderId.toLowerCase().includes(query) ||
    p.resourceWorkerName.toLowerCase().includes(query) ||
    p.clientName.toLowerCase().includes(query) ||
    p.serviceName.toLowerCase().includes(query) ||
    p.transactionRefId.toLowerCase().includes(query)
  );

  // Group matched unique clients
  const clientNames = Array.from(new Set(
    store.getOrders()
      .map(o => o.clientName)
      .filter(c => c && c.toLowerCase().includes(query))
  ));

  // Group matched workers/employees
  const employeeNames = Array.from(new Set(
    store.getPayouts()
      .map(p => p.resourceWorkerName)
      .concat(store.getUsers().map(u => u.name))
      .filter(w => w && w.toLowerCase().includes(query))
  ));

  res.json({
    success: true,
    query,
    results: {
      orders: orders.slice(0, 10),
      expenses: expenses.slice(0, 10),
      payouts: payouts.slice(0, 10),
      clients: clientNames.slice(0, 5),
      employees: employeeNames.slice(0, 5),
    }
  });
});
