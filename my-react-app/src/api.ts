import { 
  Order, 
  Expense, 
  Payout, 
  AuditLog, 
  DashboardKPIs, 
  GoogleSheetsConfig, 
  TelegramConfig, 
  User, 
  Role,
  Employee,
  HourlyReportItem, 
  EmployeePerformance 
} from './types';

let currentUserName = 'MD Yousuf Ali';
let currentUserRole = 'Super Admin';
let currentToken = localStorage.getItem('toto_crm_token') || '';

export function setActiveUser(user: User) {
  currentUserName = user.name;
  currentUserRole = user.role;
}

export function setAuthToken(token: string) {
  currentToken = token;
  if (token) {
    localStorage.setItem('toto_crm_token', token);
  } else {
    localStorage.removeItem('toto_crm_token');
  }
}

export function getAuthToken(): string {
  return currentToken;
}

export function getActiveUser() {
  return { name: currentUserName, role: currentUserRole };
}

const API_BASE = import.meta.env.VITE_API_URL 
  || (typeof window !== 'undefined' ? localStorage.getItem('toto_crm_backend_url') : '') 
  || '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-name': currentUserName,
    'x-user-role': currentUserRole,
    ...(options.headers as Record<string, string> || {}),
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (usernameOrEmail: string, password: string) => 
    request<{ success: boolean; user: User; role: Role; token: string; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password }),
    }),
  getMe: () => request<{ success: boolean; user: User; role: Role }>('/api/auth/me'),
  logout: () => request<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (passwords: { currentPassword: string; newPassword: string; confirmPassword?: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords),
    }),
  switchUser: (userId: string) => request<{ user: User; role: Role; token: string }>('/api/auth/switch-user', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }),

  // User Management
  getUsers: () => request<{ users: User[] }>('/api/users'),
  getUserById: (id: string) => request<{ user: User }>(`/api/users/${id}`),
  createUser: (userData: Partial<User> & { password?: string }) => 
    request<{ success: boolean; user: User; message: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  updateUser: (id: string, updates: Partial<User> & { password?: string }) => 
    request<{ success: boolean; user: User; message: string }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  deleteUser: (id: string) => request<{ success: boolean; message: string }>(`/api/users/${id}`, {
    method: 'DELETE',
  }),
  toggleUserStatus: (id: string, status: 'Active' | 'Inactive') => 
    request<{ success: boolean; user: User; message: string }>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  resetPassword: (id: string, newPassword: string) => 
    request<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  // Roles & Permissions
  getRoles: () => request<{ roles: Role[] }>('/api/roles'),
  getRoleById: (id: string) => request<{ role: Role }>(`/api/roles/${id}`),
  createRole: (roleData: Partial<Role>) => 
    request<{ success: boolean; role: Role; message: string }>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(roleData),
    }),
  updateRole: (id: string, updates: Partial<Role>) => 
    request<{ success: boolean; role: Role; message: string }>(`/api/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  deleteRole: (id: string) => request<{ success: boolean; message: string }>(`/api/roles/${id}`, {
    method: 'DELETE',
  }),

  // Employees Directory
  getEmployees: () => request<{ employees: Employee[] }>('/api/employees'),
  getEmployeeById: (id: string) => request<{ employee: Employee }>(`/api/employees/${id}`),
  createEmployee: (empData: Partial<Employee>) => 
    request<{ success: boolean; employee: Employee; message: string }>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(empData),
    }),
  updateEmployee: (id: string, updates: Partial<Employee>) => 
    request<{ success: boolean; employee: Employee; message: string }>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Orders
  getOrders: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ orders: Order[]; count: number }>(`/api/orders?${qs}`);
  },
  getOrderById: (id: string) => request<{ 
    order: Order; 
    linkedPayouts: Payout[]; 
    auditLogs: AuditLog[]; 
    relationship: any; 
  }>(`/api/orders/${id}`),
  createOrder: (order: Partial<Order>) => request<{ order: Order; message: string }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),
  updateOrder: (id: string, updates: Partial<Order>) => request<{ order: Order; message: string }>(`/api/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
  deleteOrder: (id: string, permanent = false) => request<{ message: string }>(`/api/orders/${id}?permanent=${permanent}`, {
    method: 'DELETE',
  }),
  bulkUpdateOrders: (ids: string[], deliveryStatus?: string, paymentStatus?: string) => request<{ message: string }>('/api/orders/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, deliveryStatus, paymentStatus }),
  }),

  // Expenses
  getExpenses: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ expenses: Expense[]; count: number }>(`/api/expenses?${qs}`);
  },
  getExpenseById: (id: string) => request<{ expense: Expense; auditLogs: AuditLog[] }>(`/api/expenses/${id}`),
  createExpense: (expense: Partial<Expense>) => request<{ expense: Expense; message: string }>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  }),
  updateExpense: (id: string, updates: Partial<Expense>) => request<{ expense: Expense; message: string }>(`/api/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
  approveExpense: (id: string, status?: string) => request<{ expense: Expense; message: string }>(`/api/expenses/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ status: status || 'Approved' }),
  }),
  deleteExpense: (id: string, permanent = false) => request<{ message: string }>(`/api/expenses/${id}?permanent=${permanent}`, {
    method: 'DELETE',
  }),
  getCategories: () => request<{ categories: string[] }>('/api/expenses/categories'),
  addCategory: (categoryName: string) => request<{ categories: string[]; message: string }>('/api/expenses/categories', {
    method: 'POST',
    body: JSON.stringify({ categoryName }),
  }),

  // Payouts
  getPayouts: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ payouts: Payout[]; count: number }>(`/api/payouts?${qs}`);
  },
  getPayoutById: (id: string) => request<{ payout: Payout; parentOrder?: Order; auditLogs: AuditLog[] }>(`/api/payouts/${id}`),
  createPayout: (payout: Partial<Payout>) => request<{ payout: Payout; message: string }>('/api/payouts', {
    method: 'POST',
    body: JSON.stringify(payout),
  }),
  updatePayout: (id: string, updates: Partial<Payout>) => request<{ payout: Payout; message: string }>(`/api/payouts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
  payPayout: async (id: string, payment: { type: 'advance' | 'final'; amount: number; paymentMethod: string; transactionRefId?: string }) => {
    const res = await request<{ payout: Payout }>(`/api/payouts/${id}`);
    const current = res.payout;
    const newAdvance = payment.type === 'advance' 
      ? ((current.advancePaid || 0) + payment.amount)
      : (current.agreedPayoutAmount || payment.amount);
    const paymentStatus = newAdvance >= current.agreedPayoutAmount ? 'Paid' : 'Partial';
    const approvalStatus = payment.type === 'final' ? 'Final Paid' : 'Advance Paid';

    return request<{ payout: Payout; message: string }>(`/api/payouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        advancePaid: newAdvance,
        paymentStatus,
        approvalStatus,
        paymentMethod: payment.paymentMethod,
        transactionRefId: payment.transactionRefId || current.transactionRefId,
      }),
    });
  },
  deletePayout: (id: string, permanent = false) => request<{ message: string }>(`/api/payouts/${id}?permanent=${permanent}`, {
    method: 'DELETE',
  }),

  // Reports
  getKPIs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ kpis: DashboardKPIs }>(`/api/reports/kpis?${qs}`);
  },
  getHourlyReport: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return request<{ date: string; hourlyData: HourlyReportItem[]; summary: any }>(`/api/reports/hourly${qs}`);
  },
  getDailyReport: (days = 14) => request<{ dailyData: any[] }>(`/api/reports/daily?days=${days}`),
  getMonthlyReport: (year?: number) => {
    const qs = year ? `?year=${year}` : '';
    return request<{ year: number; monthlyData: any[] }>(`/api/reports/monthly${qs}`);
  },
  getEmployeePerformance: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ performance: EmployeePerformance[]; count: number }>(`/api/reports/employees?${qs}`);
  },
  getBreakdowns: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ categoryBreakdown: any[]; repBreakdown: any[]; paymentMethodBreakdown: any[] }>(`/api/reports/breakdowns?${qs}`);
  },

  // Global Search
  searchGlobal: (q: string) => request<{ 
    results: {
      orders: Order[];
      expenses: Expense[];
      payouts: Payout[];
      clients: string[];
      employees: string[];
    }
  }>(`/api/search?q=${encodeURIComponent(q)}`),

  // Google Sheets Sync
  getSyncStatus: () => request<{ 
    config: GoogleSheetsConfig; 
    pendingConflictsCount: number; 
    conflicts: any[] 
  }>('/api/sync/status'),
  syncNow: () => request<{ 
    success: boolean; 
    ordersSynced: number; 
    expensesSynced: number; 
    payoutsSynced: number; 
    message: string 
  }>('/api/sync/now', { method: 'POST' }),
  saveSyncConfig: (config: any) => request<{ message: string; config: any }>('/api/sync/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  initSheetHeaders: () => request<{ success: boolean; message: string }>('/api/sync/init-headers', {
    method: 'POST',
  }),
  resolveConflict: (conflictId: string, resolution: 'keep_sheet' | 'keep_dashboard') => 
    request<{ message: string }>('/api/sync/resolve-conflict', {
      method: 'POST',
      body: JSON.stringify({ conflictId, resolution }),
    }),

  // Telegram
  getTelegramConfig: () => request<{ config: TelegramConfig }>('/api/telegram/config'),
  saveTelegramConfig: (config: any) => request<{ message: string }>('/api/telegram/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  sendTelegramTest: (botType: 'sales' | 'expense' | 'payout') => 
    request<{ success: boolean; message: string }>('/api/telegram/test', {
      method: 'POST',
      body: JSON.stringify({ botType }),
    }),

  // Audit Logs
  getAuditLogs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ logs: AuditLog[]; count: number }>(`/api/audit?${qs}`);
  },
};
