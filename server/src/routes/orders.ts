import { Router } from 'express';
import { store } from '../db/store.js';
import { googleSheetsService } from '../services/sheets.js';
import { telegramService } from '../services/telegram.js';
import { AuthenticatedRequest, requirePermission, requireSuperAdmin } from '../middleware/auth.js';

export const ordersRouter = Router();

// GET all orders with query filters and record-level access control
ordersRouter.get('/', requirePermission('orders', 'view'), (req: AuthenticatedRequest, res) => {
  try {
    let orders = store.getOrders();
    const user = req.user;
    const role = req.role;

    // Record-level access control
    if (role && !user?.isPrimarySuperAdmin && role.name !== 'Super Admin') {
      const scope = role.recordScope?.orders || 'all';
      if (scope === 'none') {
        return res.json({ success: true, count: 0, orders: [] });
      }
      if (scope === 'assigned') {
        const code = (user?.salesRepCode || user?.name || '').toLowerCase();
        orders = orders.filter(o => 
          o.salesRep.toLowerCase() === code ||
          o.salesRep.toLowerCase() === (user?.name || '').toLowerCase()
        );
      }
      // If scope === 'team' or 'all', they can see all sales team orders
    }

    const { 
      search, 
      paymentStatus, 
      deliveryStatus, 
      salesRep, 
      startDate, 
      endDate,
      client,
      service,
      minAmount,
      maxAmount,
    } = req.query as Record<string, string>;

    // Filter by search query
    if (search) {
      const q = search.toLowerCase().trim();
      orders = orders.filter(o => 
        o.id.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.clientContact.toLowerCase().includes(q) ||
        o.salesRep.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.remarks.toLowerCase().includes(q)
      );
    }

    if (paymentStatus && paymentStatus !== 'All') {
      orders = orders.filter(o => o.paymentStatus === paymentStatus);
    }

    if (deliveryStatus && deliveryStatus !== 'All') {
      orders = orders.filter(o => o.deliveryStatus === deliveryStatus);
    }

    if (salesRep && salesRep !== 'All') {
      orders = orders.filter(o => o.salesRep.toLowerCase() === salesRep.toLowerCase());
    }

    if (client) {
      orders = orders.filter(o => o.clientName.toLowerCase().includes(client.toLowerCase()));
    }

    if (service && service !== 'All') {
      orders = orders.filter(o => o.serviceName.toLowerCase().includes(service.toLowerCase()));
    }

    if (startDate) {
      orders = orders.filter(o => (o.bookingDate || o.createdAt).slice(0, 10) >= startDate);
    }

    if (endDate) {
      orders = orders.filter(o => (o.bookingDate || o.createdAt).slice(0, 10) <= endDate);
    }

    if (minAmount) {
      orders = orders.filter(o => o.totalAmount >= parseFloat(minAmount));
    }

    if (maxAmount) {
      orders = orders.filter(o => o.totalAmount <= parseFloat(maxAmount));
    }

    // Sort by bookingDate/createdAt desc
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single order with complete relational tree
ordersRouter.get('/:id', requirePermission('orders', 'view'), (req: AuthenticatedRequest, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: `Order ${req.params.id} not found.` });
  }

  const linkedPayouts = store.getPayoutsByOrderId(order.id);
  const auditLogs = store.getAuditLogs().filter(a => a.entityId.toLowerCase() === order.id.toLowerCase());

  res.json({
    success: true,
    order,
    linkedPayouts,
    auditLogs,
    relationship: {
      orderId: order.id,
      clientName: order.clientName,
      salesRep: order.salesRep,
      serviceName: order.serviceName,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      dueAmount: order.dueAmount,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
      assignedResources: linkedPayouts.map(p => ({
        payoutId: p.id,
        workerName: p.resourceWorkerName,
        agreedPayout: p.agreedPayoutAmount,
        advancePaid: p.advancePaid,
        dueFinalPayable: p.dueFinalPayable,
        status: p.deliveryStatus,
        paymentStatus: p.paymentStatus,
      })),
    }
  });
});

// POST create order
ordersRouter.post('/', requirePermission('orders', 'create'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';
    const newOrder = store.createOrder(req.body, actor, 'Dashboard');

    // Async push to Google Sheets
    googleSheetsService.pushOrder(newOrder).catch(err => {
      console.warn('[Orders] Sheets push error:', err.message);
    });

    // Async Telegram notification
    telegramService.notifyNewOrder(newOrder).catch(err => {
      console.warn('[Orders] Telegram dispatch error:', err.message);
    });

    res.status(201).json({ success: true, order: newOrder, message: `Order ${newOrder.id} created successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update order
ordersRouter.put('/:id', requirePermission('orders', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';
    const current = store.getOrderById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: `Order ${req.params.id} not found.` });
    }

    const previousDelivery = current.deliveryStatus;
    const previousPayment = current.paymentStatus;
    const previousPaid = current.paidAmount;

    const updatedOrder = store.updateOrder(req.params.id, req.body, actor, 'Dashboard');

    // Sync to Google Sheets
    googleSheetsService.pushOrder(updatedOrder).catch(err => {
      console.warn('[Orders] Sheets push error:', err.message);
    });

    // Telegram notification if status or payment changed
    const changes: string[] = [];
    if (req.body.deliveryStatus && req.body.deliveryStatus !== previousDelivery) {
      changes.push(`Delivery: ${previousDelivery} → ${req.body.deliveryStatus}`);
    }
    if (req.body.paymentStatus && req.body.paymentStatus !== previousPayment) {
      changes.push(`Payment: ${previousPayment} → ${req.body.paymentStatus}`);
    }
    if (req.body.paidAmount !== undefined && Number(req.body.paidAmount) !== previousPaid) {
      changes.push(`Payment Collected: +৳${(Number(req.body.paidAmount) - previousPaid).toLocaleString()}`);
    }

    if (changes.length > 0) {
      telegramService.notifyOrderUpdate(updatedOrder, changes.join(', ')).catch(err => {
        console.warn('[Orders] Telegram notify error:', err.message);
      });
    }

    res.json({ success: true, order: updatedOrder, message: `Order ${updatedOrder.id} updated successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH update order
ordersRouter.patch('/:id', requirePermission('orders', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';
    const current = store.getOrderById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: `Order ${req.params.id} not found.` });
    }

    const updatedOrder = store.updateOrder(req.params.id, req.body, actor, 'Dashboard');
    googleSheetsService.pushOrder(updatedOrder).catch(err => {
      console.warn('[Orders] Sheets push error:', err.message);
    });

    res.json({ success: true, order: updatedOrder, message: `Order ${updatedOrder.id} updated successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE order - Restricted exclusively to Super Admin
ordersRouter.delete('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.user?.name || 'Super Admin';
  const orderId = req.params.id;

  const order = store.getOrderById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
  }

  // Delete from CRM database
  const ok = store.deleteOrder(orderId, actor, true);
  if (!ok) {
    return res.status(404).json({ success: false, message: `Order ${orderId} could not be deleted.` });
  }

  // Propagate deletion to Google Sheets
  googleSheetsService.deleteRecordFromSheets('order', orderId).catch(err => {
    console.warn(`[Orders] Failed to delete ${orderId} from Sheets:`, err.message);
  });

  res.json({ 
    success: true, 
    message: `Order ${orderId} has been permanently deleted by Super Admin and removed from active dataset & Google Sheets.` 
  });
});

// POST bulk status update
ordersRouter.post('/bulk-status', requirePermission('orders', 'changeStatus'), async (req: AuthenticatedRequest, res) => {
  const { ids, deliveryStatus, paymentStatus } = req.body;
  const actor = req.user?.name || (req.headers['x-user-name'] as string) || 'Admin';

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or empty order IDs.' });
  }

  let updatedCount = 0;
  for (const id of ids) {
    try {
      const updates: any = {};
      if (deliveryStatus) updates.deliveryStatus = deliveryStatus;
      if (paymentStatus) updates.paymentStatus = paymentStatus;
      const order = store.updateOrder(id, updates, actor, 'Dashboard');
      googleSheetsService.pushOrder(order).catch(() => {});
      updatedCount++;
    } catch {}
  }

  res.json({ success: true, message: `Successfully updated ${updatedCount} orders.` });
});
