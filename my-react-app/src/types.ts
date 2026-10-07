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
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
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
  id: string;
  name: string;
  designation: string;
  department: string;
  email?: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  joinedDate?: string;
  baseSalary?: number;
  notes?: string;
  linkedUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = string;

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  roleId: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  isPrimarySuperAdmin?: boolean;
  phone?: string;
  avatar?: string;
  salesRepCode?: string;
  workerName?: string;
  linkedEmployeeId?: string;
  createdAt?: string;
  lastLoginAt?: string;
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
  id: string;
  bookingDate: string;
  targetDeadline: string;
  clientName: string;
  clientContact: string;
  salesRep: string;
  serviceName: string;
  quantityUnit: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  paymentStatus: OrderPaymentStatus;
  deliveryStatus: OrderDeliveryStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  source: 'Google Sheets' | 'Dashboard' | 'API';
  sheetRowIndex?: number;
}

export type ExpenseApprovalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Rejected';

export interface Expense {
  id: string;
  dateTime: string;
  category: string;
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
  id: string;
  projectOrderId: string;
  serviceName: string;
  clientName: string;
  resourceWorkerName: string;
  totalProjectBudget: number;
  commissionType: CommissionType;
  commissionRate?: number;
  agreedPayoutAmount: number;
  advancePaid: number;
  dueFinalPayable: number;
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
}

export interface AuditLog {
  id: string;
  entityType: 'Order' | 'Expense' | 'Payout' | 'Settings';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE' | 'SYNC' | 'APPROVAL';
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  timestamp: string;
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

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
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
  hasPrivateKey?: boolean;
  syncSummary?: SyncSummary;
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

export interface TelegramConfig {
  salesBot: {
    enabled: boolean;
    botTokenMasked: string;
    chatId: string;
    hasToken: boolean;
  };
  expenseBot: {
    enabled: boolean;
    botTokenMasked: string;
    chatId: string;
    largeExpenseThreshold: number;
    hasToken: boolean;
  };
  payoutBot: {
    enabled: boolean;
    botTokenMasked: string;
    chatId: string;
    hasToken: boolean;
  };
}

export interface DashboardKPIs {
  sales: {
    totalSales: number;
    totalCollection: number;
    totalOutstanding: number;
    todaySales: number;
    todayCollection: number;
    ordersCount: number;
    activeOrders: number;
    completedOrders: number;
    reviewOrders: number;
  };
  expenses: {
    totalExpenses: number;
    todayExpenseAmount: number;
    approvedExpenses: number;
    expensesCount: number;
  };
  payouts: {
    totalPayoutAgreed: number;
    totalAdvancePaid: number;
    totalDuePayable: number;
    totalPayoutCleared: number;
    payoutsCount: number;
  };
  profitability: {
    collectedRevenue: number;
    totalExpenses: number;
    totalPayouts: number;
    estimatedOperatingResult: number;
    profitMarginPercent: number;
  };
}

export interface HourlyReportItem {
  hour: string;
  label: string;
  sales: number;
  collections: number;
  expenses: number;
  payouts: number;
  ordersCount: number;
}

export interface EmployeePerformance {
  workerName: string;
  assignedProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  delayedProjects: number;
  totalBudgetHandled: number;
  totalAgreedPayout: number;
  totalAdvanceReceived: number;
  totalFinalPaid: number;
  totalOutstanding: number;
  completionRate: number;
  recentProjects: string[];
}
