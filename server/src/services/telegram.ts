import { store } from '../db/store.js';
import { Order, Expense, Payout } from '../types/index.js';

/**
 * Parse one or multiple chat IDs from a formatted string
 * Supports comma, newline, semicolon, or space separation and trims tokens.
 */
export function parseChatIds(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const parts = raw
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

export interface SendMessageResult {
  ok: boolean;
  description?: string;
}

export class TelegramService {
  /**
   * Sends a message to a specific Telegram chat with HTML/Markdown fallback.
   * If Markdown parsing fails due to illegal characters in user names or IDs,
   * it gracefully falls back to raw plain text so messages are never lost.
   */
  private async sendMessage(botToken: string, chatId: string, text: string): Promise<SendMessageResult> {
    if (!botToken || !chatId) {
      return { ok: false, description: 'Missing bot token or chat ID' };
    }

    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    try {
      const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
      
      // Attempt 1: Send with Markdown parse mode
      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      let data: any = await res.json().catch(() => ({}));

      // If Telegram rejects due to Markdown parse entity error, retry as plain text
      if (!res.ok || !data.ok) {
        const errorDesc = String(data.description || res.statusText || '');
        if (errorDesc.toLowerCase().includes('can\'t parse entities') || errorDesc.toLowerCase().includes('parse')) {
          console.warn(`[Telegram] Markdown parse failed for chat ${cleanChatId}, retrying without parse_mode:`, errorDesc);
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cleanChatId,
              text,
            }),
          });
          data = await res.json().catch(() => ({}));
        }
      }

      if (!res.ok || !data.ok) {
        const desc = data.description || res.statusText || 'Unknown Telegram API error';
        console.warn(`[Telegram] API Error for chat ${cleanChatId}:`, desc);
        return { ok: false, description: desc };
      }

      return { ok: true };
    } catch (err: any) {
      const msg = err.message || 'Network connection failed';
      console.warn(`[Telegram] Failed to dispatch message to ${cleanChatId}:`, msg);
      return { ok: false, description: msg };
    }
  }

  /**
   * Broadcast message to all parsed target chat IDs concurrently using Promise.allSettled
   * An error or bad chat ID on one channel never blocks the others.
   */
  public async sendMessageToChats(
    botToken: string, 
    rawChatIds: string, 
    text: string
  ): Promise<{ 
    success: boolean; 
    sentCount: number; 
    totalCount: number; 
    failedIds: string[]; 
    errorDetails: Record<string, string>;
  }> {
    const chatIds = parseChatIds(rawChatIds);
    if (!botToken || chatIds.length === 0) {
      return { 
        success: false, 
        sentCount: 0, 
        totalCount: 0, 
        failedIds: [], 
        errorDetails: {} 
      };
    }

    const failedIds: string[] = [];
    const errorDetails: Record<string, string> = {};

    const results = await Promise.allSettled(
      chatIds.map(async (id) => {
        const res = await this.sendMessage(botToken, id, text);
        if (!res.ok) {
          failedIds.push(id);
          errorDetails[id] = res.description || 'Unknown error';
        }
        return res.ok;
      })
    );

    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    return {
      success: sentCount > 0,
      sentCount,
      totalCount: chatIds.length,
      failedIds,
      errorDetails,
    };
  }

  // --- BOT 1: Sales & Orders Notifications ---
  public async notifyNewOrder(order: Order): Promise<boolean> {
    const config = store.getSettings().telegram.salesBot;
    if (!config.enabled || !config.botToken || !config.chatId) return false;

    const message = [
      `📦 *NEW ORDER — TOTO DEVELOPMENT*`,
      `━━━━━━━━━━━━━━━━━━━`,
      `*Order ID:* \`${order.id}\``,
      `*Client:* ${order.clientName}`,
      `*Contact:* ${order.clientContact || 'N/A'}`,
      `*Service:* ${order.serviceName}`,
      `*Quantity:* ${order.quantityUnit}`,
      `*Target Deadline:* ${order.targetDeadline || 'Open'}`,
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

    const result = await this.sendMessageToChats(config.botToken, config.chatId, message);
    return result.success;
  }

  public async notifyOrderUpdate(order: Order, changeSummary: string): Promise<boolean> {
    const config = store.getSettings().telegram.salesBot;
    if (!config.enabled || !config.botToken || !config.chatId) return false;

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

    const result = await this.sendMessageToChats(config.botToken, config.chatId, message);
    return result.success;
  }

  // --- BOT 2: Expense Management Notifications ---
  public async notifyNewExpense(expense: Expense): Promise<boolean> {
    const config = store.getSettings().telegram.expenseBot;
    if (!config.enabled || !config.botToken || !config.chatId) return false;

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

    const result = await this.sendMessageToChats(config.botToken, config.chatId, message);
    return result.success;
  }

  public async notifyExpenseApproved(expense: Expense, approver: string): Promise<boolean> {
    const config = store.getSettings().telegram.expenseBot;
    if (!config.enabled || !config.botToken || !config.chatId) return false;

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

    const result = await this.sendMessageToChats(config.botToken, config.chatId, message);
    return result.success;
  }

  // --- BOT 3: Project Payout Notifications ---
  public async notifyNewPayout(payout: Payout): Promise<boolean> {
    const config = store.getSettings().telegram.payoutBot;
    if (!config.enabled || !config.botToken || !config.chatId) return false;

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

    const result = await this.sendMessageToChats(config.botToken, config.chatId, message);
    return result.success;
  }

  public async notifyPayoutUpdate(payout: Payout, statusText: string): Promise<boolean> {
    const config = store.getSettings().telegram.payoutBot;
    if (!config.enabled || !config.botToken || !config.chatId) return false;

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

    const result = await this.sendMessageToChats(config.botToken, config.chatId, message);
    return result.success;
  }

  // --- Test Notification Sender ---
  public async sendTestMessage(
    botType: 'sales' | 'expense' | 'payout', 
    botToken: string, 
    rawChatIds: string
  ): Promise<{ success: boolean; message: string; sentCount?: number; totalCount?: number; failedIds?: string[] }> {
    const names = {
      sales: 'Sales & Orders Bot (Bot 1)',
      expense: 'Expense & Cost Management Bot (Bot 2)',
      payout: 'Project & Resource Payout Bot (Bot 3)',
    };

    const chatIds = parseChatIds(rawChatIds);
    if (chatIds.length === 0) {
      return { success: false, message: 'Please provide at least one valid Chat ID or channel username.' };
    }

    const text = `🤖 *TOTO DEVELOPMENT TELEGRAM BOT TEST*\n\n✅ *${names[botType]}* is connected and working perfectly!\n\n_Dispatched to ${chatIds.length} target chat(s)_\n_Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} (Dhaka Time)_`;

    const result = await this.sendMessageToChats(botToken, rawChatIds, text);

    if (result.sentCount === result.totalCount && result.totalCount > 0) {
      return {
        success: true,
        message: `Test message successfully delivered to all ${result.sentCount} configured chat(s)! (${chatIds.join(', ')})`,
        sentCount: result.sentCount,
        totalCount: result.totalCount,
      };
    } else if (result.sentCount > 0) {
      const details = Object.entries(result.errorDetails)
        .map(([id, err]) => `${id}: ${err}`)
        .join('; ');
      return {
        success: true,
        message: `Partially delivered: Sent to ${result.sentCount}/${result.totalCount} chat(s). Failed for: ${result.failedIds.join(', ')} (${details}).`,
        sentCount: result.sentCount,
        totalCount: result.totalCount,
        failedIds: result.failedIds,
      };
    }

    const firstError = Object.values(result.errorDetails)[0] || 'Invalid Bot Token or Chat ID';
    return {
      success: false,
      message: `Failed to deliver to Telegram: ${firstError}. Please verify your Bot Token and ensure your bot is an admin/member in the target chat(s).`,
      sentCount: 0,
      totalCount: result.totalCount,
      failedIds: result.failedIds,
    };
  }
}

export const telegramService = new TelegramService();
