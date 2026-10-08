import { Router } from 'express';
import { store } from '../db/store.js';
import { telegramService } from '../services/telegram.js';
export const telegramRouter = Router();
// Helper to mask token for security
function maskToken(token) {
    if (!token)
        return '';
    if (token.length < 10)
        return '***';
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
}
// GET Telegram configuration (tokens masked)
telegramRouter.get('/config', (req, res) => {
    const { telegram } = store.getSettings();
    res.json({
        success: true,
        config: {
            salesBot: {
                enabled: telegram.salesBot.enabled,
                botTokenMasked: maskToken(telegram.salesBot.botToken),
                chatId: telegram.salesBot.chatId,
                hasToken: Boolean(telegram.salesBot.botToken),
            },
            expenseBot: {
                enabled: telegram.expenseBot.enabled,
                botTokenMasked: maskToken(telegram.expenseBot.botToken),
                chatId: telegram.expenseBot.chatId,
                largeExpenseThreshold: telegram.expenseBot.largeExpenseThreshold,
                hasToken: Boolean(telegram.expenseBot.botToken),
            },
            payoutBot: {
                enabled: telegram.payoutBot.enabled,
                botTokenMasked: maskToken(telegram.payoutBot.botToken),
                chatId: telegram.payoutBot.chatId,
                hasToken: Boolean(telegram.payoutBot.botToken),
            },
        }
    });
});
// POST save Telegram configuration
telegramRouter.post('/config', (req, res) => {
    const current = store.getSettings().telegram;
    const { salesBot, expenseBot, payoutBot } = req.body;
    const updated = store.updateSettings({
        telegram: {
            salesBot: {
                ...current.salesBot,
                enabled: salesBot?.enabled !== undefined ? salesBot.enabled : current.salesBot.enabled,
                botToken: salesBot?.botToken ? salesBot.botToken.trim() : current.salesBot.botToken,
                chatId: salesBot?.chatId ? salesBot.chatId.trim() : current.salesBot.chatId,
            },
            expenseBot: {
                ...current.expenseBot,
                enabled: expenseBot?.enabled !== undefined ? expenseBot.enabled : current.expenseBot.enabled,
                botToken: expenseBot?.botToken ? expenseBot.botToken.trim() : current.expenseBot.botToken,
                chatId: expenseBot?.chatId ? expenseBot.chatId.trim() : current.expenseBot.chatId,
                largeExpenseThreshold: expenseBot?.largeExpenseThreshold !== undefined ? Number(expenseBot.largeExpenseThreshold) : current.expenseBot.largeExpenseThreshold,
            },
            payoutBot: {
                ...current.payoutBot,
                enabled: payoutBot?.enabled !== undefined ? payoutBot.enabled : current.payoutBot.enabled,
                botToken: payoutBot?.botToken ? payoutBot.botToken.trim() : current.payoutBot.botToken,
                chatId: payoutBot?.chatId ? payoutBot.chatId.trim() : current.payoutBot.chatId,
            },
        }
    });
    res.json({ success: true, message: 'Telegram configuration saved successfully.' });
});
// POST send test notification
telegramRouter.post('/test', async (req, res) => {
    const { botType, botToken: directToken, chatId: directChatId } = req.body;
    const settings = store.getSettings().telegram;
    let token = (directToken || '').trim();
    let chatId = (directChatId || '').trim();
    if (botType === 'sales') {
        token = token || settings.salesBot.botToken;
        chatId = chatId || settings.salesBot.chatId;
    }
    else if (botType === 'expense') {
        token = token || settings.expenseBot.botToken;
        chatId = chatId || settings.expenseBot.chatId;
    }
    else if (botType === 'payout') {
        token = token || settings.payoutBot.botToken;
        chatId = chatId || settings.payoutBot.chatId;
    }
    if (!token) {
        return res.status(400).json({
            success: false,
            message: `Bot Token for ${botType} bot is missing. Please enter your Telegram Bot Token from @BotFather.`,
        });
    }
    if (!chatId) {
        return res.status(400).json({
            success: false,
            message: `Chat ID for ${botType} bot is missing. Please enter your Chat ID (e.g. -100123456789 or @channel).`,
        });
    }
    const result = await telegramService.sendTestMessage(botType, token, chatId);
    res.json(result);
});
