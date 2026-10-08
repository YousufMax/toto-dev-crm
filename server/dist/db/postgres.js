import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();
const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || '';
const isRemoteDb = Boolean(dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1'));
export const pool = new Pool(dbUrl
    ? {
        connectionString: dbUrl,
        ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'Yousuf',
        database: process.env.PGDATABASE || 'toto_crm',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
pool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected error on idle client:', err);
});
export async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
        console.log(`[PostgreSQL Query] Executed in ${duration}ms: ${text.slice(0, 80)}...`);
    }
    return res;
}
export async function getClient() {
    return await pool.connect();
}
