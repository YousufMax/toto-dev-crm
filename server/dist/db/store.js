import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDhakaNowDateTimeString, normalizeDhakaDateTime } from '../utils/date.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
// --- Secure Password Hashing & Verification via Node.js Crypto (Scrypt) ---
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
}
export function verifyPassword(password, combinedHash) {
    if (!combinedHash || !combinedHash.includes(':'))
        return false;
    try {
        const [salt, key] = combinedHash.split(':');
        const keyBuffer = Buffer.from(key, 'hex');
        const derivedKey = crypto.scryptSync(password, salt, 64);
        return crypto.timingSafeEqual(keyBuffer, derivedKey);
    }
    catch (err) {
        return false;
    }
}
// Helpers for role permissions matrix
function buildModulePerms(overrides = {}) {
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
function fullModulePerms() {
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
export const DEFAULT_ROLES = [
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
export const DEFAULT_EMPLOYEES = [
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
export const DEFAULT_USERS = [
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
function seedInitialData() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowIso = now.toISOString();
    // Create dates relative to today
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const orders = [
        {
            id: 'ORD-1001',
            bookingDate: `${todayStr} 10:30`,
            targetDeadline: `${todayStr} 18:00`,
            clientName: 'Rajesh / VK Brand',
            clientContact: '01711223344',
            salesRep: 'Rajib',
            serviceName: 'Graphic Design',
            quantityUnit: '4 Pcs',
            totalAmount: 4000,
            paidAmount: 2000,
            dueAmount: 2000,
            paymentMethod: 'bKash',
            paymentStatus: 'Partial',
            deliveryStatus: 'In Progress',
            remarks: 'Logo and Social Media Banner design',
            createdAt: `${todayStr}T10:30:00+06:00`,
            updatedAt: `${todayStr}T10:30:00+06:00`,
            source: 'Google Sheets',
        },
        {
            id: 'ORD-1002',
            bookingDate: `${todayStr} 11:15`,
            targetDeadline: `${todayStr} 20:00`,
            clientName: 'Green Life Agro',
            clientContact: '01899887766',
            salesRep: 'Tanvir',
            serviceName: 'Full-Stack Web Development',
            quantityUnit: '1 System',
            totalAmount: 35000,
            paidAmount: 15000,
            dueAmount: 20000,
            paymentMethod: 'Bank Transfer',
            paymentStatus: 'Partial',
            deliveryStatus: 'In Progress',
            remarks: 'Custom CRM Portal with inventory tracking',
            createdAt: `${todayStr}T11:15:00+06:00`,
            updatedAt: `${todayStr}T11:15:00+06:00`,
            source: 'Dashboard',
        },
        {
            id: 'ORD-1003',
            bookingDate: `${yesterday} 14:00`,
            targetDeadline: `${todayStr} 15:00`,
            clientName: 'Apex Fashion Ltd',
            clientContact: '01912345678',
            salesRep: 'Rajib',
            serviceName: 'UI/UX Mobile App Redesign',
            quantityUnit: '12 Screens',
            totalAmount: 18000,
            paidAmount: 18000,
            dueAmount: 0,
            paymentMethod: 'Nagad',
            paymentStatus: 'Paid',
            deliveryStatus: 'Completed',
            remarks: 'E-commerce mobile app design in Figma',
            createdAt: `${yesterday}T14:00:00+06:00`,
            updatedAt: `${todayStr}T14:30:00+06:00`,
            source: 'Google Sheets',
        },
        {
            id: 'ORD-1004',
            bookingDate: `${threeDaysAgo} 16:45`,
            targetDeadline: `${yesterday} 12:00`,
            clientName: 'Smart Solution BD',
            clientContact: '01700998811',
            salesRep: 'Tanvir',
            serviceName: 'SEO & Content Marketing',
            quantityUnit: '1 Month',
            totalAmount: 12000,
            paidAmount: 6000,
            dueAmount: 6000,
            paymentMethod: 'bKash',
            paymentStatus: 'Partial',
            deliveryStatus: 'Review',
            remarks: 'Technical SEO Audit & Keyword strategy',
            createdAt: `${threeDaysAgo}T16:45:00+06:00`,
            updatedAt: `${yesterday}T16:00:00+06:00`,
            source: 'Dashboard',
        },
        {
            id: 'ORD-1005',
            bookingDate: `${fiveDaysAgo} 09:30`,
            targetDeadline: `${threeDaysAgo} 18:00`,
            clientName: 'TechHub Dhaka',
            clientContact: '01655443322',
            salesRep: 'Rajib',
            serviceName: 'API Integration & Webhook',
            quantityUnit: '2 Endpoints',
            totalAmount: 8000,
            paidAmount: 8000,
            dueAmount: 0,
            paymentMethod: 'Bank Transfer',
            paymentStatus: 'Paid',
            deliveryStatus: 'Delivered',
            remarks: 'Payment gateway integration with SMS notification',
            createdAt: `${fiveDaysAgo}T09:30:00+06:00`,
            updatedAt: `${threeDaysAgo}T17:00:00+06:00`,
            source: 'Google Sheets',
        }
    ];
    const expenses = [
        {
            id: 'EXP-2026-1001',
            dateTime: `${todayStr} 10:30`,
            category: 'Employee Salary',
            subCategoryPurpose: 'September Technical Team Salary',
            vendorReceiverName: 'Developer Sakib',
            amount: 15000,
            paymentMethod: 'Bank Transfer',
            paidFromAccount: 'City Bank A/C',
            transactionRefId: 'TXN987654321',
            receiptInvoiceLink: 'https://drive.google.com/sample-receipt-1',
            approvedBy: 'MD Yousuf Ali',
            approvalStatus: 'Paid',
            remarks: 'Full monthly salary cleared',
            createdAt: `${todayStr}T10:30:00+06:00`,
            updatedAt: `${todayStr}T10:30:00+06:00`,
            source: 'Google Sheets',
        },
        {
            id: 'EXP-2026-1002',
            dateTime: `${todayStr} 12:45`,
            category: 'Hosting / Domain',
            subCategoryPurpose: 'Production Cloud Cluster Renewal',
            vendorReceiverName: 'DigitalOcean / Cloudflare',
            amount: 4500,
            paymentMethod: 'Credit Card',
            paidFromAccount: 'Eastern Bank Card',
            transactionRefId: 'INV-DO-9821',
            receiptInvoiceLink: 'https://drive.google.com/sample-receipt-2',
            approvedBy: 'MD Yousuf Ali',
            approvalStatus: 'Approved',
            remarks: 'Monthly server & DNS load balancer hosting',
            createdAt: `${todayStr}T12:45:00+06:00`,
            updatedAt: `${todayStr}T12:45:00+06:00`,
            source: 'Dashboard',
        },
        {
            id: 'EXP-2026-1003',
            dateTime: `${yesterday} 16:20`,
            category: 'Office Expense',
            subCategoryPurpose: 'High Speed Fiber Internet Bill',
            vendorReceiverName: 'Carnival Internet',
            amount: 2500,
            paymentMethod: 'bKash',
            paidFromAccount: 'bKash Merchant',
            transactionRefId: 'BKT8829104',
            receiptInvoiceLink: 'https://drive.google.com/sample-receipt-3',
            approvedBy: 'Fatima Zohra',
            approvalStatus: 'Paid',
            remarks: 'Monthly office high bandwidth connectivity',
            createdAt: `${yesterday}T16:20:00+06:00`,
            updatedAt: `${yesterday}T16:20:00+06:00`,
            source: 'Dashboard',
        },
        {
            id: 'EXP-2026-1004',
            dateTime: `${threeDaysAgo} 11:00`,
            category: 'Marketing & Ads',
            subCategoryPurpose: 'Meta Ads Campaign for Q4 Sales',
            vendorReceiverName: 'Facebook Ads',
            amount: 6000,
            paymentMethod: 'Credit Card',
            paidFromAccount: 'City Bank Dual Currency',
            transactionRefId: 'FB-ADS-99120',
            receiptInvoiceLink: 'https://drive.google.com/sample-receipt-4',
            approvedBy: 'MD Yousuf Ali',
            approvalStatus: 'Paid',
            remarks: 'Lead generation campaign for design & web clients',
            createdAt: `${threeDaysAgo}T11:00:00+06:00`,
            updatedAt: `${threeDaysAgo}T11:00:00+06:00`,
            source: 'Google Sheets',
        }
    ];
    const payouts = [
        {
            id: 'PAY-PRJ-501',
            projectOrderId: 'ORD-1001',
            serviceName: 'Graphic Design',
            clientName: 'Rajesh / VK Brand',
            resourceWorkerName: 'Freelancer Rahim',
            totalProjectBudget: 4000,
            commissionType: 'Fixed Commission',
            agreedPayoutAmount: 1500,
            advancePaid: 500,
            dueFinalPayable: 1000,
            deliveryStatus: 'In Progress',
            paymentStatus: 'Partial',
            approvalStatus: 'Advance Paid',
            paymentMethod: 'bKash',
            transactionRefId: 'TRX987654321',
            remarks: 'Advance paid, final payable after file approval',
            createdAt: `${todayStr}T10:45:00+06:00`,
            updatedAt: `${todayStr}T10:45:00+06:00`,
            source: 'Google Sheets',
        },
        {
            id: 'PAY-PRJ-502',
            projectOrderId: 'ORD-1002',
            serviceName: 'Full-Stack Web Development',
            clientName: 'Green Life Agro',
            resourceWorkerName: 'Developer Sakib',
            totalProjectBudget: 35000,
            commissionType: 'Percentage (%)',
            commissionRate: 40,
            agreedPayoutAmount: 14000,
            advancePaid: 5000,
            dueFinalPayable: 9000,
            deliveryStatus: 'In Progress',
            paymentStatus: 'Partial',
            approvalStatus: 'Advance Paid',
            paymentMethod: 'Bank Transfer',
            transactionRefId: 'BTX-5544321',
            remarks: 'Frontend architecture and backend database schema',
            createdAt: `${todayStr}T11:30:00+06:00`,
            updatedAt: `${todayStr}T11:30:00+06:00`,
            source: 'Dashboard',
        },
        {
            id: 'PAY-PRJ-503',
            projectOrderId: 'ORD-1003',
            serviceName: 'UI/UX Mobile App Redesign',
            clientName: 'Apex Fashion Ltd',
            resourceWorkerName: 'Freelancer Rahim',
            totalProjectBudget: 18000,
            commissionType: 'Fixed Commission',
            agreedPayoutAmount: 7000,
            advancePaid: 3000,
            dueFinalPayable: 0,
            deliveryStatus: 'Completed',
            paymentStatus: 'Paid',
            approvalStatus: 'Final Paid',
            paymentMethod: 'Nagad',
            transactionRefId: 'NGD-990011',
            remarks: 'All 12 design screens delivered and client approved',
            createdAt: `${yesterday}T14:30:00+06:00`,
            updatedAt: `${todayStr}T15:00:00+06:00`,
            source: 'Google Sheets',
        }
    ];
    const auditLogs = [
        {
            id: 'AUD-001',
            entityType: 'Order',
            entityId: 'ORD-1001',
            action: 'CREATE',
            changedBy: 'Rajib Ahmed',
            timestamp: `${todayStr} 10:30:00`,
            source: 'Google Sheets',
            details: 'Created Order ORD-1001 for Rajesh / VK Brand (Graphic Design)',
        },
        {
            id: 'AUD-002',
            entityType: 'Payout',
            entityId: 'PAY-PRJ-501',
            action: 'CREATE',
            changedBy: 'Hasan Mahmud',
            timestamp: `${todayStr} 10:45:00`,
            source: 'Google Sheets',
            details: 'Assigned Freelancer Rahim for ORD-1001, Advance: ৳500',
        },
        {
            id: 'AUD-003',
            entityType: 'Expense',
            entityId: 'EXP-2026-1001',
            action: 'APPROVAL',
            fieldChanged: 'approvalStatus',
            previousValue: 'Pending Approval',
            newValue: 'Paid',
            changedBy: 'MD Yousuf Ali',
            timestamp: `${todayStr} 10:30:00`,
            source: 'Google Sheets',
            details: 'Approved and paid Developer Sakib September salary ৳15,000',
        }
    ];
    const settings = {
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
    data;
    saveTimeout = null;
    constructor() {
        this.data = this.loadData();
    }
    loadData() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf-8');
                const parsed = JSON.parse(raw);
                // Ensure roles array exists with system defaults
                let roles = Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : [...DEFAULT_ROLES];
                // Ensure default system roles exist in roles array
                for (const defRole of DEFAULT_ROLES) {
                    if (!roles.some(r => r.id === defRole.id || r.name.toLowerCase() === defRole.name.toLowerCase())) {
                        roles.push(defRole);
                    }
                }
                // Ensure employees exist
                let employees = Array.isArray(parsed.employees) && parsed.employees.length > 0 ? parsed.employees : [...DEFAULT_EMPLOYEES];
                // Ensure users have password hashes and links
                let users = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_USERS];
                users = users.map(u => {
                    const defaultMatch = DEFAULT_USERS.find(d => d.id === u.id || d.email.toLowerCase() === (u.email || '').toLowerCase());
                    const rawRole = (u.role || '').toLowerCase();
                    let roleMatch = roles.find(r => r.id === u.roleId || r.name.toLowerCase() === rawRole);
                    if (!roleMatch) {
                        if (rawRole.includes('sales rep') || rawRole.includes('sales officer')) {
                            roleMatch = roles.find(r => r.id === 'role-sales-officer');
                        }
                        else if (rawRole.includes('finance')) {
                            roleMatch = roles.find(r => r.id === 'role-finance-manager');
                        }
                        else if (rawRole.includes('project')) {
                            roleMatch = roles.find(r => r.id === 'role-project-manager');
                        }
                        else if (rawRole.includes('coo')) {
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
                // CRITICAL: Do NOT automatically recreate deleted user accounts!
                // User accounts created or deleted by an administrator must remain persistent.
                // Ensure MD Yousuf Ali is protected Primary Super Admin
                const adminIndex = users.findIndex(u => u.isPrimarySuperAdmin || u.email === 'admin@totodev.com');
                if (adminIndex !== -1) {
                    users[adminIndex].isPrimarySuperAdmin = true;
                    users[adminIndex].roleId = 'role-super-admin';
                    users[adminIndex].role = 'Super Admin';
                    users[adminIndex].status = 'Active';
                }
                const fullData = {
                    ...seedInitialData(),
                    ...parsed,
                    roles,
                    employees,
                    users,
                    settings: {
                        ...seedInitialData().settings,
                        ...(parsed.settings || {}),
                    },
                };
                return fullData;
            }
        }
        catch (err) {
            console.error('[Store] Failed to load data from file, falling back to seed:', err);
        }
        const seed = seedInitialData();
        this.saveDataDirect(seed);
        return seed;
    }
    saveDataDirect(dataToSave) {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            const tmpFile = `${DATA_FILE}.tmp`;
            fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
            fs.renameSync(tmpFile, DATA_FILE);
        }
        catch (err) {
            console.error('[Store] Error saving database file:', err);
        }
    }
    save() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveDataDirect(this.data);
        }, 150);
    }
    // --- Users & Authentication ---
    getUsers() {
        return this.data.users.map(({ passwordHash, ...safeUser }) => safeUser);
    }
    getUsersWithCredentials() {
        return this.data.users;
    }
    getUserById(id) {
        const user = this.data.users.find(u => u.id === id);
        if (!user)
            return undefined;
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }
    getUserByIdWithCredentials(id) {
        return this.data.users.find(u => u.id === id);
    }
    getUserByEmailOrUsername(identifier) {
        if (!identifier)
            return undefined;
        const clean = identifier.trim().toLowerCase();
        return this.data.users.find(u => (u.email && u.email.toLowerCase() === clean) ||
            (u.username && u.username.toLowerCase() === clean));
    }
    createUser(userData) {
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
        const newUser = {
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
            if (emp)
                emp.linkedUserId = newUser.id;
        }
        this.data.users.push(newUser);
        this.save();
        const { passwordHash: _, ...safeUser } = newUser;
        return safeUser;
    }
    updateUser(id, updates, callerId) {
        const index = this.data.users.findIndex(u => u.id === id);
        if (index === -1) {
            throw new Error(`User with ID ${id} not found.`);
        }
        const targetUser = this.data.users[index];
        // Filter out undefined keys from updates
        const sanitizedUpdates = {};
        for (const [k, v] of Object.entries(updates)) {
            if (v !== undefined) {
                sanitizedUpdates[k] = v;
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
        const updatedUser = {
            ...targetUser,
            ...sanitizedUpdates,
            id: targetUser.id, // ID cannot be changed
            isPrimarySuperAdmin: targetUser.isPrimarySuperAdmin, // Safeguard
            passwordHash: newPasswordHash,
        };
        this.data.users[index] = updatedUser;
        this.save();
        const { passwordHash: _, ...safeUser } = updatedUser;
        return safeUser;
    }
    deleteUser(id, callerId) {
        const index = this.data.users.findIndex(u => u.id === id);
        if (index === -1)
            return false;
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
    toggleUserStatus(id, status, callerId) {
        const user = this.data.users.find(u => u.id === id);
        if (!user)
            throw new Error(`User with ID ${id} not found.`);
        if (user.isPrimarySuperAdmin && status === 'Inactive') {
            throw new Error('Primary Super Admin / Owner account cannot be deactivated.');
        }
        if (callerId && user.isPrimarySuperAdmin && callerId !== user.id) {
            throw new Error('Additional administrators cannot alter the Primary Super Admin account status.');
        }
        user.status = status;
        this.save();
        const { passwordHash: _, ...safeUser } = user;
        return safeUser;
    }
    // --- Dynamic Roles & Permissions ---
    getRoles() {
        return this.data.roles;
    }
    getRoleById(id) {
        return this.data.roles.find(r => r.id === id);
    }
    getRoleByName(name) {
        const clean = name.trim().toLowerCase();
        return this.data.roles.find(r => r.name.toLowerCase() === clean);
    }
    createRole(roleData) {
        const existing = this.getRoleByName(roleData.name);
        if (existing) {
            throw new Error(`A role named "${roleData.name}" already exists.`);
        }
        const slug = roleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newId = `role-custom-${slug}-${Date.now().toString(36)}`;
        const newRole = {
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
    updateRole(id, updates) {
        const index = this.data.roles.findIndex(r => r.id === id);
        if (index === -1) {
            throw new Error(`Role with ID ${id} not found.`);
        }
        const targetRole = this.data.roles[index];
        // Prevent renaming system role
        if (targetRole.isSystem && updates.name && updates.name !== targetRole.name) {
            throw new Error(`System core role "${targetRole.name}" cannot be renamed.`);
        }
        const updatedRole = {
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
                    u.role = updates.name;
                }
            });
        }
        this.save();
        return updatedRole;
    }
    deleteRole(id) {
        const index = this.data.roles.findIndex(r => r.id === id);
        if (index === -1)
            return false;
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
    getEmployees() {
        return this.data.employees;
    }
    getEmployeeById(id) {
        return this.data.employees.find(e => e.id === id);
    }
    createEmployee(empData) {
        const numbers = this.data.employees.map(e => {
            const match = e.id.match(/^EMP-(\d+)$/i);
            return match ? parseInt(match[1], 10) : 0;
        });
        const nextNum = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
        const newId = `EMP-${String(nextNum).padStart(2, '0')}`;
        const newEmp = {
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
    updateEmployee(id, updates) {
        const index = this.data.employees.findIndex(e => e.id === id);
        if (index === -1) {
            throw new Error(`Employee with ID ${id} not found.`);
        }
        const currentEmp = this.data.employees[index];
        const sanitizedUpdates = {};
        for (const [k, v] of Object.entries(updates)) {
            if (v !== undefined) {
                sanitizedUpdates[k] = v;
            }
        }
        const updatedEmp = {
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
        }
        else if (updates.status === 'Active') {
            const linkedUser = this.data.users.find(u => u.linkedEmployeeId === id || u.id === currentEmp.linkedUserId);
            if (linkedUser) {
                linkedUser.status = 'Active';
            }
        }
        this.save();
        return updatedEmp;
    }
    // --- Order Operations ---
    getOrders() {
        return this.data.orders.filter(o => !o.isArchived);
    }
    getOrderById(id) {
        return this.data.orders.find(o => o.id === id);
    }
    generateOrderId() {
        const numbers = this.data.orders.map(o => {
            const match = o.id.match(/^ORD-(\d+)$/i);
            return match ? parseInt(match[1], 10) : 1000;
        });
        const max = numbers.length > 0 ? Math.max(...numbers) : 1000;
        return `ORD-${max + 1}`;
    }
    createOrder(orderInput, user, source = 'Dashboard') {
        const id = orderInput.id || this.generateOrderId();
        if (this.data.orders.some(o => o.id.toLowerCase() === id.toLowerCase())) {
            throw new Error(`Order ID ${id} already exists! Duplicate IDs are strictly prohibited.`);
        }
        const totalAmount = Number(orderInput.totalAmount) || 0;
        const paidAmount = Number(orderInput.paidAmount) || 0;
        const dueAmount = totalAmount - paidAmount;
        const now = new Date().toISOString();
        const dhakaNow = getDhakaNowDateTimeString();
        const newOrder = {
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
        return newOrder;
    }
    updateOrder(id, updates, user, source = 'Dashboard') {
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
        const updated = {
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
        return updated;
    }
    deleteOrder(id, user, permanent = false) {
        const idx = this.data.orders.findIndex(o => o.id === id);
        if (idx === -1)
            return false;
        if (permanent) {
            this.data.orders.splice(idx, 1);
        }
        else {
            this.data.orders[idx].isArchived = true;
        }
        this.addAuditLog({
            entityType: 'Order',
            entityId: id,
            action: 'DELETE',
            changedBy: user,
            source: 'Dashboard',
            details: permanent ? `Permanently deleted Order ${id}` : `Archived Order ${id}`,
        });
        this.save();
        return true;
    }
    // --- Expense Operations ---
    getExpenses() {
        return this.data.expenses.filter(e => !e.isArchived);
    }
    getExpenseById(id) {
        return this.data.expenses.find(e => e.id === id);
    }
    generateExpenseId() {
        const year = new Date().getFullYear();
        const prefix = `EXP-${year}-`;
        const numbers = this.data.expenses.map(e => {
            const match = e.id.match(new RegExp(`^EXP-${year}-(\\d+)$`, 'i'));
            return match ? parseInt(match[1], 10) : 1000;
        });
        const max = numbers.length > 0 ? Math.max(...numbers) : 1000;
        return `${prefix}${max + 1}`;
    }
    createExpense(expenseInput, user, source = 'Dashboard') {
        const id = expenseInput.id || this.generateExpenseId();
        if (this.data.expenses.some(e => e.id.toLowerCase() === id.toLowerCase())) {
            throw new Error(`Expense ID ${id} already exists! Duplicate IDs are strictly prohibited.`);
        }
        const amount = Number(expenseInput.amount) || 0;
        const now = new Date().toISOString();
        const dhakaNow = getDhakaNowDateTimeString();
        const newExpense = {
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
        return newExpense;
    }
    updateExpense(id, updates, user, source = 'Dashboard') {
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
        const updated = {
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
        return updated;
    }
    deleteExpense(id, user, permanent = false) {
        const idx = this.data.expenses.findIndex(e => e.id === id);
        if (idx === -1)
            return false;
        if (permanent) {
            this.data.expenses.splice(idx, 1);
        }
        else {
            this.data.expenses[idx].isArchived = true;
        }
        this.addAuditLog({
            entityType: 'Expense',
            entityId: id,
            action: 'DELETE',
            changedBy: user,
            source: 'Dashboard',
            details: permanent ? `Permanently deleted Expense ${id}` : `Archived Expense ${id}`,
        });
        this.save();
        return true;
    }
    getExpenseCategories() {
        const custom = this.data.settings?.customExpenseCategories || [];
        const usedInExpenses = this.data.expenses.map(e => e.category).filter(Boolean);
        const combined = Array.from(new Set([...INITIAL_EXPENSE_CATEGORIES, ...custom, ...usedInExpenses]));
        return combined;
    }
    addExpenseCategory(catName) {
        const trimmed = catName.trim();
        if (!trimmed)
            return this.getExpenseCategories();
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
    getPayouts() {
        return this.data.payouts.filter(p => !p.isArchived);
    }
    getPayoutById(id) {
        return this.data.payouts.find(p => p.id === id);
    }
    getPayoutsByOrderId(orderId) {
        return this.data.payouts.filter(p => p.projectOrderId.toLowerCase() === orderId.toLowerCase() && !p.isArchived);
    }
    generatePayoutId() {
        const numbers = this.data.payouts.map(p => {
            const match = p.id.match(/^PAY-PRJ-(\d+)$/i);
            return match ? parseInt(match[1], 10) : 500;
        });
        const max = numbers.length > 0 ? Math.max(...numbers) : 500;
        return `PAY-PRJ-${max + 1}`;
    }
    createPayout(payoutInput, user, source = 'Dashboard') {
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
        const newPayout = {
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
        return newPayout;
    }
    updatePayout(id, updates, user, source = 'Dashboard') {
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
        const updated = {
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
        return updated;
    }
    deletePayout(id, user, permanent = false) {
        const idx = this.data.payouts.findIndex(p => p.id === id);
        if (idx === -1)
            return false;
        if (permanent) {
            this.data.payouts.splice(idx, 1);
        }
        else {
            this.data.payouts[idx].isArchived = true;
        }
        this.addAuditLog({
            entityType: 'Payout',
            entityId: id,
            action: 'DELETE',
            changedBy: user,
            source: 'Dashboard',
            details: permanent ? `Permanently deleted Payout ${id}` : `Archived Payout ${id}`,
        });
        this.save();
        return true;
    }
    // --- Audit Logs ---
    getAuditLogs(limit = 100) {
        return this.data.auditLogs.slice(0, limit);
    }
    addAuditLog(entry) {
        const dhakaTime = entry.timestamp || new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka', hour12: false });
        const log = {
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
    getConflicts() {
        return this.data.conflicts.filter(c => c.status === 'pending');
    }
    addConflict(conflict) {
        const newConflict = {
            id: `CONF-${Date.now()}`,
            detectedAt: new Date().toISOString(),
            status: 'pending',
            ...conflict,
        };
        this.data.conflicts.push(newConflict);
        this.save();
        return newConflict;
    }
    resolveConflict(conflictId, resolution, user) {
        const idx = this.data.conflicts.findIndex(c => c.id === conflictId);
        if (idx === -1)
            return false;
        const conflict = this.data.conflicts[idx];
        if (resolution === 'keep_sheet') {
            if (conflict.entityType === 'Order') {
                const order = this.getOrderById(conflict.entityId);
                if (order) {
                    this.updateOrder(conflict.entityId, conflict.sheetData, user, 'Google Sheets');
                }
            }
            else if (conflict.entityType === 'Expense') {
                const expense = this.getExpenseById(conflict.entityId);
                if (expense) {
                    this.updateExpense(conflict.entityId, conflict.sheetData, user, 'Google Sheets');
                }
            }
            else if (conflict.entityType === 'Payout') {
                const payout = this.getPayoutById(conflict.entityId);
                if (payout) {
                    this.updatePayout(conflict.entityId, conflict.sheetData, user, 'Google Sheets');
                }
            }
        }
        conflict.status = 'resolved';
        this.save();
        return true;
    }
    // --- Settings ---
    getSettings() {
        return this.data.settings;
    }
    updateSettings(updates) {
        this.data.settings = {
            ...this.data.settings,
            ...updates,
            googleSheets: {
                ...this.data.settings.googleSheets,
                ...(updates.googleSheets || {}),
                isConfigured: Boolean((updates.googleSheets?.spreadsheetId || this.data.settings.googleSheets.spreadsheetId) &&
                    (updates.googleSheets?.serviceAccountEmail || this.data.settings.googleSheets.serviceAccountEmail))
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
    reconcileOrders(incomingOrders, source = 'Google Sheets') {
        const summary = {
            added: 0,
            updated: 0,
            removed: 0,
            unchanged: 0,
            duplicates: 0,
            invalid: 0,
            totalActive: 0,
        };
        const seenIds = new Set();
        const validIncoming = [];
        for (const raw of incomingOrders) {
            const rawId = (raw.id || '').trim();
            if (!rawId) {
                summary.invalid++;
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
            const orderRecord = {
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
                paymentStatus: raw.paymentStatus || (paid >= total && total > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'),
                deliveryStatus: raw.deliveryStatus || 'Pending',
                remarks: raw.remarks || '',
                createdAt: raw.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'Google Sheets',
                sheetRowIndex: raw.sheetRowIndex,
            };
            validIncoming.push(orderRecord);
        }
        // 1. Identify records to remove (present in CRM but absent from Google Sheets)
        const currentActive = this.data.orders.filter(o => !o.isArchived);
        const toRemove = currentActive.filter(o => !seenIds.has(o.id.toLowerCase()));
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
        }
        // 2. Build authoritative orders dataset
        const reconciledList = [];
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
            }
            else {
                const isChanged = existing.totalAmount !== incoming.totalAmount ||
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
                    const updated = {
                        ...existing,
                        ...incoming,
                        createdAt: existing.createdAt, // Preserve original timestamp
                        updatedAt: new Date().toISOString(),
                        updatedBy: 'Google Sheets Sync',
                        isArchived: false,
                    };
                    reconciledList.push(updated);
                }
                else {
                    summary.unchanged++;
                    existing.isArchived = false;
                    existing.sheetRowIndex = incoming.sheetRowIndex;
                    reconciledList.push(existing);
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
    reconcileExpenses(incomingExpenses, source = 'Google Sheets') {
        const summary = {
            added: 0,
            updated: 0,
            removed: 0,
            unchanged: 0,
            duplicates: 0,
            invalid: 0,
            totalActive: 0,
        };
        const seenIds = new Set();
        const validIncoming = [];
        for (const raw of incomingExpenses) {
            const rawId = (raw.id || '').trim();
            if (!rawId) {
                summary.invalid++;
                continue;
            }
            const lowerId = rawId.toLowerCase();
            if (seenIds.has(lowerId)) {
                summary.duplicates++;
                continue;
            }
            seenIds.add(lowerId);
            const amount = Number(raw.amount) || 0;
            const expenseRecord = {
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
                approvalStatus: raw.approvalStatus || (raw.approvedBy ? 'Approved' : 'Pending Approval'),
                remarks: raw.remarks || '',
                createdAt: raw.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'Google Sheets',
                sheetRowIndex: raw.sheetRowIndex,
            };
            validIncoming.push(expenseRecord);
        }
        // 1. Identify records to remove
        const currentActive = this.data.expenses.filter(e => !e.isArchived);
        const toRemove = currentActive.filter(e => !seenIds.has(e.id.toLowerCase()));
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
        }
        // 2. Build authoritative expenses dataset
        const reconciledList = [];
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
            }
            else {
                const isChanged = existing.amount !== incoming.amount ||
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
                    const updated = {
                        ...existing,
                        ...incoming,
                        createdAt: existing.createdAt,
                        updatedAt: new Date().toISOString(),
                        updatedBy: 'Google Sheets Sync',
                        isArchived: false,
                    };
                    reconciledList.push(updated);
                }
                else {
                    summary.unchanged++;
                    existing.isArchived = false;
                    existing.sheetRowIndex = incoming.sheetRowIndex;
                    reconciledList.push(existing);
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
    reconcilePayouts(incomingPayouts, source = 'Google Sheets') {
        const summary = {
            added: 0,
            updated: 0,
            removed: 0,
            unchanged: 0,
            duplicates: 0,
            invalid: 0,
            totalActive: 0,
        };
        const seenIds = new Set();
        const validIncoming = [];
        for (const raw of incomingPayouts) {
            const rawId = (raw.id || '').trim();
            if (!rawId) {
                summary.invalid++;
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
            const payoutRecord = {
                id: rawId,
                projectOrderId: raw.projectOrderId || '',
                serviceName: raw.serviceName || '',
                clientName: raw.clientName || '',
                resourceWorkerName: raw.resourceWorkerName || '',
                totalProjectBudget: totalBudget,
                commissionType: raw.commissionType || 'Fixed Commission',
                commissionRate: raw.commissionRate,
                agreedPayoutAmount: agreedPayout,
                advancePaid,
                dueFinalPayable,
                deliveryStatus: raw.deliveryStatus || 'Pending',
                paymentStatus: raw.paymentStatus || (advancePaid >= agreedPayout && agreedPayout > 0 ? 'Paid' : advancePaid > 0 ? 'Partial' : 'Unpaid'),
                approvalStatus: raw.approvalStatus || 'Pending Approval',
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
        // 1. Identify records to remove
        const currentActive = this.data.payouts.filter(p => !p.isArchived);
        const toRemove = currentActive.filter(p => !seenIds.has(p.id.toLowerCase()));
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
        }
        // 2. Build authoritative payouts dataset
        const reconciledList = [];
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
            }
            else {
                const isChanged = existing.totalProjectBudget !== incoming.totalProjectBudget ||
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
                    const updated = {
                        ...existing,
                        ...incoming,
                        createdAt: existing.createdAt,
                        updatedAt: new Date().toISOString(),
                        updatedBy: 'Google Sheets Sync',
                        isArchived: false,
                    };
                    reconciledList.push(updated);
                }
                else {
                    summary.unchanged++;
                    existing.isArchived = false;
                    existing.sheetRowIndex = incoming.sheetRowIndex;
                    reconciledList.push(existing);
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
    reconcileAll(data, source = 'Google Sheets') {
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
        const summary = {
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
