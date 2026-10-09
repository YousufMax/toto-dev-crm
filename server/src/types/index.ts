export type ModuleId = 
  | 'dashboard'
  | 'orders'
  | 'expenses'
  | 'payouts'
  | 'employees'
  | 'reports'
  | 'users'
  | 'roles'
  | 'audit'
  | 'settings';

export type ActionType = 
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'approve'
  | 'changeStatus'
  | 'assign'
  | 'archive'
  | 'restore';

export type ModulePermissions = Record<ActionType, boolean>;

export interface Role {
  id: string; // e.g. 'role-super-admin', 'role-sales-officer'
  name: string;
  description: string;
  isSystem: boolean; // System roles cannot be deleted
  recordScope: {
    orders: 'all' | 'team' | 'assigned' | 'none';
    expenses: 'all' | 'own' | 'none';
    payouts: 'all' | 'assigned' | 'none';
  };
  permissions: Record<ModuleId, ModulePermissions>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  id: string; // e.g. 'EMP-01'
  name: string;
  designation: string; // e.g. 'Senior UI/UX Designer'
  department: string; // e.g. 'Design', 'Engineering', 'Sales'
  email?: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  joinedDate?: string;
  baseSalary?: number;
  notes?: string;
  linkedUserId?: string; // Links to a User account if they have login access
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = string; // Dynamic role name (e.g. 'Super Admin', 'COO', etc.)

export interface User {
  id: string; // e.g. 'USR-01'
  username: string; // e.g. 'admin'
  name: string;
  email: string;
  passwordHash?: string; // Hashed password (never exposed to client)
  roleId: string; // Links to Role.id
  role: UserRole; // Denormalized role name
  status: 'Active' | 'Inactive';
  isPrimarySuperAdmin?: boolean; // MD Yousuf Ali - Protected from deletion/demotion
  avatar?: string;
  phone?: string;
  salesRepCode?: string;
  workerName?: string;
  linkedEmployeeId?: string; // Links to Employee.id
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  deletedAt?: string;
}

export type OrderPaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Refunded' | 'Cancelled';
export type OrderDeliveryStatus = 
  | 'Pending' 
  | 'In Progress' 
  | 'On Hold' 
  | 'Review' 
  | 'Revision' 
  | 'Completed' 
  | 'Delivered' 
  | 'Cancelled';

export interface Order {
  id: string; // e.g. ORD-1001
  bookingDate: string; // ISO date-time or YYYY-MM-DD
  targetDeadline: string;
  clientName: string;
  clientContact: string;
  salesRep: string;
  serviceName: string;
  quantityUnit: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number; // auto-calculated: totalAmount - paidAmount
  paymentMethod: string;
  paymentStatus: OrderPaymentStatus;
  deliveryStatus: OrderDeliveryStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  source: 'Google Sheets' | 'Dashboard' | 'API';
  sheetRowIndex?: number;
  isArchived?: boolean;
}

export type ExpenseCategory = 
  | 'Employee Salary'
  | 'Employee Advance'
  | 'Project Cost'
  | 'Freelancer Payment'
  | 'Marketing & Ads'
  | 'Software / Subscription'
  | 'Hosting / Domain'
  | 'Office Expense'
  | 'Transportation'
  | 'Equipment'
  | 'Utilities'
  | 'Internet / Communication'
  | 'Bank Charges'
  | 'Refund'
  | 'Other';

export type ExpenseApprovalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Rejected';

export interface Expense {
  id: string; // e.g. EXP-2026-1001
  dateTime: string;
  category: string; // ExpenseCategory or custom
  subCategoryPurpose: string;
  vendorReceiverName: string;
  amount: number;
  paymentMethod: string;
  paidFromAccount: string;
  transactionRefId: string;
  receiptInvoiceLink: string;
  approvedBy: string;
  approvalStatus: ExpenseApprovalStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  source: 'Google Sheets' | 'Dashboard' | 'API';
  sheetRowIndex?: number;
  isArchived?: boolean;
}

export type CommissionType = 
  | 'Fixed Commission'
  | 'Percentage (%)'
  | 'Hourly'
  | 'Per Unit'
  | 'Milestone Based'
  | 'Custom';

export type PayoutApprovalStatus = 
  | 'Draft' 
  | 'Pending Approval' 
  | 'Approved' 
  | 'Advance Paid' 
  | 'Completed' 
  | 'Final Paid';

export interface Payout {
  id: string; // e.g. PAY-PRJ-501
  projectOrderId: string; // Links to Order.id (e.g. ORD-1001)
  serviceName: string;
  clientName: string;
  resourceWorkerName: string;
  totalProjectBudget: number;
  commissionType: CommissionType;
  commissionRate?: number; // percentage value if CommissionType === 'Percentage (%)'
  agreedPayoutAmount: number;
  advancePaid: number;
  dueFinalPayable: number; // auto-calculated: agreedPayoutAmount - advancePaid
  deliveryStatus: OrderDeliveryStatus;
  paymentStatus: OrderPaymentStatus;
  approvalStatus: PayoutApprovalStatus;
  paymentMethod: string;
  transactionRefId: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  source: 'Google Sheets' | 'Dashboard' | 'API';
  sheetRowIndex?: number;
  isArchived?: boolean;
}

export interface AuditLog {
  id: string;
  entityType: 'Order' | 'Expense' | 'Payout' | 'Settings' | 'User' | 'Role' | 'Employee' | 'Auth';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE' | 'SYNC' | 'APPROVAL' | 'LOGIN' | 'LOGOUT' | 'ARCHIVE' | 'RESTORE';
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  timestamp: string; // ISO in Asia/Dhaka
  source: 'Google Sheets' | 'Dashboard' | 'API';
  details?: string;
}

export interface SyncConflict {
  id: string;
  entityType: 'Order' | 'Expense' | 'Payout';
  entityId: string;
  sheetData: Record<string, any>;
  dashboardData: Record<string, any>;
  detectedAt: string;
  status: 'pending' | 'resolved';
}

export interface SyncModuleSummary {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  duplicates: number;
  invalid: number;
  totalActive: number;
}

export interface SyncSummary {
  orders: SyncModuleSummary;
  expenses: SyncModuleSummary;
  payouts: SyncModuleSummary;
  totalActiveRecords: number;
  timestamp: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
  appsScriptUrl?: string;
  deploymentId?: string;
  salesOrdersSheetName: string;
  expensesSheetName: string;
  payoutsSheetName: string;
  autoSyncIntervalMinutes: number;
  lastSyncedAt?: string;
  lastSyncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncMessage?: string;
  isConfigured: boolean;
  syncSummary?: SyncSummary;
}

export interface TelegramConfig {
  salesBot: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    lastNotifiedAt?: string;
  };
  expenseBot: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    largeExpenseThreshold: number; // e.g. 10000
    lastNotifiedAt?: string;
  };
  payoutBot: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    lastNotifiedAt?: string;
  };
}

export interface AppSettings {
  googleSheets: GoogleSheetsConfig;
  telegram: TelegramConfig;
  customExpenseCategories: string[];
  currencySymbol: string;
  timezone: string;
}

export interface TombstoneRecord {
  id: string;
  entityType: 'order' | 'expense' | 'payout';
  deletedBy: string;
  deletedAt: string;
  source: string;
}
