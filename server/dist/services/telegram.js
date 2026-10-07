import { store } from '../db/store.js';
export class TelegramService {
    async sendMessage(botToken, chatId, text) {
        if (!botToken || !chatId) {
            return false;
        }
        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'Markdown',
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                console.warn('[Telegram] API Error:', data.description || res.statusText);
                return false;
            }
            return true;
        }
        catch (err) {
            console.warn('[Telegram] Failed to dispatch message:', err.message);
            return false;
        }
    }
    // --- BOT 1: Sales & Orders Notifications ---
    async notifyNewOrder(order) {
        const config = store.getSettings().telegram.salesBot;
        if (!config.enabled || !config.botToken || !config.chatId)
            return false;
        const message = [
            `📦 *NEW ORDER — TOTO DEVELOPMENT*`,
            `━━━━━━━━━━━━━━━━━━━`,
            `*Order ID:* \`${order.id}\``,
            `*Client:* ${order.clientName}`,
            `*Contact:* ${order.clientContact || 'N/A'}`,
            `*Service:* ${order.serviceName}`,
            `*Quantity:* ${order.quantityUnit}`,
            `*Total Amount:* ৳${order.totalAmount.toLocaleString()}`,
            `*Paid Amount:* ৳${order.paidAmount.toLocaleString()}`,
            `*Due Amount:* ৳${order.dueAmount.toLocaleString()}`,
            `*Sales Rep:* ${order.salesRep}`,
            `*Payment Status:* ${order.paymentStatus}`,
            `*Delivery Status:* ${order.deliveryStatus}`,
            `*Method:* ${order.paymentMethod}`,
            order.remarks ? `*Remarks:* _${order.remarks}_` : '',
            `━━━━━━━━━━━━━━━━━━━`,
            `_Logged via ${order.source}_`,
        ].filter(Boolean).join('\n');
        return this.sendMessage(config.botToken, config.chatId, message);
    }
    async notifyOrderUpdate(order, changeSummary) {
        const config = store.getSettings().telegram.salesBot;
        if (!config.enabled || !config.botToken || !config.chatId)
            return false;
        const message = [
            `🔄 *ORDER UPDATED — TOTO DEVELOPMENT*`,
            `━━━━━━━━━━━━━━━━━━━`,
            `*Order ID:* \`${order.id}\``,
            `*Client:* ${order.clientName}`,
            `*Update:* ${changeSummary}`,
            `*Payment Status:* ${order.paymentStatus}`,
            `*Delivery Status:* ${order.deliveryStatus}`,
            `*Paid:* ৳${order.paidAmount.toLocaleString()} | *Due:* ৳${order.dueAmount.toLocaleString()}`,
        ].join('\n');
        return this.sendMessage(config.botToken, config.chatId, message);
    }
    // --- BOT 2: Expense Management Notifications ---
    async notifyNewExpense(expense) {
        const config = store.getSettings().telegram.expenseBot;
        if (!config.enabled || !config.botToken || !config.chatId)
            return false;
        const isLarge = expense.amount >= (config.largeExpenseThreshold || 10000);
        const message = [
            isLarge ? `🚨 *HIGH EXPENSE ALERT — TOTO DEVELOPMENT*` : `💳 *NEW EXPENSE — TOTO DEVELOPMENT*`,
            `━━━━━━━━━━━━━━━━━━━`,
            `*Expense ID:* \`${expense.id}\``,
            `*Category:* ${expense.category}`,
            `*Sub-Category / Purpose:* ${expense.subCategoryPurpose}`,
            `*Vendor / Receiver:* ${expense.vendorReceiverName}`,
            `*Amount:* *৳${expense.amount.toLocaleString()}*`,
            `*Payment Method:* ${expense.paymentMethod}`,
            `*Paid From Account:* ${expense.paidFromAccount}`,
            expense.transactionRefId ? `*Txn ID:* \`${expense.transactionRefId}\`` : '',
            `*Approved By:* ${expense.approvedBy || 'Pending'}`,
            `*Status:* ${expense.approvalStatus}`,
            expense.remarks ? `*Remarks:* _${expense.remarks}_` : '',
        ].filter(Boolean).join('\n');
        return this.sendMessage(config.botToken, config.chatId, message);
    }
    async notifyExpenseApproved(expense, approver) {
        const config = store.getSettings().telegram.expenseBot;
        if (!config.enabled || !config.botToken || !config.chatId)
            return false;
        const message = [
            `✅ *EXPENSE APPROVED & CLEARED*`,
            `━━━━━━━━━━━━━━━━━━━`,
            `*Expense ID:* \`${expense.id}\``,
            `*Category:* ${expense.category}`,
            `*Amount:* ৳${expense.amount.toLocaleString()}`,
            `*Approved By:* ${approver}`,
            `*Vendor/Receiver:* ${expense.vendorReceiverName}`,
            `*Status:* ${expense.approvalStatus}`,
        ].join('\n');
        return this.sendMessage(config.botToken, config.chatId, message);
    }
    // --- BOT 3: Project Payout Notifications ---
    async notifyNewPayout(payout) {
        const config = store.getSettings().telegram.payoutBot;
        if (!config.enabled || !config.botToken || !config.chatId)
            return false;
        const message = [
            `💼 *RESOURCE PAYOUT CREATED*`,
            `━━━━━━━━━━━━━━━━━━━`,
            `*Payout ID:* \`${payout.id}\``,
            `*Project / Order:* \`${payout.projectOrderId}\``,
            `*Resource:* ${payout.resourceWorkerName}`,
            `*Service:* ${payout.serviceName}`,
            `*Agreed Payout:* ৳${payout.agreedPayoutAmount.toLocaleString()}`,
            `*Advance Paid:* ৳${payout.advancePaid.toLocaleString()}`,
            `*Due / Final Payable:* ৳${payout.dueFinalPayable.toLocaleString()}`,
            `*Commission Type:* ${payout.commissionType}`,
            `*Delivery Status:* ${payout.deliveryStatus}`,
            `*Payment Status:* ${payout.paymentStatus}`,
        ].join('\n');
        return this.sendMessage(config.botToken, config.chatId, message);
    }
    async notifyPayoutUpdate(payout, statusText) {
        const config = store.getSettings().telegram.payoutBot;
        if (!config.enabled || !config.botToken || !config.chatId)
            return false;
        const message = [
            `💰 *PAYOUT UPDATE — TOTO DEVELOPMENT*`,
            `━━━━━━━━━━━━━━━━━━━`,
            `*Payout ID:* \`${payout.id}\``,
            `*Order ID:* \`${payout.projectOrderId}\``,
            `*Resource:* ${payout.resourceWorkerName}`,
            `*Status:* ${statusText}`,
            `*Advance:* ৳${payout.advancePaid.toLocaleString()}`,
            `*Final Due:* ৳${payout.dueFinalPayable.toLocaleString()}`,
            `*Method:* ${payout.paymentMethod}`,
            payout.transactionRefId ? `*Txn ID:* \`${payout.transactionRefId}\`` : '',
        ].filter(Boolean).join('\n');
        return this.sendMessage(config.botToken, config.chatId, message);
    }
    // --- Test Notification Sender ---
    async sendTestMessage(botType, botToken, chatId) {
        const names = {
            sales: 'Sales & Orders Bot (Bot 1)',
            expense: 'Expense & Cost Management Bot (Bot 2)',
            payout: 'Project & Resource Payout Bot (Bot 3)',
        };
        const text = `🤖 *TOTO DEVELOPMENT TELEGRAM BOT TEST*\n\n✅ *${names[botType]}* is connected and working perfectly!\n\n_Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} (Dhaka Time)_`;
        const ok = await this.sendMessage(botToken, chatId, text);
        if (ok) {
            return { success: true, message: `Test message successfully sent to ${names[botType]}!` };
        }
        return { success: false, message: `Failed to deliver message. Please verify Bot Token and Chat ID.` };
    }
}
export const telegramService = new TelegramService();
