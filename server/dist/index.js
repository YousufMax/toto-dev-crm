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
import { store, DEFAULT_ROLES, DEFAULT_EMPLOYEES, DEFAULT_USERS } from './db/store.js';
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
// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        system: 'TOTO Development CRM & Operations System',
        timestamp: new Date().toISOString(),
        timezone: 'Asia/Dhaka',
        version: '1.0.0',
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
    }
    catch (pgErr) {
        console.error(`[PostgreSQL Warning] Failed to connect to PostgreSQL:`, pgErr);
    }
});
