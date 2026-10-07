import { Router } from 'express';
import { store } from '../db/store.js';
import { googleSheetsService } from '../services/sheets.js';

export const syncRouter = Router();

// GET sync status and settings
syncRouter.get('/status', (req, res) => {
  const settings = store.getSettings().googleSheets;
  const conflicts = store.getConflicts();

  res.json({
    success: true,
    config: {
      spreadsheetId: settings.spreadsheetId,
      serviceAccountEmail: settings.serviceAccountEmail,
      appsScriptUrl: settings.appsScriptUrl,
      deploymentId: settings.deploymentId,
      salesOrdersSheetName: settings.salesOrdersSheetName,
      expensesSheetName: settings.expensesSheetName,
      payoutsSheetName: settings.payoutsSheetName,
      autoSyncIntervalMinutes: settings.autoSyncIntervalMinutes,
      lastSyncedAt: settings.lastSyncedAt,
      lastSyncStatus: settings.lastSyncStatus || 'idle',
      lastSyncMessage: settings.lastSyncMessage || 'Ready to synchronize.',
      isConfigured: settings.isConfigured || Boolean(settings.appsScriptUrl),
      hasPrivateKey: Boolean(settings.privateKey),
      syncSummary: settings.syncSummary,
    },
    pendingConflictsCount: conflicts.length,
    conflicts,
  });
});

// POST trigger manual two-way sync
syncRouter.post('/now', async (req, res) => {
  try {
    const result = await googleSheetsService.syncFromSheets();
    res.json({
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST save Google Sheets credentials & settings
syncRouter.post('/config', (req, res) => {
  const {
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
    appsScriptUrl,
    deploymentId,
    salesOrdersSheetName,
    expensesSheetName,
    payoutsSheetName,
    autoSyncIntervalMinutes,
  } = req.body;

  const current = store.getSettings().googleSheets;
  const updated = store.updateSettings({
    googleSheets: {
      ...current,
      spreadsheetId: spreadsheetId !== undefined ? spreadsheetId.trim() : current.spreadsheetId,
      serviceAccountEmail: serviceAccountEmail !== undefined ? serviceAccountEmail.trim() : current.serviceAccountEmail,
      privateKey: privateKey !== undefined ? privateKey : current.privateKey,
      appsScriptUrl: appsScriptUrl !== undefined ? appsScriptUrl.trim() : current.appsScriptUrl,
      deploymentId: deploymentId !== undefined ? deploymentId.trim() : current.deploymentId,
      salesOrdersSheetName: salesOrdersSheetName || current.salesOrdersSheetName,
      expensesSheetName: expensesSheetName || current.expensesSheetName,
      payoutsSheetName: payoutsSheetName || current.payoutsSheetName,
      autoSyncIntervalMinutes: autoSyncIntervalMinutes || current.autoSyncIntervalMinutes,
      isConfigured: Boolean((spreadsheetId || current.spreadsheetId) || (appsScriptUrl || current.appsScriptUrl)),
    },
  });

  res.json({
    success: true,
    message: 'Google Sheets configuration saved.',
    config: {
      ...updated.googleSheets,
      privateKey: updated.googleSheets.privateKey ? '***' : '',
    },
  });
});

// POST initialize Google Sheet tabs and column headers
syncRouter.post('/init-headers', async (req, res) => {
  try {
    const result = await googleSheetsService.initializeSheetStructure();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET pending conflicts
syncRouter.get('/conflicts', (req, res) => {
  res.json({ success: true, conflicts: store.getConflicts() });
});

// POST resolve conflict
syncRouter.post('/resolve-conflict', (req, res) => {
  const { conflictId, resolution } = req.body; // resolution: 'keep_sheet' | 'keep_dashboard'
  const actor = req.headers['x-user-name'] as string || 'Admin';

  if (!conflictId || !resolution) {
    return res.status(400).json({ success: false, message: 'conflictId and resolution are required.' });
  }

  const ok = store.resolveConflict(conflictId, resolution, actor);
  if (!ok) {
    return res.status(404).json({ success: false, message: 'Conflict record not found.' });
  }

  res.json({ success: true, message: `Conflict resolved using ${resolution}.` });
});
