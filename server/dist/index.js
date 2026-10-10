import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { expensesRouter } from './routes/expenses.js';
import { payoutsRouter } from './routes/payouts.js';
import { reportsRouter } from './routes/reports.js';
import { searchRouter } from './routes/search.js';
import { syncRouter } from './routes/sync.js';
import { telegramRouter } from './routes/telegram.js';
import { auditRouter } from './routes/audit.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter } from './routes/roles.js';
import { employeesRouter } from './routes/employees.js';
import { authenticate } from './middleware/auth.js';
import { postgresAuthRepo } from './db/authRepo.js';
import { postgresBusinessRepo } from './db/businessRepo.js';
import { query } from './db/postgres.js';
import { store, DEFAULT_ROLES, DEFAULT_EMPLOYEES, DEFAULT_USERS } from './db/store.js';
import { googleSheetsService } from './services/sheets.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables from .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Global Authentication Middleware
app.use(authenticate);
// Comprehensive Health & Diagnostic Check
app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbLatencyMs = -1;
    const start = Date.now();
    try {
        const dbRes = await query('SELECT 1');
        if (dbRes && dbRes.rows) {
            dbStatus = 'connected';
            dbLatencyMs = Date.now() - start;
        }
    }
    catch (err) {
        dbStatus = `error: ${err.message}`;
    }
    const syncSettings = store.getSettings().googleSheets;
    res.json({
        success: true,
        status: dbStatus === 'connected' ? 'online' : 'degraded',
        system: 'TOTO Development CRM & Operations System',
        timestamp: new Date().toISOString(),
        timezone: 'Asia/Dhaka',
        version: '1.0.0',
        database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
        },
        metrics: {
            activeOrders: store.getOrders().length,
            activeExpenses: store.getExpenses().length,
            activePayouts: store.getPayouts().length,
            tombstonesCount: store.getDeletedRecords().length,
            auditLogsCount: store.getAuditLogs().length,
        },
        sync: {
            isConfigured: Boolean(syncSettings.spreadsheetId || syncSettings.appsScriptUrl),
            lastSyncStatus: syncSettings.lastSyncStatus || 'idle',
            lastSyncedAt: syncSettings.lastSyncedAt || null,
            lastSyncMessage: syncSettings.lastSyncMessage || 'Ready',
        },
        process: {
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        }
    });
});
// Mount Module Endpoints
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/payouts', payoutsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/search', searchRouter);
app.use('/api/sync', syncRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/audit', auditRouter);
// Serve static frontend files if built
const clientDistPath = path.resolve(__dirname, '../../my-react-app/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    const indexPath = path.resolve(clientDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            next();
        }
    });
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[ServerError]', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});
app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(`🚀 TOTO Development CRM Backend is running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`⏰ Timezone: Asia/Dhaka`);
    console.log(`====================================================`);
    try {
        // Initialize and verify PostgreSQL Authentication & Security Database
        await postgresAuthRepo.initSchema();
        await postgresAuthRepo.migrateInitialData(DEFAULT_ROLES, DEFAULT_EMPLOYEES, DEFAULT_USERS, store.getUsersWithCredentials());
        // Initialize PostgreSQL business tables (orders, expenses, payouts, sequences)
        await postgresBusinessRepo.initSchema();
        // Sync deleted records tombstone registry from PostgreSQL into store memory
        await store.syncDeletedRecordsFromDb();
        // Sync active business records from PostgreSQL into store memory
        await store.syncBusinessRecordsFromDb();
        console.log(`🔒 PostgreSQL Auth & Business Persistence Engines connected and ready!`);
        // Start background Google Sheets auto-sync reconciliation ONLY after DB hydration is fully complete
        googleSheetsService.startAutoSync();
        console.log(`🔄 Google Sheets Background Reconciliation Engine active!`);
    }
    catch (pgErr) {
        console.error(`[PostgreSQL Warning] Failed to connect to PostgreSQL:`, pgErr);
    }
});
