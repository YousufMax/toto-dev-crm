import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Search, 
  RefreshCw,
  Crown,
  Lock,
  Link as LinkIcon
} from 'lucide-react';
import { api } from '../api';
import { User, Role, Employee } from '../types';
import { useAuth } from '../context/AuthContext';

const FALLBACK_ROLES: Role[] = [
  { id: 'role-super-admin', name: 'Super Admin', description: 'Full access', isSystem: true, recordScope: { orders: 'all', expenses: 'all', payouts: 'all' }, permissions: {} as any },
  { id: 'role-coo', name: 'COO', description: 'Executive operational control', isSystem: true, recordScope: { orders: 'all', expenses: 'all', payouts: 'all' }, permissions: {} as any },
  { id: 'role-sales-manager', name: 'Sales Manager', description: 'Sales oversight', isSystem: true, recordScope: { orders: 'team', expenses: 'own', payouts: 'all' }, permissions: {} as any },
  { id: 'role-sales-officer', name: 'Sales Officer', description: 'Sales pipeline', isSystem: true, recordScope: { orders: 'assigned', expenses: 'own', payouts: 'assigned' }, permissions: {} as any },
  { id: 'role-finance-manager', name: 'Finance Manager', description: 'Finances', isSystem: true, recordScope: { orders: 'all', expenses: 'all', payouts: 'all' }, permissions: {} as any },
  { id: 'role-project-manager', name: 'Project Manager', description: 'Operations', isSystem: true, recordScope: { orders: 'all', expenses: 'own', payouts: 'all' }, permissions: {} as any },
  { id: 'role-employee', name: 'Employee', description: 'Standard Employee', isSystem: true, recordScope: { orders: 'assigned', expenses: 'own', payouts: 'assigned' }, permissions: {} as any },
  { id: 'role-viewer', name: 'Viewer', description: 'Read only', isSystem: true, recordScope: { orders: 'all', expenses: 'all', payouts: 'all' }, permissions: {} as any },
];

export const UsersView: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>(FALLBACK_ROLES);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    roleId: 'role-sales-officer',
    phone: '',
    salesRepCode: '',
    workerName: '',
    linkedEmployeeId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, eRes] = await Promise.allSettled([
        api.getUsers(),
        api.getRoles(),
        api.getEmployees(),
      ]);

      const loadedRoles = (rRes.status === 'fulfilled' && rRes.value?.roles?.length) 
        ? rRes.value.roles 
        : FALLBACK_ROLES;
      setRoles(loadedRoles);

      const loadedUsers = (uRes.status === 'fulfilled' && uRes.value?.users) 
        ? uRes.value.users 
        : [];
      setUsers(loadedUsers);

      const loadedEmployees = (eRes.status === 'fulfilled' && eRes.value?.employees) 
        ? eRes.value.employees 
        : [];
      setEmployees(loadedEmployees);

      setFormData(prev => ({
        ...prev,
        roleId: prev.roleId || loadedRoles[0]?.id || 'role-sales-officer'
      }));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activeRoles = roles.length > 0 ? roles : FALLBACK_ROLES;
      const targetRoleId = formData.roleId || activeRoles[0]?.id || 'role-sales-officer';
      const targetRole = activeRoles.find(r => r.id === targetRoleId) || activeRoles[0];

      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        roleId: targetRoleId,
        role: targetRole?.name || 'Sales Officer',
        phone: formData.phone.trim(),
        salesRepCode: formData.salesRepCode.trim(),
        workerName: formData.workerName.trim(),
        linkedEmployeeId: formData.linkedEmployeeId || undefined,
      };

      await api.createUser(payload);
      setStatusMessage(`User ${payload.name} created successfully.`);
      setIsAddOpen(false);
      setFormData({
        name: '',
        username: '',
        email: '',
        password: '',
        roleId: roles[0]?.id || 'role-sales-officer',
        phone: '',
        salesRepCode: '',
        workerName: '',
        linkedEmployeeId: '',
      });
      fetchData();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await api.updateUser(editingUser.id, editingUser);
      setStatusMessage(`User ${editingUser.name} updated successfully.`);
      setEditingUser(null);
      fetchData();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.isPrimarySuperAdmin) {
      alert('The Primary Super Admin / Owner account cannot be deactivated.');
      return;
    }
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.toggleUserStatus(user.id, newStatus);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.isPrimarySuperAdmin) {
      alert('Primary Super Admin / Owner account is permanently protected and cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user account "${user.name}" (${user.email})?`)) return;
    try {
      await api.deleteUser(user.id);
      setStatusMessage(`User ${user.name} deleted.`);
      fetchData();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;
    try {
      await api.resetPassword(resettingUser.id, newPassword);
      setStatusMessage(`Password reset successfully for ${resettingUser.name}.`);
      setResettingUser(null);
      setNewPassword('');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-blue-500" />
            Centralized User Accounts & Access
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage system logins, assign dynamic roles, enforce account status, and safeguard administrator privileges.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(prev => ({
              ...prev,
              roleId: prev.roleId || roles[0]?.id || FALLBACK_ROLES[0]?.id || 'role-sales-officer'
            }));
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
        >
          <UserPlus className="h-4 w-4" />
          Add User Account
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Primary Super Admin Safeguard Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-start gap-3">
        <Crown className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-bold text-amber-300 uppercase tracking-wider">
            Primary Super Admin Protection Active
          </p>
          <p className="text-slate-300 mt-0.5 leading-relaxed">
            The Primary Super Admin / Owner account (<strong>MD Yousuf Ali</strong>) possesses permanent ownership rights. No secondary administrator or automated rule can delete, deactivate, or demote this account.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, username or role..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Username / Contact</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Linked Employee</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No accounts found matching search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const linkedEmp = employees.find(e => e.id === u.linkedEmployeeId);
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            u.isPrimarySuperAdmin 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {u.isPrimarySuperAdmin ? '👑' : u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{u.name}</span>
                              {u.isPrimarySuperAdmin && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Owner
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300">{u.username || '—'}</div>
                        <div className="text-[11px] text-slate-500">{u.phone || 'No phone'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          u.role === 'Super Admin' 
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : u.role === 'Sales Manager' || u.role === 'Sales Officer'
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : u.role === 'Finance Manager'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {linkedEmp ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <LinkIcon className="h-3 w-3 text-blue-400" />
                            <span>{linkedEmp.name}</span>
                            <span className="text-[10px] text-slate-500">({linkedEmp.designation})</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Unlinked</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.isPrimarySuperAdmin}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                            u.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                          } ${u.isPrimarySuperAdmin ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {u.status === 'Active' ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setResettingUser(u)}
                            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Reset Password"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingUser(u)}
                            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Edit User"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.isPrimarySuperAdmin}
                            className={`p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ${
                              u.isPrimarySuperAdmin ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title={u.isPrimarySuperAdmin ? 'Primary Super Admin cannot be deleted' : 'Delete User'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-500" />
                Add New User Account
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Shakil Khan"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. shakil"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="shakil@totodev.com"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Role *</label>
                  <select
                    value={formData.roleId || (roles.length > 0 ? roles[0].id : FALLBACK_ROLES[0].id)}
                    onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    {(roles.length > 0 ? roles : FALLBACK_ROLES).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Link to Employee Record</label>
                  <select
                    value={formData.linkedEmployeeId}
                    onChange={e => setFormData({ ...formData, linkedEmployeeId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">None (Independent account)</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sales Rep Code</label>
                  <input
                    type="text"
                    value={formData.salesRepCode}
                    onChange={e => setFormData({ ...formData, salesRepCode: e.target.value })}
                    placeholder="e.g. Shakil"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                  <span className="text-[10px] text-slate-500">For filtering assigned sales orders</span>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Worker Display Name</label>
                  <input
                    type="text"
                    value={formData.workerName}
                    onChange={e => setFormData({ ...formData, workerName: e.target.value })}
                    placeholder="e.g. Shakil Khan"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                  <span className="text-[10px] text-slate-500">For filtering assigned payouts</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-blue-500" />
                Edit User: {editingUser.name}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    value={editingUser.username || ''}
                    onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Role</label>
                  <select
                    disabled={editingUser.isPrimarySuperAdmin}
                    value={editingUser.roleId}
                    onChange={e => setEditingUser({ ...editingUser, roleId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white disabled:opacity-50"
                  >
                    {(roles.length > 0 ? roles : FALLBACK_ROLES).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {editingUser.isPrimarySuperAdmin && (
                    <span className="text-[10px] text-amber-400 mt-1 block">Primary Super Admin role cannot be altered</span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Linked Employee</label>
                  <select
                    value={editingUser.linkedEmployeeId || ''}
                    onChange={e => setEditingUser({ ...editingUser, linkedEmployeeId: e.target.value || undefined })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">None (Independent)</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-500" />
                Reset Password
              </h3>
              <button onClick={() => setResettingUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Set a new secure password for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
