import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Edit3, 
  Trash2, 
  Search, 
  Layers, 
  AlertCircle,
  Eye,
  Check,
  X,
  FileCheck
} from 'lucide-react';
import { api } from '../api';
import { Role, ModuleId, ActionType, ModulePermissions } from '../types';
import { useAuth } from '../context/AuthContext';

const MODULES_CONFIG: { id: ModuleId; label: string; desc: string }[] = [
  { id: 'dashboard', label: 'Executive Dashboard', desc: 'KPI summaries, real-time charts, high-level operational telemetry' },
  { id: 'orders', label: 'Sales & Orders', desc: 'Order bookings, payments, deliveries, client CRM records' },
  { id: 'expenses', label: 'Expenses & Costs', desc: 'Cost tracking, voucher records, operational expenses & approvals' },
  { id: 'payouts', label: 'Resource Payouts', desc: 'Worker allocations, commission milestones, payout settlements' },
  { id: 'employees', label: 'Employee Directory', desc: 'Employee profiles, salary records, department management & telemetry' },
  { id: 'reports', label: 'Reports & Analytics', desc: 'Hourly tracking, financial summaries, CSV data exports' },
  { id: 'users', label: 'User Management', desc: 'Staff login accounts, passwords, security credentials, RBAC assignment' },
  { id: 'roles', label: 'Roles & Permissions', desc: 'Custom role authoring, matrix authorization policies, scope controls' },
  { id: 'audit', label: 'Audit History', desc: 'Immutable activity tracking, modification diffs, security audits' },
  { id: 'settings', label: 'Sync & Bot Settings', desc: 'Google Sheets sync, Telegram alert bots, platform configuration' },
];

const ACTIONS_CONFIG: { id: ActionType; label: string; short: string }[] = [
  { id: 'view', label: 'View / Read', short: 'View' },
  { id: 'create', label: 'Create New', short: 'Create' },
  { id: 'edit', label: 'Edit / Update', short: 'Edit' },
  { id: 'delete', label: 'Delete Records', short: 'Delete' },
  { id: 'export', label: 'Export Data (CSV/Excel)', short: 'Export' },
  { id: 'approve', label: 'Approve / Reject', short: 'Approve' },
  { id: 'changeStatus', label: 'Change Status', short: 'Status' },
  { id: 'assign', label: 'Assign / Allocate', short: 'Assign' },
  { id: 'archive', label: 'Archive', short: 'Archive' },
  { id: 'restore', label: 'Restore Archived', short: 'Restore' },
];

const createDefaultPermissions = (): Record<ModuleId, ModulePermissions> => {
  const perms: any = {};
  MODULES_CONFIG.forEach(m => {
    perms[m.id] = {
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
    };
  });
  return perms;
};

export const RolesView: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEditRoles = hasPermission('roles', 'edit');
  const canCreateRoles = hasPermission('roles', 'create');
  const canDeleteRoles = hasPermission('roles', 'delete');

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Editing form state
  const [roleForm, setRoleForm] = useState<{
    id?: string;
    name: string;
    description: string;
    recordScope: {
      orders: 'all' | 'team' | 'assigned' | 'none';
      expenses: 'all' | 'own' | 'none';
      payouts: 'all' | 'assigned' | 'none';
    };
    permissions: Record<ModuleId, ModulePermissions>;
  }>({
    name: '',
    description: '',
    recordScope: {
      orders: 'assigned',
      expenses: 'own',
      payouts: 'assigned',
    },
    permissions: createDefaultPermissions(),
  });

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.getRoles();
      setRoles(res.roles || []);
      if (res.roles && res.roles.length > 0) {
        if (!selectedRole) {
          setSelectedRole(res.roles[0]);
        } else {
          const updated = res.roles.find(r => r.id === selectedRole.id);
          if (updated) setSelectedRole(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openCreateModal = () => {
    setIsCreating(true);
    setRoleForm({
      name: '',
      description: '',
      recordScope: {
        orders: 'assigned',
        expenses: 'own',
        payouts: 'assigned',
      },
      permissions: createDefaultPermissions(),
    });
    setIsEditorOpen(true);
  };

  const openEditModal = (role: Role) => {
    setIsCreating(false);
    // Deep clone permissions
    const permsClone: any = {};
    MODULES_CONFIG.forEach(m => {
      permsClone[m.id] = { ...(role.permissions?.[m.id] || {}) };
      ACTIONS_CONFIG.forEach(a => {
        if (permsClone[m.id][a.id] === undefined) {
          permsClone[m.id][a.id] = false;
        }
      });
    });

    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description || '',
      recordScope: {
        orders: role.recordScope?.orders || 'assigned',
        expenses: role.recordScope?.expenses || 'own',
        payouts: role.recordScope?.payouts || 'assigned',
      },
      permissions: permsClone,
    });
    setIsEditorOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isCreating) {
        const res = await api.createRole(roleForm);
        setStatusMessage(`Role "${res.role.name}" created successfully.`);
        setSelectedRole(res.role);
      } else if (roleForm.id) {
        const res = await api.updateRole(roleForm.id, roleForm);
        setStatusMessage(`Role "${res.role.name}" updated successfully.`);
        setSelectedRole(res.role);
      }
      setIsEditorOpen(false);
      fetchRoles();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save role');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      alert('System-defined default roles cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete the role "${role.name}"?`)) {
      return;
    }
    try {
      await api.deleteRole(role.id);
      setStatusMessage(`Role "${role.name}" deleted.`);
      fetchRoles();
      if (selectedRole?.id === role.id) {
        setSelectedRole(roles[0] || null);
      }
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete role');
    }
  };

  // Helper toggle permission for edit form
  const togglePermission = (mod: ModuleId, act: ActionType) => {
    setRoleForm(prev => {
      const currentVal = !!prev.permissions[mod]?.[act];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [mod]: {
            ...prev.permissions[mod],
            [act]: !currentVal,
          },
        },
      };
    });
  };

  // Quick action: Grant all or Revoke all for a module
  const toggleModuleAll = (mod: ModuleId, grant: boolean) => {
    setRoleForm(prev => {
      const updatedMod: any = {};
      ACTIONS_CONFIG.forEach(a => {
        updatedMod[a.id] = grant;
      });
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [mod]: updatedMod,
        },
      };
    });
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-400" />
            Roles & Permission Matrix
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure dynamic Role-Based Access Control (RBAC), record-level privacy scopes, and 100 granular authorization points
          </p>
        </div>

        {canCreateRoles && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Role</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Split Grid: Roles Sidebar + Detailed Matrix View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Roles List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2 space-y-1.5 max-h-[720px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading roles...</div>
            ) : filteredRoles.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No matching roles found</div>
            ) : (
              filteredRoles.map(role => {
                const isSelected = selectedRole?.id === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-indigo-500/80 bg-indigo-950/30 shadow-md' 
                        : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">{role.name}</span>
                        {role.isSystem ? (
                          <span className="flex items-center gap-1 rounded bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                            <Lock className="h-2.5 w-2.5" />
                            System
                          </span>
                        ) : (
                          <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300">
                            Custom
                          </span>
                        )}
                      </div>
                      
                      {canEditRoles && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(role)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit Role & Permissions"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          {!role.isSystem && canDeleteRoles && (
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete Role"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {role.description}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Orders Scope: <strong className="text-slate-200 capitalize">{role.recordScope?.orders || 'assigned'}</strong></span>
                      <span>Expenses: <strong className="text-slate-200 capitalize">{role.recordScope?.expenses || 'own'}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Selected Role Matrix (8 cols) */}
        <div className="lg:col-span-8">
          {selectedRole ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-6">
              {/* Role Header & Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-white">{selectedRole.name}</h3>
                    {selectedRole.isSystem ? (
                      <span className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        <Lock className="h-3 w-3" /> System Role
                      </span>
                    ) : (
                      <span className="rounded bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                        Custom Role
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{selectedRole.description}</p>
                </div>

                {canEditRoles && (
                  <button
                    onClick={() => openEditModal(selectedRole)}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all self-start sm:self-auto"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Configure Matrix</span>
                  </button>
                )}
              </div>

              {/* Record Scope Breakdown Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Orders Privacy Scope</span>
                  <p className="text-sm font-bold text-white mt-0.5 capitalize">{selectedRole.recordScope?.orders || 'assigned'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedRole.recordScope?.orders === 'all' && 'Can access all orders company-wide'}
                    {selectedRole.recordScope?.orders === 'team' && 'Can view team & direct reports'}
                    {selectedRole.recordScope?.orders === 'assigned' && 'Restricted strictly to self-assigned orders'}
                    {selectedRole.recordScope?.orders === 'none' && 'No access to orders'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Expenses Privacy Scope</span>
                  <p className="text-sm font-bold text-white mt-0.5 capitalize">{selectedRole.recordScope?.expenses || 'own'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedRole.recordScope?.expenses === 'all' && 'Full financial overview across all accounts'}
                    {selectedRole.recordScope?.expenses === 'own' && 'Can only inspect self-recorded expenses'}
                    {selectedRole.recordScope?.expenses === 'none' && 'No financial voucher access'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Payouts Privacy Scope</span>
                  <p className="text-sm font-bold text-white mt-0.5 capitalize">{selectedRole.recordScope?.payouts || 'assigned'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedRole.recordScope?.payouts === 'all' && 'All worker compensation records'}
                    {selectedRole.recordScope?.payouts === 'assigned' && 'Restricted to own payouts only'}
                    {selectedRole.recordScope?.payouts === 'none' && 'No compensation access'}
                  </p>
                </div>
              </div>

              {/* 10 Modules × 10 Actions Matrix Table (View Mode) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Active Module Permissions (10 × 10 Matrix)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Green = Authorized • Grey = Restricted
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">Module</th>
                        {ACTIONS_CONFIG.map(act => (
                          <th key={act.id} className="py-2.5 px-2 font-semibold text-center" title={act.label}>
                            {act.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {MODULES_CONFIG.map(mod => {
                        const modPerms = selectedRole.permissions?.[mod.id] || {};
                        const hasAny = ACTIONS_CONFIG.some(a => (modPerms as any)[a.id]);

                        return (
                          <tr key={mod.id} className={`hover:bg-slate-900/40 transition-colors ${!hasAny ? 'opacity-40' : ''}`}>
                            <td className="py-2.5 px-3 font-medium text-slate-200">
                              <div>{mod.label}</div>
                            </td>
                            {ACTIONS_CONFIG.map(act => {
                              const isGranted = !!(modPerms as any)[act.id];
                              return (
                                <td key={act.id} className="py-2.5 px-2 text-center">
                                  {isGranted ? (
                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" title={`${mod.label}: ${act.label} (Granted)`}>
                                      <Check className="h-3 w-3 stroke-[3]" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-slate-900/60 text-slate-600 border border-slate-800" title={`${mod.label}: ${act.label} (Denied)`}>
                                      <span className="text-[10px] leading-none">-</span>
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
              Select a role from the left list to inspect its permissions matrix.
            </div>
          )}
        </div>
      </div>

      {/* Role Editor Modal (10x10 Interactive Matrix) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isCreating ? 'Create New Custom Role' : `Edit Permissions: ${roleForm.name}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define exact authorizations and privacy visibility boundary for this role
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <form id="roleForm" onSubmit={handleSaveRole} className="overflow-y-auto pr-1 space-y-6 flex-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role Title *</label>
                  <input
                    type="text"
                    required
                    value={roleForm.name}
                    onChange={e => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Lead Designer, QA Auditor, Sales Officer"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={roleForm.description}
                    onChange={e => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of responsibilities..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Record Scope Selectors */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                  Record-Level Privacy Scopes
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Orders Scope</label>
                    <select
                      value={roleForm.recordScope.orders}
                      onChange={e => setRoleForm(prev => ({
                        ...prev,
                        recordScope: { ...prev.recordScope, orders: e.target.value as any }
                      }))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">All (Company-Wide Orders)</option>
                      <option value="team">Team (Own Team Orders)</option>
                      <option value="assigned">Assigned (Strictly Own Assigned)</option>
                      <option value="none">None (No Orders Access)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Expenses Scope</label>
                    <select
                      value={roleForm.recordScope.expenses}
                      onChange={e => setRoleForm(prev => ({
                        ...prev,
                        recordScope: { ...prev.recordScope, expenses: e.target.value as any }
                      }))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">All (All Financial Vouchers)</option>
                      <option value="own">Own (Self-Recorded Expenses Only)</option>
                      <option value="none">None (No Expense Access)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Payouts Scope</label>
                    <select
                      value={roleForm.recordScope.payouts}
                      onChange={e => setRoleForm(prev => ({
                        ...prev,
                        recordScope: { ...prev.recordScope, payouts: e.target.value as any }
                      }))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">All (All Worker Payouts)</option>
                      <option value="assigned">Assigned (Self Payouts Only)</option>
                      <option value="none">None (No Payout Access)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 10x10 Interactive Matrix */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Granular Permission Matrix (Click checkboxes to toggle)
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        MODULES_CONFIG.forEach(m => toggleModuleAll(m.id, true));
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 underline font-semibold"
                    >
                      Grant All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        MODULES_CONFIG.forEach(m => toggleModuleAll(m.id, false));
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-300 underline font-semibold"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Module</th>
                        {ACTIONS_CONFIG.map(act => (
                          <th key={act.id} className="py-2.5 px-2 font-semibold text-center min-w-[50px]">
                            {act.short}
                          </th>
                        ))}
                        <th className="py-2.5 px-2 font-semibold text-center">Row</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {MODULES_CONFIG.map(mod => {
                        const modPerms = roleForm.permissions[mod.id] || {};
                        return (
                          <tr key={mod.id} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-medium text-slate-200">
                              <span className="font-semibold">{mod.label}</span>
                            </td>
                            {ACTIONS_CONFIG.map(act => {
                              const checked = !!modPerms[act.id];
                              return (
                                <td key={act.id} className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(mod.id, act.id)}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600"
                                  />
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const allChecked = ACTIONS_CONFIG.every(a => modPerms[a.id]);
                                  toggleModuleAll(mod.id, !allChecked);
                                }}
                                className="text-[10px] text-slate-400 hover:text-indigo-400 font-medium px-1 rounded hover:bg-slate-800"
                              >
                                Toggle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="roleForm"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all"
              >
                <FileCheck className="h-4 w-4" />
                <span>Save Role Permissions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
