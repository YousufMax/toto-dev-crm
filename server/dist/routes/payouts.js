import { Router } from 'express';
import { store } from '../db/store.js';
import { googleSheetsService } from '../services/sheets.js';
import { telegramService } from '../services/telegram.js';
import { requirePermission, requireSuperAdmin } from '../middleware/auth.js';
export const payoutsRouter = Router();
// GET all payouts with query filters and record-level access control
payoutsRouter.get('/', requirePermission('payouts', 'view'), (req, res) => {
    try {
        let payouts = store.getPayouts();
        const user = req.user;
        const role = req.role;
        // Record-level access control
        if (role && !user?.isPrimarySuperAdmin && role.name !== 'Super Admin') {
            const scope = role.recordScope?.payouts || 'all';
            if (scope === 'none') {
                return res.json({ success: true, count: 0, payouts: [] });
            }
            if (scope === 'assigned') {
                const worker = (user?.workerName || user?.name || '').toLowerCase();
                payouts = payouts.filter(p => p.resourceWorkerName.toLowerCase() === worker ||
                    p.resourceWorkerName.toLowerCase() === (user?.name || '').toLowerCase());
            }
        }
        const { search, worker, orderId, deliveryStatus, paymentStatus, commissionType, startDate, endDate, } = req.query;
        if (search) {
            const q = search.toLowerCase().trim();
            payouts = payouts.filter(p => p.id.toLowerCase().includes(q) ||
                p.projectOrderId.toLowerCase().includes(q) ||
                p.resourceWorkerName.toLowerCase().includes(q) ||
                p.serviceName.toLowerCase().includes(q) ||
                p.clientName.toLowerCase().includes(q) ||
                p.transactionRefId.toLowerCase().includes(q) ||
                p.remarks.toLowerCase().includes(q));
        }
        if (worker && worker !== 'All') {
            payouts = payouts.filter(p => p.resourceWorkerName.toLowerCase() === worker.toLowerCase());
        }
        if (orderId) {
            payouts = payouts.filter(p => p.projectOrderId.toLowerCase() === orderId.toLowerCase());
        }
        if (deliveryStatus && deliveryStatus !== 'All') {
            payouts = payouts.filter(p => p.deliveryStatus === deliveryStatus);
        }
        if (paymentStatus && paymentStatus !== 'All') {
            payouts = payouts.filter(p => p.paymentStatus === paymentStatus);
        }
        if (commissionType && commissionType !== 'All') {
            payouts = payouts.filter(p => p.commissionType === commissionType);
        }
        if (startDate) {
            payouts = payouts.filter(p => p.createdAt.slice(0, 10) >= startDate);
        }
        if (endDate) {
            payouts = payouts.filter(p => p.createdAt.slice(0, 10) <= endDate);
        }
        payouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({
            success: true,
            count: payouts.length,
            payouts,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET single payout
payoutsRouter.get('/:id', requirePermission('payouts', 'view'), (req, res) => {
    const payout = store.getPayoutById(req.params.id);
    if (!payout) {
        return res.status(404).json({ success: false, message: `Payout ${req.params.id} not found.` });
    }
    const parentOrder = store.getOrderById(payout.projectOrderId);
    const auditLogs = store.getAuditLogs().filter(a => a.entityId.toLowerCase() === payout.id.toLowerCase());
    res.json({
        success: true,
        payout,
        parentOrder,
        auditLogs,
    });
});
// POST create payout
payoutsRouter.post('/', requirePermission('payouts', 'create'), async (req, res) => {
    try {
        const actor = req.user?.name || req.headers['x-user-name'] || 'Admin';
        const newPayout = store.createPayout(req.body, actor, 'Dashboard');
        // Async push to Google Sheets
        googleSheetsService.pushPayout(newPayout).catch(err => {
            console.warn('[Payouts] Sheets push error:', err.message);
        });
        // Async Telegram notification
        telegramService.notifyNewPayout(newPayout).catch(err => {
            console.warn('[Payouts] Telegram dispatch error:', err.message);
        });
        res.status(201).json({ success: true, payout: newPayout, message: `Payout ${newPayout.id} created successfully.` });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// PUT update payout
payoutsRouter.put('/:id', requirePermission('payouts', 'edit'), async (req, res) => {
    try {
        const actor = req.user?.name || req.headers['x-user-name'] || 'Admin';
        const current = store.getPayoutById(req.params.id);
        if (!current) {
            return res.status(404).json({ success: false, message: `Payout ${req.params.id} not found.` });
        }
        const previousStatus = current.deliveryStatus;
        const previousPayment = current.paymentStatus;
        const previousAdvance = current.advancePaid;
        const updatedPayout = store.updatePayout(req.params.id, req.body, actor, 'Dashboard');
        // Sync to Google Sheets
        googleSheetsService.pushPayout(updatedPayout).catch(err => {
            console.warn('[Payouts] Sheets push error:', err.message);
        });
        // Telegram notification if settlement changed
        const changes = [];
        if (req.body.deliveryStatus && req.body.deliveryStatus !== previousStatus) {
            changes.push(`Status: ${previousStatus} → ${req.body.deliveryStatus}`);
        }
        if (req.body.paymentStatus && req.body.paymentStatus !== previousPayment) {
            changes.push(`Payment: ${previousPayment} → ${req.body.paymentStatus}`);
        }
        if (req.body.advancePaid !== undefined && Number(req.body.advancePaid) !== previousAdvance) {
            changes.push(`Advance: ৳${previousAdvance.toLocaleString()} → ৳${Number(req.body.advancePaid).toLocaleString()}`);
        }
        if (changes.length > 0) {
            telegramService.notifyPayoutUpdate(updatedPayout, changes.join(', ')).catch((err) => {
                console.warn('[Payouts] Telegram notify error:', err.message);
            });
        }
        res.json({ success: true, payout: updatedPayout, message: `Payout ${updatedPayout.id} updated successfully.` });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// POST disburse payment (advance or final)
payoutsRouter.post('/:id/pay', requirePermission('payouts', 'edit'), async (req, res) => {
    try {
        const actor = req.user?.name || req.headers['x-user-name'] || 'Admin';
        const current = store.getPayoutById(req.params.id);
        if (!current) {
            return res.status(404).json({ success: false, message: `Payout ${req.params.id} not found.` });
        }
        const { type, amount, paymentMethod, transactionRefId } = req.body;
        const payAmt = Number(amount) || 0;
        const newAdvance = type === 'final'
            ? current.agreedPayoutAmount
            : ((current.advancePaid || 0) + payAmt);
        const paymentStatus = newAdvance >= current.agreedPayoutAmount ? 'Paid' : 'Partial';
        const approvalStatus = type === 'final' ? 'Final Paid' : 'Advance Paid';
        const updatedPayout = store.updatePayout(req.params.id, {
            advancePaid: newAdvance,
            paymentStatus,
            approvalStatus,
            paymentMethod: paymentMethod || current.paymentMethod,
            transactionRefId: transactionRefId || current.transactionRefId,
        }, actor, 'Dashboard');
        googleSheetsService.pushPayout(updatedPayout).catch(err => {
            console.warn('[Payouts] Sheets push error:', err.message);
        });
        res.json({ success: true, payout: updatedPayout, message: `Payout payment recorded successfully.` });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// DELETE payout - Restricted exclusively to Super Admin
payoutsRouter.delete('/:id', requireSuperAdmin, async (req, res) => {
    const actor = req.user?.name || 'Super Admin';
    const payoutId = req.params.id;
    const payout = store.getPayoutById(payoutId);
    if (!payout) {
        return res.status(404).json({ success: false, message: `Payout ${payoutId} not found.` });
    }
    // 1. Propagate deletion to Google Sheets first and await result
    try {
        await googleSheetsService.deleteRecordFromSheets('payout', payoutId);
    }
    catch (err) {
        console.error(`[Payouts] Failed to delete ${payoutId} from Google Sheets:`, err.message);
        return res.status(502).json({
            success: false,
            message: `Failed to remove Payout ${payoutId} from Google Sheets: ${err.message}. Deletion was aborted to prevent data desynchronization.`
        });
    }
    // 2. Delete from CRM database and record tombstone
    const ok = store.deletePayout(payoutId, actor, true);
    if (!ok) {
        return res.status(500).json({ success: false, message: `Payout ${payoutId} could not be deleted from local store.` });
    }
    res.json({
        success: true,
        message: `Payout ${payoutId} has been permanently deleted by Super Admin and removed from active dataset & Google Sheets.`
    });
});
