import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { 
  Order, 
  Expense, 
  Payout, 
  AuditLog, 
  SyncConflict, 
  AppSettings, 
  User,
  Role,
  Employee,
  ModuleId,
  ModulePermissions,
  SyncModuleSummary,
  SyncSummary,
  TombstoneRecord
} from '../types/index.js';
import { getDhakaNowDateTimeString, normalizeDhakaDateTime } from '../utils/date.js';
import { postgresAuthRepo } from './authRepo.js';
import { postgresBusinessRepo } from './businessRepo.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// --- Secure Password Hashing & Verification via Node.js Crypto (Scrypt) ---
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, combinedHash?: string): boolean {
  if (!combinedHash || !combinedHash.includes(':')) return false;
  try {
    const [salt, key] = combinedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

export interface DatabaseSchema {
  users: User[];
  roles: Role[];
  employees: Employee[];
  orders: Order[];
  expenses: Expense[];
  payouts: Payout[];
  auditLogs: AuditLog[];
  conflicts: SyncConflict[];
  settings: AppSettings;
  deletedRecords?: TombstoneRecord[];
}

// Helpers for role permissions matrix
function buildModulePerms(overrides: Partial<ModulePermissions> = {}): ModulePermissions {
  return {
    view: false,
    create: false,
    edit: false,
    delete: false,
    export: false,
    approve: false,
    changeStatus: false,
    assign: false,
    archive: false,
    restore: false,
    ...overrides
  };
}

function fullModulePerms(): ModulePermissions {
  return {
    view: true,
    create: true,
    edit: true,
    delete: true,
    export: true,
    approve: true,
    changeStatus: true,
    assign: true,
    archive: true,
    restore: true,
  };
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-super-admin',
    name: 'Super Admin',
    description: 'Complete unrestricted administrative control across all modules, users, security, and settings.',
    isSystem: true,
    recordScope: { orders: 'all', expenses: 'all', payouts: 'all' },
    permissions: {
      dashboard: fullModulePerms(),
      orders: fullModulePerms(),
      expenses: fullModulePerms(),
      payouts: fullModulePerms(),
      employees: fullModulePerms(),
      reports: fullModulePerms(),
      users: fullModulePerms(),
      roles: fullModulePerms(),
      audit: fullModulePerms(),
      settings: fullModulePerms(),
    }
  },
  {
    id: 'role-coo',
    name: 'COO',
    description: 'Chief Operating Officer with full operational, financial, and reporting oversight.',
    isSystem: true,
    recordScope: { orders: 'all', expenses: 'all', payouts: 'all' },
    permissions: {
      dashboard: fullModulePerms(),
      orders: fullModulePerms(),
      expenses: fullModulePerms(),
      payouts: fullModulePerms(),
      employees: fullModulePerms(),
      reports: fullModulePerms(),
      users: buildModulePerms({ view: true }),
      roles: buildModulePerms({ view: true }),
      audit: buildModulePerms({ view: true, export: true }),
      settings: buildModulePerms({ view: true }),
    }
  },
  {
    id: 'role-sales-manager',
    name: 'Sales Manager',
    description: 'Manages sales team pipeline, orders, client accounts, and revenue performance.',
    isSystem: true,
    recordScope: { orders: 'team', expenses: 'own', payouts: 'all' },
    permissions: {
      dashboard: buildModulePerms({ view: true }),
      orders: buildModulePerms({ view: true, create: true, edit: true, export: true, changeStatus: true, assign: true }),
      expenses: buildModulePerms({ view: true, create: true }),
      payouts: buildModulePerms({ view: true, create: true, edit: true }),
      employees: buildModulePerms({ view: true }),
      reports: buildModulePerms({ view: true, export: true }),
      users: buildModulePerms({ view: true }),
      roles: buildModulePerms(),
      audit: buildModulePerms({ view: true }),
      settings: buildModulePerms(),
    }
  },
  {
    id: 'role-sales-officer',
    name: 'Sales Officer',
    description: 'Handles client bookings. Strictly restricted to view and edit only assigned orders.',
    isSystem: true,
    recordScope: { orders: 'assigned', expenses: 'none', payouts: 'assigned' },
    permissions: {
      dashboard: buildModulePerms({ view: true }),
      orders: buildModulePerms({ view: true, create: true, edit: true, changeStatus: true }),
      expenses: buildModulePerms(),
      payouts: buildModulePerms({ view: true }),
      employees: buildModulePerms(),
      reports: buildModulePerms({ view: true }),
      users: buildModulePerms(),
      roles: buildModulePerms(),
      audit: buildModulePerms(),
      settings: buildModulePerms(),
    }
  },
  {
    id: 'role-finance-manager',
    name: 'Finance Manager',
    description: 'Controls company expenses, cost approvals, vendor receipts, and resource payout settlements.',
    isSystem: true,
    recordScope: { orders: 'all', expenses: 'all', payouts: 'all' },
    permissions: {
      dashboard: buildModulePerms({ view: true }),
      orders: buildModulePerms({ view: true, export: true }),
      expenses: buildModulePerms({ view: true, create: true, edit: true, delete: true, export: true, approve: true, changeStatus: true }),
      payouts: buildModulePerms({ view: true, create: true, edit: true, export: true, approve: true, changeStatus: true }),
      employees: buildModulePerms({ view: true }),
      reports: buildModulePerms({ view: true, export: true }),
      users: buildModulePerms(),
      roles: buildModulePerms(),
      audit: buildModulePerms({ view: true }),
      settings: buildModulePerms({ view: true }),
    }
  },
  {
    id: 'role-project-manager',
    name: 'Project Manager',
    description: 'Oversees project delivery milestones, production progress, and worker payout allocations.',
    isSystem: true,
    recordScope: { orders: 'all', expenses: 'own', payouts: 'all' },
    permissions: {
      dashboard: buildModulePerms({ view: true }),
      orders: buildModulePerms({ view: true, edit: true, changeStatus: true }),
      expenses: buildModulePerms({ view: true, create: true }),
      payouts: buildModulePerms({ view: true, create: true, edit: true, assign: true, changeStatus: true }),
      employees: buildModulePerms({ view: true }),
      reports: buildModulePerms({ view: true }),
      users: buildModulePerms(),
      roles: buildModulePerms(),
      audit: buildModulePerms({ view: true }),
      settings: buildModulePerms(),
    }
  },
  {
    id: 'role-employee',
    name: 'Employee',
    description: 'Internal team member or contractor with restricted access to assigned tasks and payout records.',
    isSystem: true,
    recordScope: { orders: 'none', expenses: 'none', payouts: 'assigned' },
    permissions: {
      dashboard: buildModulePerms({ view: true }),
      orders: buildModulePerms(),
      expenses: buildModulePerms(),
      payouts: buildModulePerms({ view: true }),
      employees: buildModulePerms(),
      reports: buildModulePerms(),
      users: buildModulePerms(),
      roles: buildModulePerms(),
      audit: buildModulePerms(),
      settings: buildModulePerms(),
    }
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Read-only stakeholder with view permissions on high-level operational dashboards and reports.',
    isSystem: true,
    recordScope: { orders: 'all', expenses: 'all', payouts: 'all' },
    permissions: {
      dashboard: buildModulePerms({ view: true }),
      orders: buildModulePerms({ view: true }),
      expenses: buildModulePerms({ view: true }),
      payouts: buildModulePerms({ view: true }),
      employees: buildModulePerms({ view: true }),
      reports: buildModulePerms({ view: true }),
      users: buildModulePerms(),
      roles: buildModulePerms(),
      audit: buildModulePerms(),
      settings: buildModulePerms(),
    }
  }
];

export const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'EMP-01',
    name: 'MD Yousuf Ali',
    designation: 'Managing Director & Owner',
    department: 'Executive',
    email: 'admin@totodev.com',
    phone: '+8801711000000',
    status: 'Active',
    joinedDate: '2024-01-01',
    linkedUserId: 'USR-01',
  },
  {
    id: 'EMP-02',
    name: 'Rajib Ahmed',
    designation: 'Sales Lead & Operations',
    department: 'Sales',
    email: 'rajib@totodev.com',
    phone: '+8801811000000',
    status: 'Active',
    joinedDate: '2024-03-01',
    linkedUserId: 'USR-02',
  },
  {
    id: 'EMP-03',
    name: 'Tanvir Hossain',
    designation: 'Sales Executive',
    department: 'Sales',
    email: 'tanvir@totodev.com',
    phone: '+8801911000000',
    status: 'Active',
    joinedDate: '2024-06-15',
    linkedUserId: 'USR-03',
  },
  {
    id: 'EMP-04',
    name: 'Fatima Zohra',
    designation: 'Finance & Accounts Officer',
    department: 'Finance',
    email: 'finance@totodev.com',
    phone: '+8801611000000',
    status: 'Active',
    joinedDate: '2024-02-10',
    linkedUserId: 'USR-04',
  },
  {
    id: 'EMP-05',
    name: 'Hasan Mahmud',
    designation: 'Project Delivery Manager',
    department: 'Project Management',
    email: 'hasan@totodev.com',
    phone: '+8801511000000',
    status: 'Active',
    joinedDate: '2024-04-01',
    linkedUserId: 'USR-05',
  },
  {
    id: 'EMP-06',
    name: 'Freelancer Rahim',
    designation: 'Senior Graphic Designer',
    department: 'Design',
    email: 'rahim@freelance.local',
    phone: '+8801722000000',
    status: 'Active',
    joinedDate: '2024-08-01',
    linkedUserId: 'USR-06',
  },
  {
    id: 'EMP-07',
    name: 'Developer Sakib',
    designation: 'Full Stack Web Developer',
    department: 'Engineering',
    email: 'sakib@totodev.com',
    phone: '+8801733000000',
    status: 'Active',
    joinedDate: '2024-05-12',
    linkedUserId: 'USR-07',
  }
];

// Pre-seeded hashed password for 'admin123'
const SEED_PASSWORD_HASH = hashPassword('admin123');

export const DEFAULT_USERS: User[] = [
  {
    id: 'USR-01',
    username: 'admin',
    name: 'MD Yousuf Ali',
    email: 'admin@totodev.com',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-super-admin',
    role: 'Super Admin',
    status: 'Active',
    isPrimarySuperAdmin: true,
    phone: '+8801711000000',
    linkedEmployeeId: 'EMP-01',
    createdAt: '2024-01-01T00:00:00+06:00',
  },
  {
    id: 'USR-02',
    username: 'rajib',
    name: 'Rajib Ahmed',
    email: 'rajib@totodev.com',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-sales-manager',
    role: 'Sales Manager',
    status: 'Active',
    phone: '+8801811000000',
    salesRepCode: 'Rajib',
    linkedEmployeeId: 'EMP-02',
    createdAt: '2024-03-01T00:00:00+06:00',
  },
  {
    id: 'USR-03',
    username: 'tanvir',
    name: 'Tanvir Hossain',
    email: 'tanvir@totodev.com',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-sales-officer',
    role: 'Sales Officer',
    status: 'Active',
    phone: '+8801911000000',
    salesRepCode: 'Tanvir',
    linkedEmployeeId: 'EMP-03',
    createdAt: '2024-06-15T00:00:00+06:00',
  },
  {
    id: 'USR-04',
    username: 'fatima',
    name: 'Fatima Zohra',
    email: 'finance@totodev.com',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-finance-manager',
    role: 'Finance Manager',
    status: 'Active',
    phone: '+8801611000000',
    linkedEmployeeId: 'EMP-04',
    createdAt: '2024-02-10T00:00:00+06:00',
  },
  {
    id: 'USR-05',
    username: 'hasan',
    name: 'Hasan Mahmud',
    email: 'hasan@totodev.com',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-project-manager',
    role: 'Project Manager',
    status: 'Active',
    phone: '+8801511000000',
    linkedEmployeeId: 'EMP-05',
    createdAt: '2024-04-01T00:00:00+06:00',
  },
  {
    id: 'USR-06',
    username: 'rahim',
    name: 'Freelancer Rahim',
    email: 'rahim@freelance.local',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-employee',
    role: 'Employee',
    status: 'Active',
    phone: '+8801722000000',
    workerName: 'Freelancer Rahim',
    linkedEmployeeId: 'EMP-06',
    createdAt: '2024-08-01T00:00:00+06:00',
  },
  {
    id: 'USR-07',
    username: 'sakib',
    name: 'Developer Sakib',
    email: 'sakib@totodev.com',
    passwordHash: SEED_PASSWORD_HASH,
    roleId: 'role-employee',
    role: 'Employee',
    status: 'Active',
    phone: '+8801733000000',
    workerName: 'Developer Sakib',
    linkedEmployeeId: 'EMP-07',
    createdAt: '2024-05-12T00:00:00+06:00',
  }
];

const INITIAL_EXPENSE_CATEGORIES = [
  'Employee Salary',
  'Employee Advance',
  'Project Cost',
  'Freelancer Payment',
  'Marketing & Ads',
  'Software / Subscription',
  'Hosting / Domain',
  'Office Expense',
  'Transportation',
  'Equipment',
  'Utilities',
  'Internet / Communication',
  'Bank Charges',
  'Refund',
  'Other'
];

function seedInitialData(): DatabaseSchema {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowIso = now.toISOString();

  // Create dates relative to today
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const orders: Order[] = [];
  const expenses: Expense[] = [];
  const payouts: Payout[] = [];
  const auditLogs: AuditLog[] = [];

  const settings: AppSettings = {
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      privateKey: process.env.GOOGLE_PRIVATE_KEY || '',
      salesOrdersSheetName: 'Sales_Orders',
      expensesSheetName: 'Expenses',
      payoutsSheetName: 'Project_Payouts',
      autoSyncIntervalMinutes: 5,
      isConfigured: Boolean(process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    },
    telegram: {
      salesBot: {
        enabled: Boolean(process.env.TELEGRAM_SALES_BOT_TOKEN),
        botToken: process.env.TELEGRAM_SALES_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_SALES_CHAT_ID || '',
      },
      expenseBot: {
        enabled: Boolean(process.env.TELEGRAM_EXPENSE_BOT_TOKEN),
        botToken: process.env.TELEGRAM_EXPENSE_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_EXPENSE_CHAT_ID || '',
        largeExpenseThreshold: 10000,
      },
      payoutBot: {
        enabled: Boolean(process.env.TELEGRAM_PAYOUT_BOT_TOKEN),
        botToken: process.env.TELEGRAM_PAYOUT_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_PAYOUT_CHAT_ID || '',
      },
    },
    customExpenseCategories: INITIAL_EXPENSE_CATEGORIES,
    currencySymbol: '৳',
    timezone: 'Asia/Dhaka',
  };

  return {
    users: DEFAULT_USERS,
    roles: DEFAULT_ROLES,
    employees: DEFAULT_EMPLOYEES,
    orders,
    expenses,
    payouts,
    auditLogs,
    conflicts: [],
    settings,
  };
}

class Store {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        
        // Ensure roles array exists with system defaults
        let roles: Role[] = Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : [...DEFAULT_ROLES];
        // Ensure default system roles exist in roles array
        for (const defRole of DEFAULT_ROLES) {
          if (!roles.some(r => r.id === defRole.id || r.name.toLowerCase() === defRole.name.toLowerCase())) {
            roles.push(defRole);
          }
        }

        // Ensure employees exist
        let employees: Employee[] = Array.isArray(parsed.employees) && parsed.employees.length > 0 ? parsed.employees : [...DEFAULT_EMPLOYEES];

        // Ensure users have password hashes and links
        let users: User[] = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_USERS];
        users = users.map(u => {
          const defaultMatch = DEFAULT_USERS.find(d => d.id === u.id || d.email.toLowerCase() === (u.email || '').toLowerCase());
          const rawRole = (u.role || '').toLowerCase();
          let roleMatch = roles.find(r => r.id === u.roleId || r.name.toLowerCase() === rawRole);
          if (!roleMatch) {
            if (rawRole.includes('sales rep') || rawRole.includes('sales officer')) {
              roleMatch = roles.find(r => r.id === 'role-sales-officer');
            } else if (rawRole.includes('finance')) {
              roleMatch = roles.find(r => r.id === 'role-finance-manager');
            } else if (rawRole.includes('project')) {
              roleMatch = roles.find(r => r.id === 'role-project-manager');
            } else if (rawRole.includes('coo')) {
              roleMatch = roles.find(r => r.id === 'role-coo');
            }
          }
          return {
            ...defaultMatch,
            ...u,
            username: u.username || (u.email ? u.email.split('@')[0] : u.id.toLowerCase()),
            passwordHash: u.passwordHash || SEED_PASSWORD_HASH,
            roleId: roleMatch ? roleMatch.id : (u.roleId || 'role-employee'),
            role: roleMatch ? roleMatch.name : (u.role || 'Employee'),
            status: u.status || 'Active',
            isPrimarySuperAdmin: Boolean(u.isPrimarySuperAdmin || u.email === 'admin@totodev.com' || u.id === 'USR-01'),
          };
        });

        // CRITICAL: Load and retain deleted records tombstone registry
        const deletedRecords: TombstoneRecord[] = Array.isArray(parsed.deletedRecords) ? parsed.deletedRecords : [];
        const deletedIdsSet = new Set(deletedRecords.map(d => d.id.toLowerCase()));

        // Filter out any deleted records from orders, expenses, and payouts
        const safeOrders = (parsed.orders || []).filter((o: Order) => !deletedIdsSet.has(o.id.toLowerCase()));
        const safeExpenses = (parsed.expenses || []).filter((e: Expense) => !deletedIdsSet.has(e.id.toLowerCase()));
        const safePayouts = (parsed.payouts || []).filter((p: Payout) => !deletedIdsSet.has(p.id.toLowerCase()));

        const fullData: DatabaseSchema = {
          ...parsed,
          orders: safeOrders,
          expenses: safeExpenses,
          payouts: safePayouts,
          roles,
          employees,
          users,
          deletedRecords,
          settings: {
            ...seedInitialData().settings,
            ...(parsed.settings || {}),
          },
        };

        return fullData;
      }
    } catch (err) {
      console.error('[Store] Failed to load data from file, falling back to seed:', err);
    }
    const seed = seedInitialData();
    seed.deletedRecords = [];
    this.saveDataDirect(seed);
    return seed;
  }

  // --- Tombstone Registry Management ---
  public async syncDeletedRecordsFromDb(): Promise<void> {
    try {
      const dbDeleted = await postgresAuthRepo.getDeletedRecords();
      if (!this.data.deletedRecords) {
        this.data.deletedRecords = [];
      }
      const existingMap = new Map(this.data.deletedRecords.map(d => [d.id.toLowerCase(), d]));
      let hasChanges = false;

      for (const rec of dbDeleted) {
        if (!existingMap.has(rec.id.toLowerCase())) {
          this.data.deletedRecords.push(rec);
          existingMap.set(rec.id.toLowerCase(), rec);
          hasChanges = true;
        }
      }

      // Also prune any memory records that match tombstones
      const deletedIds = new Set(this.data.deletedRecords.map(d => d.id.toLowerCase()));
      const prevOrderLen = this.data.orders.length;
      const prevExpLen = this.data.expenses.length;
      const prevPayLen = this.data.payouts.length;

      this.data.orders = this.data.orders.filter(o => !deletedIds.has(o.id.toLowerCase()));
      this.data.expenses = this.data.expenses.filter(e => !deletedIds.has(e.id.toLowerCase()));
      this.data.payouts = this.data.payouts.filter(p => !deletedIds.has(p.id.toLowerCase()));

      if (hasChanges || this.data.orders.length !== prevOrderLen || this.data.expenses.length !== prevExpLen || this.data.payouts.length !== prevPayLen) {
        this.save();
      }
    } catch (err: any) {
      console.warn('[Store] Could not sync deleted records from PostgreSQL:', err.message);
    }
  }

  public async syncBusinessRecordsFromDb(): Promise<void> {
    try {
      const [dbOrders, dbExpenses, dbPayouts] = await Promise.all([
        postgresBusinessRepo.getOrders(),
        postgresBusinessRepo.getExpenses(),
        postgresBusinessRepo.getPayouts(),
      ]);

      const deletedIds = new Set((this.data.deletedRecords || []).map(d => d.id.toLowerCase()));
      let changes = false;

      // Merge orders: keep DB as authoritative, preserve unsynced memory orders
      const orderMap = new Map<string, Order>();
      for (const ord of this.data.orders) {
        if (!deletedIds.has(ord.id.toLowerCase())) {
          orderMap.set(ord.id.toLowerCase(), ord);
        }
      }
      for (const ord of dbOrders) {
        if (!deletedIds.has(ord.id.toLowerCase())) {
          orderMap.set(ord.id.toLowerCase(), ord);
          changes = true;
        }
      }
      this.data.orders = Array.from(orderMap.values());

      // Merge expenses
      const expenseMap = new Map<string, Expense>();
      for (const exp of this.data.expenses) {
        if (!deletedIds.has(exp.id.toLowerCase())) {
          expenseMap.set(exp.id.toLowerCase(), exp);
        }
      }
      for (const exp of dbExpenses) {
        if (!deletedIds.has(exp.id.toLowerCase())) {
          expenseMap.set(exp.id.toLowerCase(), exp);
          changes = true;
        }
      }
      this.data.expenses = Array.from(expenseMap.values());

      // Merge payouts
      const payoutMap = new Map<string, Payout>();
      for (const pay of this.data.payouts) {
        if (!deletedIds.has(pay.id.toLowerCase())) {
          payoutMap.set(pay.id.toLowerCase(), pay);
        }
      }
      for (const pay of dbPayouts) {
        if (!deletedIds.has(pay.id.toLowerCase())) {
          payoutMap.set(pay.id.toLowerCase(), pay);
          changes = true;
        }
      }
      this.data.payouts = Array.from(payoutMap.values());

      if (changes) {
        this.save();
      }
      console.log(`[Store] Synced from PostgreSQL: ${this.data.orders.length} orders, ${this.data.expenses.length} expenses, ${this.data.payouts.length} payouts.`);
    } catch (err: any) {
      console.warn('[Store] Could not sync business records from PostgreSQL:', err.message);
    }
  }

  public isRecordDeleted(id: string): boolean {
    if (!id) return false;
    const cleanId = id.trim().toLowerCase();
    return (this.data.deletedRecords || []).some(d => d.id.toLowerCase() === cleanId);
  }

  public async recordDeletion(type: 'order' | 'expense' | 'payout', id: string, actor: string, source: string = 'CRM'): Promise<void> {
    if (!id) return;
    const cleanId = id.trim();
    if (!this.data.deletedRecords) {
      this.data.deletedRecords = [];
    }

    const existingIdx = this.data.deletedRecords.findIndex(d => d.id.toLowerCase() === cleanId.toLowerCase());
    const tombstone: TombstoneRecord = {
      id: cleanId,
      entityType: type,
      deletedBy: actor,
      deletedAt: new Date().toISOString(),
      source,
    };

    if (existingIdx !== -1) {
      this.data.deletedRecords[existingIdx] = tombstone;
    } else {
      this.data.deletedRecords.push(tombstone);
    }

    this.save();

    // Persist to PostgreSQL if available
    try {
      await postgresAuthRepo.addDeletedRecord(cleanId, type, actor, source);
    } catch (err: any) {
      console.warn(`[Store] Could not persist tombstone to PostgreSQL for ${cleanId}:`, err.message);
    }
  }

  private saveDataDirect(dataToSave: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DATA_FILE);
    } catch (err) {
      console.error('[Store] Error saving database file:', err);
    }
  }

  public save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveDataDirect(this.data);
    }, 150);
  }

  // --- Users & Authentication ---
  public getUsers(): User[] {
    return this.data.users.map(({ passwordHash, ...safeUser }) => safeUser as User);
  }

  public getUsersWithCredentials(): User[] {
    return this.data.users;
  }

  public getUserById(id: string): User | undefined {
    const user = this.data.users.find(u => u.id === id);
    if (!user) return undefined;
    const { passwordHash, ...safeUser } = user;
    return safeUser as User;
  }

  public getUserByIdWithCredentials(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByEmailOrUsername(identifier?: string): User | undefined {
    if (!identifier) return undefined;
    const clean = identifier.trim().toLowerCase();
    return this.data.users.find(u => 
      (u.email && u.email.toLowerCase() === clean) || 
      (u.username && u.username.toLowerCase() === clean)
    );
  }

  public createUser(userData: Omit<User, 'id'> & { password?: string }): User {
    const existing = this.getUserByEmailOrUsername(userData.email) || 
      (userData.username ? this.getUserByEmailOrUsername(userData.username) : undefined);
    if (existing) {
      throw new Error(`A user with email "${userData.email}" or username "${userData.username}" already exists.`);
    }

    const numbers = this.data.users.map(u => {
      const match = u.id.match(/^USR-(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
    const newId = `USR-${String(nextNum).padStart(2, '0')}`;

    const role = this.getRoleById(userData.roleId) || this.getRoleByName(userData.role);
    const passwordHash = userData.password ? hashPassword(userData.password) : SEED_PASSWORD_HASH;

    const newUser: User = {
      ...userData,
      id: newId,
      username: userData.username || userData.email.split('@')[0],
      roleId: role ? role.id : 'role-employee',
      role: role ? role.name : (userData.role || 'Employee'),
      passwordHash,
      status: userData.status || 'Active',
      isPrimarySuperAdmin: false, // Only MD Yousuf Ali is primary
      createdAt: new Date().toISOString(),
    };

    // If linked to employee, ensure employee references this user
    if (newUser.linkedEmployeeId) {
      const emp = this.data.employees.find(e => e.id === newUser.linkedEmployeeId);
      if (emp) emp.linkedUserId = newUser.id;
    }

    this.data.users.push(newUser);
    this.save();

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser as User;
  }

  public updateUser(id: string, updates: Partial<User> & { password?: string }, callerId?: string): User {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found.`);
    }

    const targetUser = this.data.users[index];

    // Filter out undefined keys from updates
    const sanitizedUpdates: Partial<User> & { password?: string } = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        (sanitizedUpdates as any)[k] = v;
      }
    }

    // Primary Super Admin Protection Rules
    if (targetUser.isPrimarySuperAdmin) {
      if (sanitizedUpdates.isPrimarySuperAdmin === false) {
        throw new Error('Primary Super Admin status cannot be revoked.');
      }
      if (sanitizedUpdates.status === 'Inactive') {
        throw new Error('Primary Super Admin / Owner account cannot be deactivated.');
      }
      if (sanitizedUpdates.roleId && sanitizedUpdates.roleId !== 'role-super-admin') {
        throw new Error('Primary Super Admin / Owner role cannot be changed.');
      }
      // If caller is another user trying to edit primary super admin
      if (callerId && callerId !== targetUser.id) {
        throw new Error('Additional Super Admins cannot modify the Primary Super Admin account.');
      }
    }

    // Role resolution if roleId provided
    if (sanitizedUpdates.roleId) {
      const role = this.getRoleById(sanitizedUpdates.roleId);
      if (role) {
        sanitizedUpdates.role = role.name;
      }
    }

    // Password hashing if new password provided
    let newPasswordHash = targetUser.passwordHash;
    if (sanitizedUpdates.password && sanitizedUpdates.password.trim().length > 0) {
      newPasswordHash = hashPassword(sanitizedUpdates.password.trim());
    }

    const updatedUser: User = {
      ...targetUser,
      ...sanitizedUpdates,
      id: targetUser.id, // ID cannot be changed
      isPrimarySuperAdmin: targetUser.isPrimarySuperAdmin, // Safeguard
      passwordHash: newPasswordHash,
    };

    this.data.users[index] = updatedUser;
    this.save();

    const { passwordHash: _, ...safeUser } = updatedUser;
    return safeUser as User;
  }

  public deleteUser(id: string, callerId?: string): boolean {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return false;

    const targetUser = this.data.users[index];

    // Strict Primary Super Admin protection
    if (targetUser.isPrimarySuperAdmin) {
      throw new Error('Primary Super Admin / Owner account is permanently protected and cannot be deleted.');
    }

    // If caller is attempting to delete
    if (callerId && callerId === id) {
      throw new Error('You cannot delete your own active administrator account.');
    }

    // Remove user link from employee if present
    if (targetUser.linkedEmployeeId) {
      const emp = this.data.employees.find(e => e.id === targetUser.linkedEmployeeId);
      if (emp && emp.linkedUserId === targetUser.id) {
        emp.linkedUserId = undefined;
      }
    }

    this.data.users.splice(index, 1);
    this.save();
    return true;
  }

  public toggleUserStatus(id: string, status: 'Active' | 'Inactive', callerId?: string): User {
    const user = this.data.users.find(u => u.id === id);
    if (!user) throw new Error(`User with ID ${id} not found.`);

    if (user.isPrimarySuperAdmin && status === 'Inactive') {
      throw new Error('Primary Super Admin / Owner account cannot be deactivated.');
    }

    if (callerId && user.isPrimarySuperAdmin && callerId !== user.id) {
      throw new Error('Additional administrators cannot alter the Primary Super Admin account status.');
    }

    user.status = status;
    this.save();

    const { passwordHash: _, ...safeUser } = user;
    return safeUser as User;
  }

  // --- Dynamic Roles & Permissions ---
  public getRoles(): Role[] {
    return this.data.roles;
  }

  public getRoleById(id: string): Role | undefined {
    return this.data.roles.find(r => r.id === id);
  }

  public getRoleByName(name: string): Role | undefined {
    const clean = name.trim().toLowerCase();
    return this.data.roles.find(r => r.name.toLowerCase() === clean);
  }

  public createRole(roleData: Omit<Role, 'id'>): Role {
    const existing = this.getRoleByName(roleData.name);
    if (existing) {
      throw new Error(`A role named "${roleData.name}" already exists.`);
    }

    const slug = roleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newId = `role-custom-${slug}-${Date.now().toString(36)}`;

    const newRole: Role = {
      ...roleData,
      id: newId,
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.roles.push(newRole);
    this.save();
    return newRole;
  }

  public updateRole(id: string, updates: Partial<Role>): Role {
    const index = this.data.roles.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error(`Role with ID ${id} not found.`);
    }

    const targetRole = this.data.roles[index];

    // Prevent renaming system role
    if (targetRole.isSystem && updates.name && updates.name !== targetRole.name) {
      throw new Error(`System core role "${targetRole.name}" cannot be renamed.`);
    }

    const updatedRole: Role = {
      ...targetRole,
      ...updates,
      id: targetRole.id,
      isSystem: targetRole.isSystem,
      updatedAt: new Date().toISOString(),
    };

    this.data.roles[index] = updatedRole;

    // Update denormalized role names on users if name changed
    if (updates.name && updates.name !== targetRole.name) {
      this.data.users.forEach(u => {
        if (u.roleId === targetRole.id) {
          u.role = updates.name!;
        }
      });
    }

    this.save();
    return updatedRole;
  }

  public deleteRole(id: string): boolean {
    const index = this.data.roles.findIndex(r => r.id === id);
    if (index === -1) return false;

    const targetRole = this.data.roles[index];
    if (targetRole.isSystem) {
      throw new Error(`System role "${targetRole.name}" is essential to system security and cannot be deleted.`);
    }

    // Check if any users are currently assigned to this role
    const assignedCount = this.data.users.filter(u => u.roleId === id).length;
    if (assignedCount > 0) {
      throw new Error(`Cannot delete role "${targetRole.name}" because it is currently assigned to ${assignedCount} user(s). Reassign them first.`);
    }

    this.data.roles.splice(index, 1);
    this.save();
    return true;
  }

  // --- Employees (Decoupled from Login Users) ---
  public getEmployees(): Employee[] {
    return this.data.employees;
  }

  public getEmployeeById(id: string): Employee | undefined {
    return this.data.employees.find(e => e.id === id);
  }

  public createEmployee(empData: Omit<Employee, 'id'>): Employee {
    const numbers = this.data.employees.map(e => {
      const match = e.id.match(/^EMP-(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
    const newId = `EMP-${String(nextNum).padStart(2, '0')}`;

    const newEmp: Employee = {
      ...empData,
      id: newId,
      status: empData.status || 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.employees.push(newEmp);
    this.save();
    return newEmp;
  }

  public updateEmployee(id: string, updates: Partial<Employee>): Employee {
    const index = this.data.employees.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`Employee with ID ${id} not found.`);
    }

    const currentEmp = this.data.employees[index];
    const sanitizedUpdates: Partial<Employee> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        (sanitizedUpdates as any)[k] = v;
      }
    }

    const updatedEmp: Employee = {
      ...currentEmp,
      ...sanitizedUpdates,
      id: currentEmp.id,
      updatedAt: new Date().toISOString(),
    };

    this.data.employees[index] = updatedEmp;

    // Requirement 8: If employee becomes inactive, do NOT delete historical
    // orders, projects, payouts, transactions, reports. Only disable their login/account access.
    if (updates.status === 'Inactive') {
      const linkedUser = this.data.users.find(u => u.linkedEmployeeId === id || u.id === currentEmp.linkedUserId);
      if (linkedUser && !linkedUser.isPrimarySuperAdmin) {
        linkedUser.status = 'Inactive';
      }
    } else if (updates.status === 'Active') {
      const linkedUser = this.data.users.find(u => u.linkedEmployeeId === id || u.id === currentEmp.linkedUserId);
      if (linkedUser) {
        linkedUser.status = 'Active';
      }
    }

    this.save();
    return updatedEmp;
  }

  // --- Order Operations ---
  public getOrders(): Order[] {
    return this.data.orders.filter(o => !o.isArchived);
  }

  public getOrderById(id: string): Order | undefined {
    return this.data.orders.find(o => o.id === id);
  }

  public generateOrderId(): string {
    const numbers: number[] = [];

    // Collect from current orders
    for (const o of this.data.orders) {
      const match = o.id.match(/^ORD-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n < 900000) numbers.push(n);
      }
    }

    // Collect from tombstones (deleted records)
    for (const d of (this.data.deletedRecords || [])) {
      const match = d.id.match(/^ORD-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n < 900000) numbers.push(n);
      }
    }

    // Collect from audit logs
    for (const a of (this.data.auditLogs || [])) {
      if (a.entityType === 'Order' && a.entityId) {
        const match = a.entityId.match(/^ORD-(\d+)$/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n < 900000) numbers.push(n);
        }
      }
    }

    let max = numbers.length > 0 ? Math.max(...numbers) : 1000;
    if (max < 1000) max = 1000;

    let candidate = max + 1;
    while (
      this.isRecordDeleted(`ORD-${candidate}`) ||
      this.data.orders.some(o => o.id.toLowerCase() === `ORD-${candidate}`.toLowerCase())
    ) {
      candidate++;
    }

    return `ORD-${candidate}`;
  }

  public async createOrder(orderInput: Partial<Order>, user: string, source: 'Dashboard' | 'Google Sheets' | 'API' = 'Dashboard'): Promise<Order> {
    const id = orderInput.id || this.generateOrderId();
    if (this.data.orders.some(o => o.id.toLowerCase() === id.toLowerCase())) {
      throw new Error(`Order ID ${id} already exists! Duplicate IDs are strictly prohibited.`);
    }

    const totalAmount = Number(orderInput.totalAmount) || 0;
    const paidAmount = Number(orderInput.paidAmount) || 0;
    const dueAmount = totalAmount - paidAmount;

    const now = new Date().toISOString();
    const dhakaNow = getDhakaNowDateTimeString();
    const newOrder: Order = {
      id,
      bookingDate: orderInput.bookingDate ? normalizeDhakaDateTime(orderInput.bookingDate) : dhakaNow,
      targetDeadline: orderInput.targetDeadline ? normalizeDhakaDateTime(orderInput.targetDeadline) : '',
      clientName: orderInput.clientName || '',
      clientContact: orderInput.clientContact || '',
      salesRep: orderInput.salesRep || '',
      serviceName: orderInput.serviceName || '',
      quantityUnit: orderInput.quantityUnit || '1 Unit',
      totalAmount,
      paidAmount,
      dueAmount,
      paymentMethod: orderInput.paymentMethod || 'bKash',
      paymentStatus: orderInput.paymentStatus || (paidAmount === 0 ? 'Unpaid' : paidAmount >= totalAmount ? 'Paid' : 'Partial'),
      deliveryStatus: orderInput.deliveryStatus || 'Pending',
      remarks: orderInput.remarks || '',
      createdAt: now,
      updatedAt: now,
      updatedBy: user,
      source,
      sheetRowIndex: orderInput.sheetRowIndex,
    };

    this.data.orders.unshift(newOrder);
    this.addAuditLog({
      entityType: 'Order',
      entityId: id,
      action: 'CREATE',
      changedBy: user,
      source,
      details: `Created Order ${id} for ${newOrder.clientName} (Total: ৳${totalAmount})`,
    });
    this.save();

    // Authoritative ACID persistence in PostgreSQL
    try {
      await postgresBusinessRepo.saveOrder(newOrder);
    } catch (err: any) {
      console.warn(`[Store] Failed to save order ${id} to PostgreSQL:`, err.message);
    }

    return newOrder;
  }

  public async updateOrder(id: string, updates: Partial<Order>, user: string, source: 'Dashboard' | 'Google Sheets' | 'API' = 'Dashboard'): Promise<Order> {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx === -1) {
      throw new Error(`Order ${id} not found.`);
    }

    const current = this.data.orders[idx];
    const totalAmount = updates.totalAmount !== undefined ? Number(updates.totalAmount) : current.totalAmount;
    const paidAmount = updates.paidAmount !== undefined ? Number(updates.paidAmount) : current.paidAmount;
    const dueAmount = totalAmount - paidAmount;
    const paymentStatus = updates.paymentStatus 
      || (paidAmount >= totalAmount && totalAmount > 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Unpaid'));

    // Track status change for audit
    if (paymentStatus && paymentStatus !== current.paymentStatus) {
      this.addAuditLog({
        entityType: 'Order',
        entityId: id,
        action: 'STATUS_CHANGE',
        fieldChanged: 'paymentStatus',
        previousValue: current.paymentStatus,
        newValue: paymentStatus,
        changedBy: user,
        source,
      });
    }

    if (updates.deliveryStatus && updates.deliveryStatus !== current.deliveryStatus) {
      this.addAuditLog({
        entityType: 'Order',
        entityId: id,
        action: 'STATUS_CHANGE',
        fieldChanged: 'deliveryStatus',
        previousValue: current.deliveryStatus,
        newValue: updates.deliveryStatus,
        changedBy: user,
        source,
      });
    }

    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.bookingDate) {
      normalizedUpdates.bookingDate = normalizeDhakaDateTime(normalizedUpdates.bookingDate);
    }
    if (normalizedUpdates.targetDeadline) {
      normalizedUpdates.targetDeadline = normalizeDhakaDateTime(normalizedUpdates.targetDeadline);
    }

    const updated: Order = {
      ...current,
      ...normalizedUpdates,
      id: current.id, // ID is immutable!
      totalAmount,
      paidAmount,
      dueAmount,
      paymentStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: user,
    };

    this.data.orders[idx] = updated;
    this.addAuditLog({
      entityType: 'Order',
      entityId: id,
      action: 'UPDATE',
      changedBy: user,
      source,
      details: `Updated details for Order ${id}`,
    });
    this.save();

    try {
      await postgresBusinessRepo.saveOrder(updated);
    } catch (err: any) {
      console.warn(`[Store] Failed to update order ${id} in PostgreSQL:`, err.message);
    }

    return updated;
  }

  public async deleteOrder(id: string, user: string, permanent = false): Promise<boolean> {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx === -1) return false;

    if (permanent) {
      this.data.orders.splice(idx, 1);
      try {
        await this.recordDeletion('order', id, user, 'Dashboard');
      } catch (err: any) {
        console.warn(`[Store] Failed to record tombstone for order ${id}:`, err.message);
      }
      try {
        await postgresBusinessRepo.deleteOrder(id);
      } catch (err: any) {
        console.warn(`[Store] Failed to delete order ${id} from PostgreSQL:`, err.message);
      }
    } else {
      this.data.orders[idx].isArchived = true;
      try {
        await postgresBusinessRepo.saveOrder(this.data.orders[idx]);
      } catch (err: any) {
        console.warn(`[Store] Failed to archive order in PostgreSQL:`, err.message);
      }
    }

    this.addAuditLog({
      entityType: 'Order',
      entityId: id,
      action: 'DELETE',
      changedBy: user,
      source: 'Dashboard',
      details: permanent ? `Permanently deleted Order ${id}` : `Archived Order ${id}`,
    });
    this.saveDataDirect(this.data);
    return true;
  }

  // --- Expense Operations ---
  public getExpenses(): Expense[] {
    return this.data.expenses.filter(e => !e.isArchived);
  }

  public getExpenseById(id: string): Expense | undefined {
    return this.data.expenses.find(e => e.id === id);
  }

  public generateExpenseId(): string {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    const numbers: number[] = [];

    for (const e of this.data.expenses) {
      const match = e.id.match(new RegExp(`^EXP-${year}-(\\d+)$`, 'i'));
      if (match) {
        const n = parseInt(match[1], 10);
        if (n < 900000) numbers.push(n);
      }
    }

    for (const d of (this.data.deletedRecords || [])) {
      const match = d.id.match(new RegExp(`^EXP-${year}-(\\d+)$`, 'i'));
      if (match) {
        const n = parseInt(match[1], 10);
        if (n < 900000) numbers.push(n);
      }
    }

    for (const a of (this.data.auditLogs || [])) {
      if (a.entityType === 'Expense' && a.entityId) {
        const match = a.entityId.match(new RegExp(`^EXP-${year}-(\\d+)$`, 'i'));
        if (match) {
          const n = parseInt(match[1], 10);
          if (n < 900000) numbers.push(n);
        }
      }
    }

    let max = numbers.length > 0 ? Math.max(...numbers) : 1000;
    if (max < 1000) max = 1000;

    let candidate = max + 1;
    while (
      this.isRecordDeleted(`${prefix}${candidate}`) ||
      this.data.expenses.some(e => e.id.toLowerCase() === `${prefix}${candidate}`.toLowerCase())
    ) {
      candidate++;
    }

    return `${prefix}${candidate}`;
  }

  public async createExpense(expenseInput: Partial<Expense>, user: string, source: 'Dashboard' | 'Google Sheets' | 'API' = 'Dashboard'): Promise<Expense> {
    const id = expenseInput.id || this.generateExpenseId();
    if (this.data.expenses.some(e => e.id.toLowerCase() === id.toLowerCase())) {
      throw new Error(`Expense ID ${id} already exists! Duplicate IDs are strictly prohibited.`);
    }

    const amount = Number(expenseInput.amount) || 0;
    const now = new Date().toISOString();
    const dhakaNow = getDhakaNowDateTimeString();

    const newExpense: Expense = {
      id,
      dateTime: expenseInput.dateTime ? normalizeDhakaDateTime(expenseInput.dateTime) : dhakaNow,
      category: expenseInput.category || 'Other',
      subCategoryPurpose: expenseInput.subCategoryPurpose || '',
      vendorReceiverName: expenseInput.vendorReceiverName || '',
      amount,
      paymentMethod: expenseInput.paymentMethod || 'Bank Transfer',
      paidFromAccount: expenseInput.paidFromAccount || 'Company Account',
      transactionRefId: expenseInput.transactionRefId || '',
      receiptInvoiceLink: expenseInput.receiptInvoiceLink || '',
      approvedBy: expenseInput.approvedBy || '',
      approvalStatus: expenseInput.approvalStatus || (expenseInput.approvedBy ? 'Approved' : 'Pending Approval'),
      remarks: expenseInput.remarks || '',
      createdAt: now,
      updatedAt: now,
      updatedBy: user,
      source,
      sheetRowIndex: expenseInput.sheetRowIndex,
    };

    this.data.expenses.unshift(newExpense);
    this.addAuditLog({
      entityType: 'Expense',
      entityId: id,
      action: 'CREATE',
      changedBy: user,
      source,
      details: `Created Expense ${id} of ৳${amount} for ${newExpense.category}`,
    });
    this.save();

    try {
      await postgresBusinessRepo.saveExpense(newExpense);
    } catch (err: any) {
      console.warn(`[Store] Failed to save expense ${id} to PostgreSQL:`, err.message);
    }

    return newExpense;
  }

  public async updateExpense(id: string, updates: Partial<Expense>, user: string, source: 'Dashboard' | 'Google Sheets' | 'API' = 'Dashboard'): Promise<Expense> {
    const idx = this.data.expenses.findIndex(e => e.id === id);
    if (idx === -1) {
      throw new Error(`Expense ${id} not found.`);
    }

    const current = this.data.expenses[idx];
    if (updates.approvalStatus && updates.approvalStatus !== current.approvalStatus) {
      this.addAuditLog({
        entityType: 'Expense',
        entityId: id,
        action: 'APPROVAL',
        fieldChanged: 'approvalStatus',
        previousValue: current.approvalStatus,
        newValue: updates.approvalStatus,
        changedBy: user,
        source,
      });
    }

    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.dateTime) {
      normalizedUpdates.dateTime = normalizeDhakaDateTime(normalizedUpdates.dateTime);
    }

    const updated: Expense = {
      ...current,
      ...normalizedUpdates,
      id: current.id,
      amount: updates.amount !== undefined ? Number(updates.amount) : current.amount,
      updatedAt: new Date().toISOString(),
      updatedBy: user,
    };

    this.data.expenses[idx] = updated;
    this.addAuditLog({
      entityType: 'Expense',
      entityId: id,
      action: 'UPDATE',
      changedBy: user,
      source,
      details: `Updated Expense ${id}`,
    });
    this.save();

    try {
      await postgresBusinessRepo.saveExpense(updated);
    } catch (err: any) {
      console.warn(`[Store] Failed to update expense ${id} in PostgreSQL:`, err.message);
    }

    return updated;
  }

  public async deleteExpense(id: string, user: string, permanent = false): Promise<boolean> {
    const idx = this.data.expenses.findIndex(e => e.id === id);
    if (idx === -1) return false;

    if (permanent) {
      this.data.expenses.splice(idx, 1);
      try {
        await this.recordDeletion('expense', id, user, 'Dashboard');
      } catch (err: any) {
        console.warn(`[Store] Failed to record tombstone for expense ${id}:`, err.message);
      }
      try {
        await postgresBusinessRepo.deleteExpense(id);
      } catch (err: any) {
        console.warn(`[Store] Failed to delete expense ${id} from PostgreSQL:`, err.message);
      }
    } else {
      this.data.expenses[idx].isArchived = true;
      try {
        await postgresBusinessRepo.saveExpense(this.data.expenses[idx]);
      } catch (err: any) {
        console.warn(`[Store] Failed to archive expense in PostgreSQL:`, err.message);
      }
    }

    this.addAuditLog({
      entityType: 'Expense',
      entityId: id,
      action: 'DELETE',
      changedBy: user,
      source: 'Dashboard',
      details: permanent ? `Permanently deleted Expense ${id}` : `Archived Expense ${id}`,
    });
    this.saveDataDirect(this.data);
    return true;
  }

  public getExpenseCategories(): string[] {
    const custom = this.data.settings?.customExpenseCategories || [];
    const usedInExpenses = this.data.expenses.map(e => e.category).filter(Boolean);
    const combined = Array.from(new Set([...INITIAL_EXPENSE_CATEGORIES, ...custom, ...usedInExpenses]));
    return combined;
  }

  public addExpenseCategory(catName: string): string[] {
    const trimmed = catName.trim();
    if (!trimmed) return this.getExpenseCategories();

    if (!this.data.settings.customExpenseCategories) {
      this.data.settings.customExpenseCategories = [];
    }

    if (!this.data.settings.customExpenseCategories.includes(trimmed)) {
      this.data.settings.customExpenseCategories.push(trimmed);
      this.save();
    }

    return this.getExpenseCategories();
  }

  // --- Payout Operations ---
  public getPayouts(): Payout[] {
    return this.data.payouts.filter(p => !p.isArchived);
  }

  public getPayoutById(id: string): Payout | undefined {
    return this.data.payouts.find(p => p.id === id);
  }

  public getPayoutsByOrderId(orderId: string): Payout[] {
    return this.data.payouts.filter(p => p.projectOrderId.toLowerCase() === orderId.toLowerCase() && !p.isArchived);
  }

  public generatePayoutId(): string {
    const numbers: number[] = [];

    for (const p of this.data.payouts) {
      const match = p.id.match(/^PAY-PRJ-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n < 900000) numbers.push(n);
      }
    }

    for (const d of (this.data.deletedRecords || [])) {
      const match = d.id.match(/^PAY-PRJ-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n < 900000) numbers.push(n);
      }
    }

    for (const a of (this.data.auditLogs || [])) {
      if (a.entityType === 'Payout' && a.entityId) {
        const match = a.entityId.match(/^PAY-PRJ-(\d+)$/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n < 900000) numbers.push(n);
        }
      }
    }

    let max = numbers.length > 0 ? Math.max(...numbers) : 500;
    if (max < 500) max = 500;

    let candidate = max + 1;
    while (
      this.isRecordDeleted(`PAY-PRJ-${candidate}`) ||
      this.data.payouts.some(p => p.id.toLowerCase() === `PAY-PRJ-${candidate}`.toLowerCase())
    ) {
      candidate++;
    }

    return `PAY-PRJ-${candidate}`;
  }

  public async createPayout(payoutInput: Partial<Payout>, user: string, source: 'Dashboard' | 'Google Sheets' | 'API' = 'Dashboard'): Promise<Payout> {
    const id = payoutInput.id || this.generatePayoutId();
    if (this.data.payouts.some(p => p.id.toLowerCase() === id.toLowerCase())) {
      throw new Error(`Payout ID ${id} already exists! Duplicate IDs are strictly prohibited.`);
    }

    const totalBudget = Number(payoutInput.totalProjectBudget) || 0;
    let agreedPayout = Number(payoutInput.agreedPayoutAmount) || 0;

    // Handle percentage commission
    if (payoutInput.commissionType === 'Percentage (%)' && payoutInput.commissionRate && totalBudget > 0) {
      agreedPayout = Math.round((totalBudget * payoutInput.commissionRate) / 100);
    }

    const advancePaid = Number(payoutInput.advancePaid) || 0;
    const dueFinalPayable = Math.max(0, agreedPayout - advancePaid);

    const now = new Date().toISOString();
    const newPayout: Payout = {
      id,
      projectOrderId: payoutInput.projectOrderId || '',
      serviceName: payoutInput.serviceName || '',
      clientName: payoutInput.clientName || '',
      resourceWorkerName: payoutInput.resourceWorkerName || '',
      totalProjectBudget: totalBudget,
      commissionType: payoutInput.commissionType || 'Fixed Commission',
      commissionRate: payoutInput.commissionRate,
      agreedPayoutAmount: agreedPayout,
      advancePaid,
      dueFinalPayable,
      deliveryStatus: payoutInput.deliveryStatus || 'Pending',
      paymentStatus: payoutInput.paymentStatus || (advancePaid > 0 ? (advancePaid >= agreedPayout ? 'Paid' : 'Partial') : 'Unpaid'),
      approvalStatus: payoutInput.approvalStatus || 'Pending Approval',
      paymentMethod: payoutInput.paymentMethod || 'bKash',
      transactionRefId: payoutInput.transactionRefId || '',
      remarks: payoutInput.remarks || '',
      createdAt: now,
      updatedAt: now,
      updatedBy: user,
      source,
      sheetRowIndex: payoutInput.sheetRowIndex,
    };

    this.data.payouts.unshift(newPayout);
    this.addAuditLog({
      entityType: 'Payout',
      entityId: id,
      action: 'CREATE',
      changedBy: user,
      source,
      details: `Created Payout ${id} for ${newPayout.resourceWorkerName} on ${newPayout.projectOrderId} (Agreed: ৳${agreedPayout})`,
    });
    this.save();

    try {
      await postgresBusinessRepo.savePayout(newPayout);
    } catch (err: any) {
      console.warn(`[Store] Failed to save payout ${id} to PostgreSQL:`, err.message);
    }

    return newPayout;
  }

  public async updatePayout(id: string, updates: Partial<Payout>, user: string, source: 'Dashboard' | 'Google Sheets' | 'API' = 'Dashboard'): Promise<Payout> {
    const idx = this.data.payouts.findIndex(p => p.id === id);
    if (idx === -1) {
      throw new Error(`Payout ${id} not found.`);
    }

    const current = this.data.payouts[idx];
    const totalBudget = updates.totalProjectBudget !== undefined ? Number(updates.totalProjectBudget) : current.totalProjectBudget;
    
    let agreedPayout = updates.agreedPayoutAmount !== undefined ? Number(updates.agreedPayoutAmount) : current.agreedPayoutAmount;
    const commissionType = updates.commissionType || current.commissionType;
    const commissionRate = updates.commissionRate !== undefined ? updates.commissionRate : current.commissionRate;

    if (commissionType === 'Percentage (%)' && commissionRate && totalBudget > 0) {
      agreedPayout = Math.round((totalBudget * commissionRate) / 100);
    }

    const advancePaid = updates.advancePaid !== undefined ? Number(updates.advancePaid) : current.advancePaid;
    const dueFinalPayable = Math.max(0, agreedPayout - advancePaid);

    const updated: Payout = {
      ...current,
      ...updates,
      id: current.id,
      totalProjectBudget: totalBudget,
      commissionType,
      commissionRate,
      agreedPayoutAmount: agreedPayout,
      advancePaid,
      dueFinalPayable,
      updatedAt: new Date().toISOString(),
      updatedBy: user,
    };

    this.data.payouts[idx] = updated;
    this.addAuditLog({
      entityType: 'Payout',
      entityId: id,
      action: 'UPDATE',
      changedBy: user,
      source,
      details: `Updated Payout ${id}`,
    });
    this.save();

    try {
      await postgresBusinessRepo.savePayout(updated);
    } catch (err: any) {
      console.warn(`[Store] Failed to update payout ${id} in PostgreSQL:`, err.message);
    }

    return updated;
  }

  public async deletePayout(id: string, user: string, permanent = false): Promise<boolean> {
    const idx = this.data.payouts.findIndex(p => p.id === id);
    if (idx === -1) return false;

    if (permanent) {
      this.data.payouts.splice(idx, 1);
      try {
        await this.recordDeletion('payout', id, user, 'Dashboard');
      } catch (err: any) {
        console.warn(`[Store] Failed to record tombstone for payout ${id}:`, err.message);
      }
      try {
        await postgresBusinessRepo.deletePayout(id);
      } catch (err: any) {
        console.warn(`[Store] Failed to delete payout ${id} from PostgreSQL:`, err.message);
      }
    } else {
      this.data.payouts[idx].isArchived = true;
      try {
        await postgresBusinessRepo.savePayout(this.data.payouts[idx]);
      } catch (err: any) {
        console.warn(`[Store] Failed to archive payout in PostgreSQL:`, err.message);
      }
    }

    this.addAuditLog({
      entityType: 'Payout',
      entityId: id,
      action: 'DELETE',
      changedBy: user,
      source: 'Dashboard',
      details: permanent ? `Permanently deleted Payout ${id}` : `Archived Payout ${id}`,
    });
    this.saveDataDirect(this.data);
    return true;
  }

  // --- Audit Logs ---
  public getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  public addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string }): AuditLog {
    const dhakaTime = entry.timestamp || new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka', hour12: false });
    const log: AuditLog = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: dhakaTime,
      ...entry,
    };
    this.data.auditLogs.unshift(log);
    // Keep max 1000 logs
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 1000);
    }
    this.save();
    return log;
  }

  // --- Sync Conflicts ---
  public getConflicts(): SyncConflict[] {
    return this.data.conflicts.filter(c => c.status === 'pending');
  }

  public addConflict(conflict: Omit<SyncConflict, 'id' | 'detectedAt' | 'status'>): SyncConflict {
    const newConflict: SyncConflict = {
      id: `CONF-${Date.now()}`,
      detectedAt: new Date().toISOString(),
      status: 'pending',
      ...conflict,
    };
    this.data.conflicts.push(newConflict);
    this.save();
    return newConflict;
  }

  public async resolveConflict(conflictId: string, resolution: 'keep_sheet' | 'keep_dashboard', user: string): Promise<boolean> {
    const idx = this.data.conflicts.findIndex(c => c.id === conflictId);
    if (idx === -1) return false;
    const conflict = this.data.conflicts[idx];

    if (resolution === 'keep_sheet') {
      if (conflict.entityType === 'Order') {
        const order = this.getOrderById(conflict.entityId);
        if (order) {
          await this.updateOrder(conflict.entityId, conflict.sheetData as any, user, 'Google Sheets');
        }
      } else if (conflict.entityType === 'Expense') {
        const expense = this.getExpenseById(conflict.entityId);
        if (expense) {
          await this.updateExpense(conflict.entityId, conflict.sheetData as any, user, 'Google Sheets');
        }
      } else if (conflict.entityType === 'Payout') {
        const payout = this.getPayoutById(conflict.entityId);
        if (payout) {
          await this.updatePayout(conflict.entityId, conflict.sheetData as any, user, 'Google Sheets');
        }
      }
    }

    conflict.status = 'resolved';
    this.save();
    return true;
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
      googleSheets: {
        ...this.data.settings.googleSheets,
        ...(updates.googleSheets || {}),
        isConfigured: Boolean(
          (updates.googleSheets?.spreadsheetId || this.data.settings.googleSheets.spreadsheetId) &&
          (updates.googleSheets?.serviceAccountEmail || this.data.settings.googleSheets.serviceAccountEmail)
        )
      },
      telegram: {
        ...this.data.settings.telegram,
        ...(updates.telegram || {}),
      }
    };
    this.save();
    return this.data.settings;
  }

  // =========================================================================
  // GOOGLE SHEETS RECONCILIATION ENGINE (Single Source of Truth)
  // =========================================================================

  /**
   * Reconciles Sales & Orders with Google Sheets dataset.
   * Matches strictly by permanent unique Order ID (e.g. ORD-1001).
   * - Adds new records present in Sheets but missing in CRM
   * - Updates changed records
   * - Removes records from active dataset when deleted in Google Sheets
   * - If sheet is confirmed empty (0 records), active dataset becomes 0
   * - Detects duplicate IDs in Google Sheets and prevents duplicates in CRM
   */
  public reconcileOrders(incomingOrders: Partial<Order>[], source: 'Google Sheets' | 'Dashboard' | 'API' = 'Google Sheets'): SyncModuleSummary {
    const summary: SyncModuleSummary = {
      added: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      duplicates: 0,
      invalid: 0,
      totalActive: 0,
    };

    const seenIds = new Set<string>();
    const validIncoming: Order[] = [];

    for (const raw of incomingOrders) {
      const rawId = (raw.id || '').trim();
      if (!rawId) {
        summary.invalid++;
        continue;
      }

      // CRITICAL: Prevent resurrection of deleted records!
      if (this.isRecordDeleted(rawId)) {
        console.log(`[Store] Reconcile Orders: Skipping deleted record tombstone ${rawId}`);
        continue;
      }

      const lowerId = rawId.toLowerCase();
      if (seenIds.has(lowerId)) {
        summary.duplicates++;
        continue; // Prevent duplicate CRM entries; keep first occurrence
      }
      seenIds.add(lowerId);

      const total = Number(raw.totalAmount) || 0;
      const paid = Number(raw.paidAmount) || 0;
      const due = Math.max(0, total - paid);

      const orderRecord: Order = {
        id: rawId,
        bookingDate: normalizeDhakaDateTime(raw.bookingDate),
        targetDeadline: normalizeDhakaDateTime(raw.targetDeadline),
        clientName: raw.clientName || '',
        clientContact: raw.clientContact || '',
        salesRep: raw.salesRep || '',
        serviceName: raw.serviceName || '',
        quantityUnit: raw.quantityUnit || '1 Unit',
        totalAmount: total,
        paidAmount: paid,
        dueAmount: due,
        paymentMethod: raw.paymentMethod || 'bKash',
        paymentStatus: (raw.paymentStatus as any) || (paid >= total && total > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'),
        deliveryStatus: (raw.deliveryStatus as any) || 'Pending',
        remarks: raw.remarks || '',
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'Google Sheets',
        sheetRowIndex: raw.sheetRowIndex,
      };
      validIncoming.push(orderRecord);
    }

    // 1. Identify records to remove (only records originating from Google Sheets that are now missing)
    const currentActive = this.data.orders.filter(o => !o.isArchived);
    const toRemove = currentActive.filter(o => o.source === 'Google Sheets' && !seenIds.has(o.id.toLowerCase()));
    summary.removed = toRemove.length;

    for (const rem of toRemove) {
      this.addAuditLog({
        entityType: 'Order',
        entityId: rem.id,
        action: 'DELETE',
        changedBy: 'Google Sheets Sync',
        source,
        details: `Removed Order ${rem.id} from active dataset as it was deleted from Google Sheets.`,
      });
      postgresBusinessRepo.deleteOrder(rem.id).catch(() => {});
    }

    // 2. Build authoritative orders dataset
    // Preserve all active CRM-originated records so they never get pruned by Sheets sync
    const crmOrders = currentActive.filter(o => o.source !== 'Google Sheets');
    const reconciledList: Order[] = [...crmOrders];

    for (const incoming of validIncoming) {
      const existing = this.data.orders.find(o => o.id.toLowerCase() === incoming.id.toLowerCase());
      if (!existing) {
        summary.added++;
        reconciledList.push(incoming);
        this.addAuditLog({
          entityType: 'Order',
          entityId: incoming.id,
          action: 'CREATE',
          changedBy: 'Google Sheets Sync',
          source,
          details: `Added new Order ${incoming.id} from Google Sheets (${incoming.clientName}, Total: ৳${incoming.totalAmount}).`,
        });
        postgresBusinessRepo.saveOrder(incoming).catch(() => {});
      } else {
        const isChanged = 
          existing.totalAmount !== incoming.totalAmount ||
          existing.paidAmount !== incoming.paidAmount ||
          existing.clientName !== incoming.clientName ||
          existing.clientContact !== incoming.clientContact ||
          existing.salesRep !== incoming.salesRep ||
          existing.serviceName !== incoming.serviceName ||
          existing.paymentStatus !== incoming.paymentStatus ||
          existing.deliveryStatus !== incoming.deliveryStatus ||
          existing.bookingDate !== incoming.bookingDate ||
          existing.targetDeadline !== incoming.targetDeadline ||
          existing.paymentMethod !== incoming.paymentMethod ||
          existing.quantityUnit !== incoming.quantityUnit ||
          existing.remarks !== incoming.remarks;

        if (isChanged) {
          summary.updated++;
          const updated: Order = {
            ...existing,
            ...incoming,
            createdAt: existing.createdAt, // Preserve original timestamp
            updatedAt: new Date().toISOString(),
            updatedBy: 'Google Sheets Sync',
            isArchived: false,
          };
          const crmIdx = reconciledList.findIndex(o => o.id.toLowerCase() === incoming.id.toLowerCase());
          if (crmIdx !== -1) {
            reconciledList[crmIdx] = updated;
          } else {
            reconciledList.push(updated);
          }
          postgresBusinessRepo.saveOrder(updated).catch(() => {});
        } else {
          summary.unchanged++;
          existing.isArchived = false;
          existing.sheetRowIndex = incoming.sheetRowIndex;
          if (!reconciledList.some(o => o.id.toLowerCase() === incoming.id.toLowerCase())) {
            reconciledList.push(existing);
          }
        }
      }
    }

    // Overwrite orders with the authoritative reconciled dataset
    this.data.orders = reconciledList;
    summary.totalActive = this.data.orders.length;
    this.save();

    return summary;
  }

  /**
   * Reconciles Expenses with Google Sheets dataset.
   * Matches strictly by permanent unique Expense ID (e.g. EXP-2026-1001).
   */
  public reconcileExpenses(incomingExpenses: Partial<Expense>[], source: 'Google Sheets' | 'Dashboard' | 'API' = 'Google Sheets'): SyncModuleSummary {
    const summary: SyncModuleSummary = {
      added: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      duplicates: 0,
      invalid: 0,
      totalActive: 0,
    };

    const seenIds = new Set<string>();
    const validIncoming: Expense[] = [];

    for (const raw of incomingExpenses) {
      const rawId = (raw.id || '').trim();
      if (!rawId) {
        summary.invalid++;
        continue;
      }

      // CRITICAL: Prevent resurrection of deleted records!
      if (this.isRecordDeleted(rawId)) {
        console.log(`[Store] Reconcile Expenses: Skipping deleted record tombstone ${rawId}`);
        continue;
      }

      const lowerId = rawId.toLowerCase();
      if (seenIds.has(lowerId)) {
        summary.duplicates++;
        continue;
      }
      seenIds.add(lowerId);

      const amount = Number(raw.amount) || 0;

      const expenseRecord: Expense = {
        id: rawId,
        dateTime: normalizeDhakaDateTime(raw.dateTime),
        category: raw.category || 'Other',
        subCategoryPurpose: raw.subCategoryPurpose || '',
        vendorReceiverName: raw.vendorReceiverName || '',
        amount,
        paymentMethod: raw.paymentMethod || 'Bank Transfer',
        paidFromAccount: raw.paidFromAccount || 'Company Account',
        transactionRefId: raw.transactionRefId || '',
        receiptInvoiceLink: raw.receiptInvoiceLink || '',
        approvedBy: raw.approvedBy || '',
        approvalStatus: (raw.approvalStatus as any) || (raw.approvedBy ? 'Approved' : 'Pending Approval'),
        remarks: raw.remarks || '',
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'Google Sheets',
        sheetRowIndex: raw.sheetRowIndex,
      };
      validIncoming.push(expenseRecord);
    }

    // 1. Identify records to remove (only records originating from Google Sheets that are now missing)
    const currentActive = this.data.expenses.filter(e => !e.isArchived);
    const toRemove = currentActive.filter(e => e.source === 'Google Sheets' && !seenIds.has(e.id.toLowerCase()));
    summary.removed = toRemove.length;

    for (const rem of toRemove) {
      this.addAuditLog({
        entityType: 'Expense',
        entityId: rem.id,
        action: 'DELETE',
        changedBy: 'Google Sheets Sync',
        source,
        details: `Removed Expense ${rem.id} from active dataset as it was deleted from Google Sheets.`,
      });
      postgresBusinessRepo.deleteExpense(rem.id).catch(() => {});
    }

    // 2. Build authoritative expenses dataset
    // Preserve all active CRM-originated records so they never get pruned by Sheets sync
    const crmExpenses = currentActive.filter(e => e.source !== 'Google Sheets');
    const reconciledList: Expense[] = [...crmExpenses];

    for (const incoming of validIncoming) {
      const existing = this.data.expenses.find(e => e.id.toLowerCase() === incoming.id.toLowerCase());
      if (!existing) {
        summary.added++;
        reconciledList.push(incoming);
        this.addAuditLog({
          entityType: 'Expense',
          entityId: incoming.id,
          action: 'CREATE',
          changedBy: 'Google Sheets Sync',
          source,
          details: `Added new Expense ${incoming.id} from Google Sheets (${incoming.category}, Amount: ৳${incoming.amount}).`,
        });
        postgresBusinessRepo.saveExpense(incoming).catch(() => {});
      } else {
        const isChanged =
          existing.amount !== incoming.amount ||
          existing.category !== incoming.category ||
          existing.subCategoryPurpose !== incoming.subCategoryPurpose ||
          existing.vendorReceiverName !== incoming.vendorReceiverName ||
          existing.paymentMethod !== incoming.paymentMethod ||
          existing.paidFromAccount !== incoming.paidFromAccount ||
          existing.approvedBy !== incoming.approvedBy ||
          existing.approvalStatus !== incoming.approvalStatus ||
          existing.transactionRefId !== incoming.transactionRefId ||
          existing.dateTime !== incoming.dateTime ||
          existing.remarks !== incoming.remarks;

        if (isChanged) {
          summary.updated++;
          const updated: Expense = {
            ...existing,
            ...incoming,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Google Sheets Sync',
            isArchived: false,
          };
          const crmIdx = reconciledList.findIndex(e => e.id.toLowerCase() === incoming.id.toLowerCase());
          if (crmIdx !== -1) {
            reconciledList[crmIdx] = updated;
          } else {
            reconciledList.push(updated);
          }
          postgresBusinessRepo.saveExpense(updated).catch(() => {});
        } else {
          summary.unchanged++;
          existing.isArchived = false;
          existing.sheetRowIndex = incoming.sheetRowIndex;
          if (!reconciledList.some(e => e.id.toLowerCase() === incoming.id.toLowerCase())) {
            reconciledList.push(existing);
          }
        }
      }
    }

    this.data.expenses = reconciledList;
    summary.totalActive = this.data.expenses.length;
    this.save();

    return summary;
  }

  /**
   * Reconciles Project / Resource Payouts with Google Sheets dataset.
   * Matches strictly by permanent unique Payout ID (e.g. PAY-PRJ-501).
   */
  public reconcilePayouts(incomingPayouts: Partial<Payout>[], source: 'Google Sheets' | 'Dashboard' | 'API' = 'Google Sheets'): SyncModuleSummary {
    const summary: SyncModuleSummary = {
      added: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      duplicates: 0,
      invalid: 0,
      totalActive: 0,
    };

    const seenIds = new Set<string>();
    const validIncoming: Payout[] = [];

    for (const raw of incomingPayouts) {
      const rawId = (raw.id || '').trim();
      if (!rawId) {
        summary.invalid++;
        continue;
      }

      // CRITICAL: Prevent resurrection of deleted records!
      if (this.isRecordDeleted(rawId)) {
        console.log(`[Store] Reconcile Payouts: Skipping deleted record tombstone ${rawId}`);
        continue;
      }

      const lowerId = rawId.toLowerCase();
      if (seenIds.has(lowerId)) {
        summary.duplicates++;
        continue;
      }
      seenIds.add(lowerId);

      const totalBudget = Number(raw.totalProjectBudget) || 0;
      let agreedPayout = Number(raw.agreedPayoutAmount) || 0;
      if (raw.commissionType === 'Percentage (%)' && raw.commissionRate && totalBudget > 0) {
        agreedPayout = Math.round((totalBudget * raw.commissionRate) / 100);
      }
      const advancePaid = Number(raw.advancePaid) || 0;
      const dueFinalPayable = Math.max(0, agreedPayout - advancePaid);

      const payoutRecord: Payout = {
        id: rawId,
        projectOrderId: raw.projectOrderId || '',
        serviceName: raw.serviceName || '',
        clientName: raw.clientName || '',
        resourceWorkerName: raw.resourceWorkerName || '',
        totalProjectBudget: totalBudget,
        commissionType: (raw.commissionType as any) || 'Fixed Commission',
        commissionRate: raw.commissionRate,
        agreedPayoutAmount: agreedPayout,
        advancePaid,
        dueFinalPayable,
        deliveryStatus: (raw.deliveryStatus as any) || 'Pending',
        paymentStatus: (raw.paymentStatus as any) || (advancePaid >= agreedPayout && agreedPayout > 0 ? 'Paid' : advancePaid > 0 ? 'Partial' : 'Unpaid'),
        approvalStatus: (raw.approvalStatus as any) || 'Pending Approval',
        paymentMethod: raw.paymentMethod || 'bKash',
        transactionRefId: raw.transactionRefId || '',
        remarks: raw.remarks || '',
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'Google Sheets',
        sheetRowIndex: raw.sheetRowIndex,
      };
      validIncoming.push(payoutRecord);
    }

    // 1. Identify records to remove (only records originating from Google Sheets that are now missing)
    const currentActive = this.data.payouts.filter(p => !p.isArchived);
    const toRemove = currentActive.filter(p => p.source === 'Google Sheets' && !seenIds.has(p.id.toLowerCase()));
    summary.removed = toRemove.length;

    for (const rem of toRemove) {
      this.addAuditLog({
        entityType: 'Payout',
        entityId: rem.id,
        action: 'DELETE',
        changedBy: 'Google Sheets Sync',
        source,
        details: `Removed Payout ${rem.id} from active dataset as it was deleted from Google Sheets.`,
      });
      postgresBusinessRepo.deletePayout(rem.id).catch(() => {});
    }

    // 2. Build authoritative payouts dataset
    // Preserve all active CRM-originated records so they never get pruned by Sheets sync
    const crmPayouts = currentActive.filter(p => p.source !== 'Google Sheets');
    const reconciledList: Payout[] = [...crmPayouts];

    for (const incoming of validIncoming) {
      const existing = this.data.payouts.find(p => p.id.toLowerCase() === incoming.id.toLowerCase());
      if (!existing) {
        summary.added++;
        reconciledList.push(incoming);
        this.addAuditLog({
          entityType: 'Payout',
          entityId: incoming.id,
          action: 'CREATE',
          changedBy: 'Google Sheets Sync',
          source,
          details: `Added new Payout ${incoming.id} from Google Sheets (${incoming.resourceWorkerName}, Agreed: ৳${incoming.agreedPayoutAmount}).`,
        });
        postgresBusinessRepo.savePayout(incoming).catch(() => {});
      } else {
        const isChanged =
          existing.totalProjectBudget !== incoming.totalProjectBudget ||
          existing.agreedPayoutAmount !== incoming.agreedPayoutAmount ||
          existing.advancePaid !== incoming.advancePaid ||
          existing.dueFinalPayable !== incoming.dueFinalPayable ||
          existing.resourceWorkerName !== incoming.resourceWorkerName ||
          existing.deliveryStatus !== incoming.deliveryStatus ||
          existing.paymentStatus !== incoming.paymentStatus ||
          existing.approvalStatus !== incoming.approvalStatus ||
          existing.paymentMethod !== incoming.paymentMethod ||
          existing.transactionRefId !== incoming.transactionRefId ||
          existing.remarks !== incoming.remarks;

        if (isChanged) {
          summary.updated++;
          const updated: Payout = {
            ...existing,
            ...incoming,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Google Sheets Sync',
            isArchived: false,
          };
          const crmIdx = reconciledList.findIndex(p => p.id.toLowerCase() === incoming.id.toLowerCase());
          if (crmIdx !== -1) {
            reconciledList[crmIdx] = updated;
          } else {
            reconciledList.push(updated);
          }
          postgresBusinessRepo.savePayout(updated).catch(() => {});
        } else {
          summary.unchanged++;
          existing.isArchived = false;
          existing.sheetRowIndex = incoming.sheetRowIndex;
          if (!reconciledList.some(p => p.id.toLowerCase() === incoming.id.toLowerCase())) {
            reconciledList.push(existing);
          }
        }
      }
    }

    this.data.payouts = reconciledList;
    summary.totalActive = this.data.payouts.length;
    this.save();

    return summary;
  }

  /**
   * Reconciles all 3 modules simultaneously and stores the full summary.
   */
  public reconcileAll(
    data: {
      orders?: Partial<Order>[];
      expenses?: Partial<Expense>[];
      payouts?: Partial<Payout>[];
    },
    source: 'Google Sheets' | 'Dashboard' | 'API' = 'Google Sheets'
  ): SyncSummary {
    const ordersSummary = data.orders !== undefined ? this.reconcileOrders(data.orders, source) : {
      added: 0, updated: 0, removed: 0, unchanged: this.data.orders.length, duplicates: 0, invalid: 0, totalActive: this.data.orders.length
    };
    const expensesSummary = data.expenses !== undefined ? this.reconcileExpenses(data.expenses, source) : {
      added: 0, updated: 0, removed: 0, unchanged: this.data.expenses.length, duplicates: 0, invalid: 0, totalActive: this.data.expenses.length
    };
    const payoutsSummary = data.payouts !== undefined ? this.reconcilePayouts(data.payouts, source) : {
      added: 0, updated: 0, removed: 0, unchanged: this.data.payouts.length, duplicates: 0, invalid: 0, totalActive: this.data.payouts.length
    };

    const totalActiveRecords = ordersSummary.totalActive + expensesSummary.totalActive + payoutsSummary.totalActive;
    const now = new Date().toISOString();

    const summary: SyncSummary = {
      orders: ordersSummary,
      expenses: expensesSummary,
      payouts: payoutsSummary,
      totalActiveRecords,
      timestamp: now,
    };

    this.data.settings.googleSheets.syncSummary = summary;
    this.save();

    return summary;
  }
}

export const store = new Store();
