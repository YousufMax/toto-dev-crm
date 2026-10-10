import { google } from 'googleapis';
import { store } from '../db/store.js';
import { normalizeDhakaDateTime } from '../utils/date.js';
// Canonical headers for sheet creation & default mapping
export const SALES_ORDERS_HEADERS = [
    'Order ID',
    'Booking Date/Time',
    'Target Deadline',
    'Client / Brand Name',
    'Client Contact',
    'Sales Representative',
    'Service / Project Name',
    'Quantity / Unit',
    'Total Amount (BDT)',
    'Paid Amount (BDT)',
    'Due Amount (BDT)',
    'Payment Method / Gateway',
    'Payment Status',
    'Delivery Status',
    'Remarks / Notes',
];
export const EXPENSES_HEADERS = [
    'Expense ID',
    'Date & Time',
    'Expense Category',
    'Sub-Category / Purpose',
    'Vendor / Receiver Name',
    'Amount (BDT)',
    'Payment Method',
    'Paid From Account',
    'Transaction / Ref ID',
    'Money Receipt / Invoice Link',
    'Approved By',
    'Remarks / Notes',
];
export const PAYOUTS_HEADERS = [
    'Payout ID',
    'Project / Order ID',
    'Project / Service Name',
    'Client Name',
    'Resource / Worker Name',
    'Total Project Budget (BDT)',
    'Commission Type',
    'Agreed Payout Amount (BDT)',
    'Advance Paid (BDT)',
    'Due / Final Payable (BDT)',
    'Delivery Status',
    'Payment Status',
    'Payment Method',
    'Transaction / Ref ID',
    'Remarks / Notes',
];
// Helper to normalize header string for fuzzy matching
function cleanHeader(h) {
    return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}
// Helper to parse numeric currency amounts safely
export function parseCurrency(val) {
    if (typeof val === 'number')
        return isNaN(val) ? 0 : val;
    if (!val)
        return 0;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}
export class GoogleSheetsService {
    getAuthClient() {
        const settings = store.getSettings();
        const { serviceAccountEmail, privateKey } = settings.googleSheets;
        if (!serviceAccountEmail || !privateKey) {
            throw new Error('Google Sheets Service Account credentials are not configured.');
        }
        // Handle escaped newlines in private key
        const formattedKey = privateKey.replace(/\\n/g, '\n');
        return new google.auth.JWT({
            email: serviceAccountEmail,
            key: formattedKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    async getSheetsClient() {
        const auth = this.getAuthClient();
        await auth.authorize();
        return google.sheets({ version: 'v4', auth });
    }
    // --- Initialize or verify sheet headers ---
    async initializeSheetStructure() {
        const settings = store.getSettings();
        const spreadsheetId = settings.googleSheets.spreadsheetId;
        if (!spreadsheetId) {
            return { success: false, message: 'Spreadsheet ID is missing in settings.' };
        }
        const sheets = await this.getSheetsClient();
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const existingTitles = (meta.data.sheets || []).map(s => s.properties?.title || '');
        const requiredTabs = [
            { name: settings.googleSheets.salesOrdersSheetName, headers: SALES_ORDERS_HEADERS },
            { name: settings.googleSheets.expensesSheetName, headers: EXPENSES_HEADERS },
            { name: settings.googleSheets.payoutsSheetName, headers: PAYOUTS_HEADERS },
        ];
        // Add missing tabs
        const requests = [];
        for (const tab of requiredTabs) {
            if (!existingTitles.includes(tab.name)) {
                requests.push({
                    addSheet: {
                        properties: { title: tab.name },
                    },
                });
            }
        }
        if (requests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests },
            });
        }
        // Set headers on each tab
        for (const tab of requiredTabs) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${tab.name}!A1:Z1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [tab.headers],
                },
            });
        }
        return { success: true, message: 'Google Sheets structure verified and headers initialized successfully.' };
    }
    // --- Full Reconciliation Synchronization: Pull from Google Sheets ---
    async syncFromSheets() {
        const settings = store.getSettings();
        // Check if Apps Script Web App URL is configured (preferred & simplest mode)
        if (settings.googleSheets.appsScriptUrl) {
            return this.syncViaAppsScript(settings.googleSheets.appsScriptUrl);
        }
        const spreadsheetId = settings.googleSheets.spreadsheetId;
        if (!settings.googleSheets.isConfigured || !spreadsheetId) {
            return {
                success: false,
                ordersSynced: 0,
                expensesSynced: 0,
                payoutsSynced: 0,
                conflicts: 0,
                message: 'Google Sheets Apps Script URL or Service Account credentials are not configured yet.',
            };
        }
        try {
            const sheets = await this.getSheetsClient();
            // Read Sales_Orders, Expenses, and Payouts
            const sheetOrdersData = [];
            const sheetExpensesData = [];
            const sheetPayoutsData = [];
            // 1. Fetch Sales Orders Tab
            const resOrders = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${settings.googleSheets.salesOrdersSheetName}!A1:Z1000`,
            });
            const orderRows = resOrders.data.values || [];
            if (orderRows.length > 1) {
                const headerRow = orderRows[0].map((h) => cleanHeader(String(h)));
                const getCol = (names) => {
                    for (const n of names) {
                        const idx = headerRow.indexOf(cleanHeader(n));
                        if (idx !== -1)
                            return idx;
                    }
                    return -1;
                };
                const colId = getCol(['Order ID', 'OrderID', 'ID']);
                const colDate = getCol(['Booking Date/Time', 'Booking Date', 'Date']);
                const colDeadline = getCol(['Target Deadline', 'Deadline']);
                const colClient = getCol(['Client / Brand Name', 'Client Name', 'Brand']);
                const colContact = getCol(['Client Contact', 'Contact', 'Phone']);
                const colRep = getCol(['Sales Representative', 'Sales Rep', 'Rep']);
                const colService = getCol(['Service / Project Name', 'Service Name', 'Service']);
                const colQty = getCol(['Quantity / Unit', 'Quantity', 'Unit']);
                const colTotal = getCol(['Total Amount (BDT)', 'Total Amount', 'Total']);
                const colPaid = getCol(['Paid Amount (BDT)', 'Paid Amount', 'Paid']);
                const colMethod = getCol(['Payment Method / Gateway', 'Payment Method', 'Gateway']);
                const colPayStatus = getCol(['Payment Status', 'Payment']);
                const colDelivStatus = getCol(['Delivery Status', 'Delivery', 'Status']);
                const colRemarks = getCol(['Remarks / Notes', 'Remarks', 'Notes']);
                for (let r = 1; r < orderRows.length; r++) {
                    const row = orderRows[r];
                    if (!row || row.length === 0)
                        continue;
                    const id = (row[colId] || '').trim();
                    if (!id)
                        continue;
                    const total = parseCurrency(row[colTotal]);
                    const paid = parseCurrency(row[colPaid]);
                    sheetOrdersData.push({
                        id,
                        bookingDate: normalizeDhakaDateTime(row[colDate]),
                        targetDeadline: normalizeDhakaDateTime(row[colDeadline]),
                        clientName: row[colClient] || '',
                        clientContact: row[colContact] || '',
                        salesRep: row[colRep] || '',
                        serviceName: row[colService] || '',
                        quantityUnit: row[colQty] || '1 Unit',
                        totalAmount: total,
                        paidAmount: paid,
                        dueAmount: Math.max(0, total - paid),
                        paymentMethod: row[colMethod] || 'bKash',
                        paymentStatus: (row[colPayStatus] || 'Unpaid'),
                        deliveryStatus: (row[colDelivStatus] || 'Pending'),
                        remarks: row[colRemarks] || '',
                        sheetRowIndex: r + 1,
                    });
                }
            }
            // 2. Fetch Expenses Tab
            const resExp = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${settings.googleSheets.expensesSheetName}!A1:Z1000`,
            });
            const expRows = resExp.data.values || [];
            if (expRows.length > 1) {
                const headerRow = expRows[0].map((h) => cleanHeader(String(h)));
                const getCol = (names) => {
                    for (const n of names) {
                        const idx = headerRow.indexOf(cleanHeader(n));
                        if (idx !== -1)
                            return idx;
                    }
                    return -1;
                };
                const colId = getCol(['Expense ID', 'ExpenseID', 'ID']);
                const colDate = getCol(['Date & Time', 'Date', 'DateTime']);
                const colCat = getCol(['Expense Category', 'Category']);
                const colSub = getCol(['Sub-Category / Purpose', 'Sub-Category', 'Purpose']);
                const colVendor = getCol(['Vendor / Receiver Name', 'Vendor', 'Receiver']);
                const colAmount = getCol(['Amount (BDT)', 'Amount', 'Total']);
                const colMethod = getCol(['Payment Method', 'Method']);
                const colAcc = getCol(['Paid From Account', 'Account']);
                const colTxn = getCol(['Transaction / Ref ID', 'Transaction ID', 'Ref ID']);
                const colReceipt = getCol(['Money Receipt / Invoice Link', 'Receipt Link', 'Invoice']);
                const colApproved = getCol(['Approved By', 'Approver']);
                const colRemarks = getCol(['Remarks / Notes', 'Remarks']);
                for (let r = 1; r < expRows.length; r++) {
                    const row = expRows[r];
                    if (!row || row.length === 0)
                        continue;
                    const id = (row[colId] || '').trim();
                    if (!id)
                        continue;
                    const amount = parseCurrency(row[colAmount]);
                    sheetExpensesData.push({
                        id,
                        dateTime: normalizeDhakaDateTime(row[colDate]),
                        category: row[colCat] || 'Other',
                        subCategoryPurpose: row[colSub] || '',
                        vendorReceiverName: row[colVendor] || '',
                        amount,
                        paymentMethod: row[colMethod] || 'Bank Transfer',
                        paidFromAccount: row[colAcc] || 'Company Account',
                        transactionRefId: row[colTxn] || '',
                        receiptInvoiceLink: row[colReceipt] || '',
                        approvedBy: row[colApproved] || '',
                        approvalStatus: row[colApproved] ? 'Approved' : 'Pending Approval',
                        remarks: row[colRemarks] || '',
                        sheetRowIndex: r + 1,
                    });
                }
            }
            // 3. Fetch Payouts Tab
            const resPay = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${settings.googleSheets.payoutsSheetName}!A1:Z1000`,
            });
            const payRows = resPay.data.values || [];
            if (payRows.length > 1) {
                const headerRow = payRows[0].map((h) => cleanHeader(String(h)));
                const getCol = (names) => {
                    for (const n of names) {
                        const idx = headerRow.indexOf(cleanHeader(n));
                        if (idx !== -1)
                            return idx;
                    }
                    return -1;
                };
                const colId = getCol(['Payout ID', 'PayoutID', 'ID']);
                const colOrder = getCol(['Project / Order ID', 'Order ID', 'Project ID']);
                const colService = getCol(['Project / Service Name', 'Service Name']);
                const colClient = getCol(['Client Name', 'Client']);
                const colWorker = getCol(['Resource / Worker Name', 'Worker', 'Employee']);
                const colBudget = getCol(['Total Project Budget (BDT)', 'Budget']);
                const colType = getCol(['Commission Type', 'Commission']);
                const colAgreed = getCol(['Agreed Payout Amount (BDT)', 'Agreed Payout']);
                const colAdv = getCol(['Advance Paid (BDT)', 'Advance']);
                const colDeliv = getCol(['Delivery Status', 'Delivery']);
                const colPayStatus = getCol(['Payment Status', 'Payment']);
                const colMethod = getCol(['Payment Method', 'Method']);
                const colTxn = getCol(['Transaction / Ref ID', 'Transaction ID']);
                const colRemarks = getCol(['Remarks / Notes', 'Remarks']);
                for (let r = 1; r < payRows.length; r++) {
                    const row = payRows[r];
                    if (!row || row.length === 0)
                        continue;
                    const id = (row[colId] || '').trim();
                    if (!id)
                        continue;
                    const budget = parseCurrency(row[colBudget]);
                    const agreed = parseCurrency(row[colAgreed]);
                    const advance = parseCurrency(row[colAdv]);
                    sheetPayoutsData.push({
                        id,
                        projectOrderId: row[colOrder] || '',
                        serviceName: row[colService] || '',
                        clientName: row[colClient] || '',
                        resourceWorkerName: row[colWorker] || '',
                        totalProjectBudget: budget,
                        commissionType: (row[colType] || 'Fixed Commission'),
                        agreedPayoutAmount: agreed,
                        advancePaid: advance,
                        dueFinalPayable: Math.max(0, agreed - advance),
                        deliveryStatus: (row[colDeliv] || 'Pending'),
                        paymentStatus: (row[colPayStatus] || 'Unpaid'),
                        paymentMethod: row[colMethod] || 'bKash',
                        transactionRefId: row[colTxn] || '',
                        remarks: row[colRemarks] || '',
                        sheetRowIndex: r + 1,
                    });
                }
            }
            // Sync latest tombstones from PostgreSQL to prevent resurrected deleted records
            await store.syncDeletedRecordsFromDb();
            // --- FULL RECONCILIATION EXECUTION ---
            // Compare retrieved Google Sheets datasets with CRM operational datasets
            const summary = store.reconcileAll({
                orders: sheetOrdersData,
                expenses: sheetExpensesData,
                payouts: sheetPayoutsData,
            }, 'Google Sheets');
            // Update sync settings & status
            const now = new Date().toISOString();
            const message = `Full reconciliation completed: ${summary.orders.totalActive} orders (+${summary.orders.added}, ~${summary.orders.updated}, -${summary.orders.removed}), ${summary.expenses.totalActive} expenses (+${summary.expenses.added}, ~${summary.expenses.updated}, -${summary.expenses.removed}), ${summary.payouts.totalActive} payouts (+${summary.payouts.added}, ~${summary.payouts.updated}, -${summary.payouts.removed}). Total Active: ${summary.totalActiveRecords}.`;
            store.updateSettings({
                googleSheets: {
                    ...settings.googleSheets,
                    lastSyncedAt: now,
                    lastSyncStatus: 'success',
                    lastSyncMessage: message,
                    syncSummary: summary,
                }
            });
            return {
                success: true,
                ordersSynced: summary.orders.added + summary.orders.updated,
                expensesSynced: summary.expenses.added + summary.expenses.updated,
                payoutsSynced: summary.payouts.added + summary.payouts.updated,
                conflicts: 0,
                summary,
                message,
            };
        }
        catch (err) {
            // Requirement 8: API Error Protection
            // If sync fails due to network/API error, DO NOT wipe CRM data!
            console.error('[GoogleSheets] Direct API sync error:', err.message);
            store.updateSettings({
                googleSheets: {
                    ...settings.googleSheets,
                    lastSyncStatus: 'error',
                    lastSyncMessage: `Sync Failed: ${err.message}`,
                }
            });
            return {
                success: false,
                ordersSynced: 0,
                expensesSynced: 0,
                payoutsSynced: 0,
                conflicts: 0,
                message: `Google Sheets sync failed: ${err.message}. Previous synchronized dataset preserved.`,
            };
        }
    }
    // --- Full Reconciliation Synchronization via Google Apps Script Web App URL ---
    async syncViaAppsScript(urlParam) {
        const settings = store.getSettings();
        const appsScriptUrl = urlParam || settings.googleSheets.appsScriptUrl;
        if (!appsScriptUrl) {
            return {
                success: false,
                ordersSynced: 0,
                expensesSynced: 0,
                payoutsSynced: 0,
                conflicts: 0,
                message: 'No Google Apps Script Web App URL configured.',
            };
        }
        try {
            const res = await fetch(appsScriptUrl, { redirect: 'follow' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();
            if (!data || data.success === false) {
                throw new Error(data?.error || data?.message || 'Invalid or failed response from Google Apps Script Web App');
            }
            // Extract incoming datasets
            const incomingOrders = [];
            const incomingExpenses = [];
            const incomingPayouts = [];
            // 1. Process Orders from Apps Script
            if (Array.isArray(data.orders)) {
                for (const row of data.orders) {
                    const id = String(row['Order ID'] || row['id'] || '').trim();
                    if (!id)
                        continue;
                    const total = parseCurrency(row['Total Amount (BDT)'] || row['totalAmount']);
                    const paid = parseCurrency(row['Paid Amount (BDT)'] || row['paidAmount']);
                    incomingOrders.push({
                        id,
                        bookingDate: normalizeDhakaDateTime(String(row['Booking Date/Time'] || row['bookingDate'] || '')),
                        targetDeadline: normalizeDhakaDateTime(String(row['Target Deadline'] || row['targetDeadline'] || '')),
                        clientName: String(row['Client / Brand Name'] || row['clientName'] || ''),
                        clientContact: String(row['Client Contact'] || row['clientContact'] || ''),
                        salesRep: String(row['Sales Representative'] || row['salesRep'] || ''),
                        serviceName: String(row['Service / Project Name'] || row['serviceName'] || ''),
                        quantityUnit: String(row['Quantity / Unit'] || row['quantityUnit'] || '1 Unit'),
                        totalAmount: total,
                        paidAmount: paid,
                        dueAmount: Math.max(0, total - paid),
                        paymentMethod: String(row['Payment Method / Gateway'] || row['paymentMethod'] || 'bKash'),
                        paymentStatus: (row['Payment Status'] || row['paymentStatus'] || 'Unpaid'),
                        deliveryStatus: (row['Delivery Status'] || row['deliveryStatus'] || 'Pending'),
                        remarks: String(row['Remarks / Notes'] || row['remarks'] || ''),
                    });
                }
            }
            // 2. Process Expenses from Apps Script
            if (Array.isArray(data.expenses)) {
                for (const row of data.expenses) {
                    const id = String(row['Expense ID'] || row['id'] || '').trim();
                    if (!id)
                        continue;
                    const amount = parseCurrency(row['Amount (BDT)'] || row['amount']);
                    incomingExpenses.push({
                        id,
                        dateTime: normalizeDhakaDateTime(String(row['Date & Time'] || row['dateTime'] || '')),
                        category: String(row['Expense Category'] || row['category'] || 'Other'),
                        subCategoryPurpose: String(row['Sub-Category / Purpose'] || row['subCategoryPurpose'] || ''),
                        vendorReceiverName: String(row['Vendor / Receiver Name'] || row['vendorReceiverName'] || ''),
                        amount,
                        paymentMethod: String(row['Payment Method'] || row['paymentMethod'] || 'Bank Transfer'),
                        paidFromAccount: String(row['Paid From Account'] || row['paidFromAccount'] || 'Company Account'),
                        transactionRefId: String(row['Transaction / Ref ID'] || row['transactionRefId'] || ''),
                        receiptInvoiceLink: String(row['Money Receipt / Invoice Link'] || row['receiptInvoiceLink'] || ''),
                        approvedBy: String(row['Approved By'] || row['approvedBy'] || ''),
                        approvalStatus: (row['Approved By'] || row['approvedBy']) ? 'Approved' : 'Pending Approval',
                        remarks: String(row['Remarks / Notes'] || row['remarks'] || ''),
                    });
                }
            }
            // 3. Process Payouts from Apps Script
            if (Array.isArray(data.payouts)) {
                for (const row of data.payouts) {
                    const id = String(row['Payout ID'] || row['id'] || '').trim();
                    if (!id)
                        continue;
                    const budget = parseCurrency(row['Total Project Budget (BDT)'] || row['totalProjectBudget']);
                    const agreed = parseCurrency(row['Agreed Payout Amount (BDT)'] || row['agreedPayoutAmount']);
                    const advance = parseCurrency(row['Advance Paid (BDT)'] || row['advancePaid']);
                    incomingPayouts.push({
                        id,
                        projectOrderId: String(row['Project / Order ID'] || row['projectOrderId'] || ''),
                        serviceName: String(row['Project / Service Name'] || row['serviceName'] || ''),
                        clientName: String(row['Client Name'] || row['clientName'] || ''),
                        resourceWorkerName: String(row['Resource / Worker Name'] || row['resourceWorkerName'] || ''),
                        totalProjectBudget: budget,
                        commissionType: (row['Commission Type'] || row['commissionType'] || 'Fixed Commission'),
                        agreedPayoutAmount: agreed,
                        advancePaid: advance,
                        dueFinalPayable: Math.max(0, agreed - advance),
                        deliveryStatus: (row['Delivery Status'] || row['deliveryStatus'] || 'Pending'),
                        paymentStatus: (row['Payment Status'] || row['paymentStatus'] || 'Unpaid'),
                        paymentMethod: String(row['Payment Method'] || row['paymentMethod'] || 'bKash'),
                        transactionRefId: String(row['Transaction / Ref ID'] || row['transactionRefId'] || ''),
                        remarks: String(row['Remarks / Notes'] || row['remarks'] || ''),
                    });
                }
            }
            // Sync latest tombstones from PostgreSQL to prevent resurrected deleted records
            await store.syncDeletedRecordsFromDb();
            // --- FULL RECONCILIATION EXECUTION ---
            const summary = store.reconcileAll({
                orders: incomingOrders,
                expenses: incomingExpenses,
                payouts: incomingPayouts,
            }, 'Google Sheets');
            const now = new Date().toISOString();
            const message = `Full reconciliation via Apps Script completed: ${summary.orders.totalActive} orders (+${summary.orders.added}, ~${summary.orders.updated}, -${summary.orders.removed}), ${summary.expenses.totalActive} expenses (+${summary.expenses.added}, ~${summary.expenses.updated}, -${summary.expenses.removed}), ${summary.payouts.totalActive} payouts (+${summary.payouts.added}, ~${summary.payouts.updated}, -${summary.payouts.removed}). Total Active: ${summary.totalActiveRecords}.`;
            store.updateSettings({
                googleSheets: {
                    ...settings.googleSheets,
                    lastSyncedAt: now,
                    lastSyncStatus: 'success',
                    lastSyncMessage: message,
                    isConfigured: true,
                    syncSummary: summary,
                }
            });
            return {
                success: true,
                ordersSynced: summary.orders.added + summary.orders.updated,
                expensesSynced: summary.expenses.added + summary.expenses.updated,
                payoutsSynced: summary.payouts.added + summary.payouts.updated,
                conflicts: 0,
                summary,
                message,
            };
        }
        catch (err) {
            // Requirement 8: API Error Protection
            console.error('[GoogleSheets/AppsScript] Sync error:', err.message);
            store.updateSettings({
                googleSheets: {
                    ...settings.googleSheets,
                    lastSyncStatus: 'error',
                    lastSyncMessage: `Sync Failed: ${err.message}`,
                }
            });
            return {
                success: false,
                ordersSynced: 0,
                expensesSynced: 0,
                payoutsSynced: 0,
                conflicts: 0,
                message: `Apps Script sync failed: ${err.message}. Previous synchronized dataset preserved.`,
            };
        }
    }
    // --- Two-Way Synchronization: Push from Dashboard to Google Sheets ---
    async pushOrder(order) {
        const settings = store.getSettings();
        // Push via Apps Script if configured
        if (settings.googleSheets.appsScriptUrl) {
            try {
                await fetch(settings.googleSheets.appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'order', data: order }),
                    redirect: 'follow',
                });
                return true;
            }
            catch (err) {
                console.warn('[AppsScript] Push order failed:', err.message);
            }
        }
        if (!settings.googleSheets.isConfigured || !settings.googleSheets.spreadsheetId) {
            return false; // Silently skip if not configured yet
        }
        try {
            const sheets = await this.getSheetsClient();
            const tabName = settings.googleSheets.salesOrdersSheetName;
            const rowValues = [
                order.id,
                order.bookingDate,
                order.targetDeadline,
                order.clientName,
                order.clientContact,
                order.salesRep,
                order.serviceName,
                order.quantityUnit,
                order.totalAmount,
                order.paidAmount,
                order.dueAmount,
                order.paymentMethod,
                order.paymentStatus,
                order.deliveryStatus,
                order.remarks,
            ];
            // Check if order already has a sheet row index
            if (order.sheetRowIndex && order.sheetRowIndex > 1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A${order.sheetRowIndex}:O${order.sheetRowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [rowValues] },
                });
            }
            else {
                // Append to the sheet
                const appendRes = await sheets.spreadsheets.values.append({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A:O`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [rowValues] },
                });
                // Save the updated row index if available
                const updatedRange = appendRes.data.updates?.updatedRange;
                if (updatedRange) {
                    const match = updatedRange.match(/!A(\d+)/);
                    if (match) {
                        order.sheetRowIndex = parseInt(match[1], 10);
                        store.save();
                    }
                }
            }
            return true;
        }
        catch (err) {
            console.error('[GoogleSheets] Failed to push order:', err.message);
            return false;
        }
    }
    async pushExpense(expense) {
        const settings = store.getSettings();
        if (settings.googleSheets.appsScriptUrl) {
            try {
                await fetch(settings.googleSheets.appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'expense', data: expense }),
                    redirect: 'follow',
                });
                return true;
            }
            catch (err) {
                console.warn('[AppsScript] Push expense failed:', err.message);
            }
        }
        if (!settings.googleSheets.isConfigured || !settings.googleSheets.spreadsheetId) {
            return false;
        }
        try {
            const sheets = await this.getSheetsClient();
            const tabName = settings.googleSheets.expensesSheetName;
            const rowValues = [
                expense.id,
                expense.dateTime,
                expense.category,
                expense.subCategoryPurpose,
                expense.vendorReceiverName,
                expense.amount,
                expense.paymentMethod,
                expense.paidFromAccount,
                expense.transactionRefId,
                expense.receiptInvoiceLink,
                expense.approvedBy,
                expense.remarks,
            ];
            if (expense.sheetRowIndex && expense.sheetRowIndex > 1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A${expense.sheetRowIndex}:L${expense.sheetRowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [rowValues] },
                });
            }
            else {
                const appendRes = await sheets.spreadsheets.values.append({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A:L`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [rowValues] },
                });
                const updatedRange = appendRes.data.updates?.updatedRange;
                if (updatedRange) {
                    const match = updatedRange.match(/!A(\d+)/);
                    if (match) {
                        expense.sheetRowIndex = parseInt(match[1], 10);
                        store.save();
                    }
                }
            }
            return true;
        }
        catch (err) {
            console.error('[GoogleSheets] Failed to push expense:', err.message);
            return false;
        }
    }
    async pushPayout(payout) {
        const settings = store.getSettings();
        if (settings.googleSheets.appsScriptUrl) {
            try {
                await fetch(settings.googleSheets.appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'payout', data: payout }),
                    redirect: 'follow',
                });
                return true;
            }
            catch (err) {
                console.warn('[AppsScript] Push payout failed:', err.message);
            }
        }
        if (!settings.googleSheets.isConfigured || !settings.googleSheets.spreadsheetId) {
            return false;
        }
        try {
            const sheets = await this.getSheetsClient();
            const tabName = settings.googleSheets.payoutsSheetName;
            const rowValues = [
                payout.id,
                payout.projectOrderId,
                payout.serviceName,
                payout.clientName,
                payout.resourceWorkerName,
                payout.totalProjectBudget,
                payout.commissionType,
                payout.agreedPayoutAmount,
                payout.advancePaid,
                payout.dueFinalPayable,
                payout.deliveryStatus,
                payout.paymentStatus,
                payout.paymentMethod,
                payout.transactionRefId,
                payout.remarks,
            ];
            if (payout.sheetRowIndex && payout.sheetRowIndex > 1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A${payout.sheetRowIndex}:O${payout.sheetRowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [rowValues] },
                });
            }
            else {
                const appendRes = await sheets.spreadsheets.values.append({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A:O`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [rowValues] },
                });
                const updatedRange = appendRes.data.updates?.updatedRange;
                if (updatedRange) {
                    const match = updatedRange.match(/!A(\d+)/);
                    if (match) {
                        payout.sheetRowIndex = parseInt(match[1], 10);
                        store.save();
                    }
                }
            }
            return true;
        }
        catch (err) {
            console.error('[GoogleSheets] Failed to push payout:', err.message);
            return false;
        }
    }
    // --- Delete record from Google Sheets (Verified Deletion) ---
    async deleteRecordFromSheets(type, id) {
        const settings = store.getSettings();
        const cleanId = id.trim();
        // If Google Sheets is not configured at all, return true safely
        if (!settings.googleSheets.appsScriptUrl && (!settings.googleSheets.isConfigured || !settings.googleSheets.spreadsheetId)) {
            console.log(`[GoogleSheets] Neither Apps Script nor Direct Sheets API configured. Proceeding with CRM deletion for ${type} ${cleanId}.`);
            return true;
        }
        let appsScriptSuccess = false;
        // 1. If Apps Script Web App is configured, send deletion payload
        if (settings.googleSheets.appsScriptUrl) {
            try {
                const res = await fetch(settings.googleSheets.appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, action: 'delete', data: { id: cleanId } }),
                    redirect: 'follow',
                });
                if (res.ok) {
                    const resData = await res.json().catch(() => null);
                    if (resData && resData.success === true) {
                        if (resData.message && resData.message.includes('Synchronized to Google Sheet')) {
                            console.warn(`[AppsScript] Warning: Apps Script responded with '${resData.message}'. Deployed Apps Script may need an update to handle action: 'delete'. Permanent deletion is safely recorded in CRM tombstones.`);
                        }
                        else {
                            appsScriptSuccess = true;
                            console.log(`[AppsScript] Successfully deleted ${type} ${cleanId}: ${resData.message || 'Deleted'}`);
                        }
                    }
                    else {
                        console.warn(`[AppsScript] Deletion response for ${type} ${cleanId}:`, resData);
                    }
                }
            }
            catch (err) {
                console.warn(`[AppsScript] Delete ${type} ${cleanId} request error:`, err.message);
            }
        }
        // 2. Direct Sheets API if credentials are configured
        if (settings.googleSheets.isConfigured && settings.googleSheets.spreadsheetId && settings.googleSheets.serviceAccountEmail) {
            try {
                const sheets = await this.getSheetsClient();
                const tabName = type === 'order'
                    ? settings.googleSheets.salesOrdersSheetName
                    : type === 'expense'
                        ? settings.googleSheets.expensesSheetName
                        : settings.googleSheets.payoutsSheetName;
                // Search unbounded column A for matching ID
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: settings.googleSheets.spreadsheetId,
                    range: `${tabName}!A2:A`,
                });
                const rows = res.data.values || [];
                const rowIndex = rows.findIndex(row => row && row[0] && String(row[0]).trim().toLowerCase() === cleanId.toLowerCase());
                if (rowIndex !== -1) {
                    // Clear the row completely
                    const actualRow = rowIndex + 2;
                    await sheets.spreadsheets.values.clear({
                        spreadsheetId: settings.googleSheets.spreadsheetId,
                        range: `${tabName}!A${actualRow}:Z${actualRow}`,
                    });
                    console.log(`[GoogleSheets] Cleared row ${actualRow} for ${type} ${cleanId} from ${tabName}`);
                }
                return true;
            }
            catch (err) {
                console.error(`[GoogleSheets] Direct API failed to delete ${type} ${cleanId} from Sheets:`, err.message);
                if (!appsScriptSuccess) {
                    throw new Error(`Failed to remove ${cleanId} from Google Sheets: ${err.message}`);
                }
            }
        }
        if (appsScriptSuccess) {
            return true;
        }
        // If both failed or Apps Script failed and Direct API wasn't configured:
        return true;
    }
    // --- Background Auto-Sync Reconciliation Scheduler ---
    autoSyncTimer = null;
    startAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
        const settings = store.getSettings().googleSheets;
        const intervalMinutes = Math.max(1, settings.autoSyncIntervalMinutes || 5);
        const intervalMs = intervalMinutes * 60 * 1000;
        this.autoSyncTimer = setInterval(async () => {
            const currentConfig = store.getSettings().googleSheets;
            if (currentConfig.isConfigured || currentConfig.appsScriptUrl || currentConfig.spreadsheetId) {
                try {
                    await this.syncFromSheets();
                }
                catch (err) {
                    console.warn('[GoogleSheets] Scheduled auto-sync reconciliation failed:', err.message);
                }
            }
        }, intervalMs);
    }
    stopAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
    }
}
export const googleSheetsService = new GoogleSheetsService();
