import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Award, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  ArrowRight,
  Users,
  Plus,
  Edit3,
  Search,
  CheckCircle2,
  XCircle,
  Briefcase,
  Building,
  Mail,
  Phone,
  Shield,
  FileText,
  UserX,
  X
} from 'lucide-react';
import { api } from '../api';
import { Employee, EmployeePerformance, User } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

interface EmployeesViewProps {
  onSelectOrderById: (orderId: string) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ onSelectOrderById }) => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('employees', 'create');
  const canEdit = hasPermission('employees', 'edit');

  const [activeTab, setActiveTab] = useState<'directory' | 'performance'>('directory');

  // Employee Directory state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [searchDirectory, setSearchDirectory] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    department: 'Operations',
    email: '',
    phone: '',
    status: 'Active' as 'Active' | 'Inactive',
    baseSalary: 0,
    notes: '',
    linkedUserId: '',
  });

  // Performance Telemetry state
  const [performers, setPerformers] = useState<EmployeePerformance[]>([]);
  const [loadingPerformers, setLoadingPerformers] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<EmployeePerformance | null>(null);

  const fetchEmployeesData = async () => {
    setLoadingEmployees(true);
    try {
      const [empRes, userRes] = await Promise.all([
        api.getEmployees(),
        api.getUsers(),
      ]);
      setEmployees(empRes.employees || []);
      setUsers(userRes.users || []);
    } catch (err: any) {
      console.error('Error fetching employees directory:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchPerformanceData = async () => {
    setLoadingPerformers(true);
    try {
      const res = await api.getEmployeePerformance();
      setPerformers(res.performance || []);
      if (res.performance && res.performance.length > 0 && !selectedWorker) {
        setSelectedWorker(res.performance[0]);
      }
    } catch (err: any) {
      console.error('Error fetching employee performance:', err);
    } finally {
      setLoadingPerformers(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
    fetchPerformanceData();
  }, []);

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      designation: '',
      department: 'Operations',
      email: '',
      phone: '',
      status: 'Active',
      baseSalary: 0,
      notes: '',
      linkedUserId: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      designation: emp.designation,
      department: emp.department,
      email: emp.email || '',
      phone: emp.phone || '',
      status: emp.status,
      baseSalary: emp.baseSalary || 0,
      notes: emp.notes || '',
      linkedUserId: emp.linkedUserId || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, formData);
        setStatusMessage(`Employee "${formData.name}" updated successfully.`);
      } else {
        await api.createEmployee(formData);
        setStatusMessage(`Employee "${formData.name}" added to directory.`);
      }
      setIsModalOpen(false);
      fetchEmployeesData();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    const confirmText = newStatus === 'Inactive'
      ? `Inactivating ${emp.name} will suspend any linked login account, but all past orders, payouts, and project records will remain 100% intact. Proceed?`
      : `Reactivate ${emp.name}?`;

    if (!window.confirm(confirmText)) return;

    try {
      await api.updateEmployee(emp.id, { status: newStatus });
      setStatusMessage(`Employee ${emp.name} marked as ${newStatus}.`);
      fetchEmployeesData();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update employee status');
    }
  };

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchDirectory.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchDirectory.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(searchDirectory.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
    const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-blue-400" />
            Employee & Resource Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Decoupled company staffing directory, linked user accounts, and real-time delivery telemetry
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Selector */}
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs">
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'directory'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Staff Directory ({employees.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'performance'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Performance Telemetry</span>
            </button>
          </div>

          {activeTab === 'directory' && canCreate && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* TAB 1: EMPLOYEE DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, role, email..."
                value={searchDirectory}
                onChange={e => setSearchDirectory(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingEmployees ? (
              <div className="col-span-full py-16 text-center text-xs text-slate-500">Loading employee records...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-slate-500">No matching employees found</div>
            ) : (
              filteredEmployees.map(emp => {
                const linkedUser = users.find(u => u.linkedEmployeeId === emp.id || u.id === emp.linkedUserId);

                return (
                  <div
                    key={emp.id}
                    className={`rounded-2xl border p-4 space-y-3.5 transition-all ${
                      emp.status === 'Active'
                        ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                        : 'border-slate-800/60 bg-slate-950/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold border ${
                          emp.status === 'Active'
                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}>
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-white leading-tight">{emp.name}</h4>
                            <span className={`inline-block h-2 w-2 rounded-full ${
                              emp.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'
                            }`} />
                          </div>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">{emp.designation}</p>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit Employee"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              emp.status === 'Active'
                                ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
                                : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title={emp.status === 'Active' ? 'Mark Inactive' : 'Reactivate'}
                          >
                            {emp.status === 'Active' ? <UserX className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-400 border-t border-slate-800/60 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Building className="h-3 w-3 text-slate-500" />
                          Department:
                        </span>
                        <span className="font-semibold text-slate-200">{emp.department}</span>
                      </div>

                      {emp.email && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Mail className="h-3 w-3 text-slate-500" />
                            Email:
                          </span>
                          <span className="font-mono text-slate-300 truncate max-w-[160px]">{emp.email}</span>
                        </div>
                      )}

                      {emp.phone && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Phone className="h-3 w-3 text-slate-500" />
                            Phone:
                          </span>
                          <span className="text-slate-300">{emp.phone}</span>
                        </div>
                      )}

                      {emp.baseSalary ? (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <DollarSign className="h-3 w-3 text-emerald-400" />
                            Base Salary:
                          </span>
                          <span className="font-bold text-emerald-400">{formatCurrency(emp.baseSalary)}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Linked User Status Pill */}
                    <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">System Login Account:</span>
                      {linkedUser ? (
                        <span className={`px-2 py-0.5 rounded font-medium border flex items-center gap-1 ${
                          linkedUser.status === 'Active' && emp.status === 'Active'
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                          <Shield className="h-2.5 w-2.5" />
                          {linkedUser.username} ({linkedUser.role})
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No login account</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PERFORMANCE TELEMETRY */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workers Directory List */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">
              Active Team & Freelancers ({performers.length})
            </h3>

            {loadingPerformers ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading telemetry...</div>
            ) : performers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No project activity found</div>
            ) : (
              performers.map(worker => {
                const isSelected = selectedWorker?.workerName === worker.workerName;
                return (
                  <div
                    key={worker.workerName}
                    onClick={() => setSelectedWorker(worker)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-950/30 shadow-md' 
                        : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-blue-400 border border-slate-700">
                          {worker.workerName.slice(0, 1)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{worker.workerName}</h4>
                          <p className="text-[10px] text-slate-400">{worker.assignedProjects} Assigned Projects</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                        {worker.completionRate}%
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60 text-slate-400">
                      <span>Agreed: <strong className="text-slate-200">{formatCurrency(worker.totalAgreedPayout)}</strong></span>
                      <span>Due: <strong className="text-amber-400">{formatCurrency(worker.totalOutstanding)}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Worker Full Profile View */}
          <div className="lg:col-span-2">
            {selectedWorker ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
                {/* Profile Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black text-white shadow-xl shadow-blue-500/20">
                      {selectedWorker.workerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{selectedWorker.workerName}</h3>
                      <p className="text-xs text-slate-400">TOTO Development Resource & Project Specialist</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Overall Completion Rate</span>
                    <span className="text-2xl font-black text-emerald-400">{selectedWorker.completionRate}%</span>
                  </div>
                </div>

                {/* Performance Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Assigned</span>
                    <span className="text-lg font-bold text-white mt-1 block">{selectedWorker.assignedProjects}</span>
                    <span className="text-[10px] text-slate-400">All-time Orders</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Completed</span>
                    <span className="text-lg font-bold text-emerald-400 mt-1 block">{selectedWorker.completedProjects}</span>
                    <span className="text-[10px] text-slate-400">Client Cleared</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">In Progress</span>
                    <span className="text-lg font-bold text-blue-400 mt-1 block">{selectedWorker.inProgressProjects}</span>
                    <span className="text-[10px] text-slate-400">Active Pipeline</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Delayed</span>
                    <span className="text-lg font-bold text-amber-400 mt-1 block">{selectedWorker.delayedProjects}</span>
                    <span className="text-[10px] text-slate-400">Past Target</span>
                  </div>
                </div>

                {/* Compensation Summary */}
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    Financial & Earnings Breakdown
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Total Agreed Payout</span>
                      <span className="text-base font-bold text-white mt-0.5 block">
                        {formatCurrency(selectedWorker.totalAgreedPayout)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Advances Received</span>
                      <span className="text-base font-bold text-blue-400 mt-0.5 block">
                        {formatCurrency(selectedWorker.totalAdvanceReceived)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Outstanding Payable</span>
                      <span className="text-base font-bold text-rose-400 mt-0.5 block">
                        {formatCurrency(selectedWorker.totalOutstanding)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linked Projects */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Associated Project / Order IDs
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedWorker.recentProjects.map(orderId => (
                      <button
                        key={orderId}
                        onClick={() => onSelectOrderById(orderId)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono font-semibold text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/40 transition-colors"
                      >
                        {orderId}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-500 text-xs">
                Select an employee or freelancer from the directory to inspect their full profile.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingEmployee ? `Edit Employee: ${editingEmployee.name}` : 'Add New Employee'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Decoupled personnel directory record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Mahabub Hasan"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={e => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="e.g. Engineering, Sales, Finance"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="name@totodev.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+880 1700-000000"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Base Salary (BDT)</label>
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={e => setFormData(prev => ({ ...prev, baseSalary: Number(e.target.value) }))}
                    placeholder="e.g. 45000"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Link to System User Account</label>
                  <select
                    value={formData.linkedUserId}
                    onChange={e => setFormData(prev => ({ ...prev, linkedUserId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">None (Independent Employee / Freelancer)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username}) — {u.role}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Linking enables automatic permission mapping and access synchronization.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Special skills, contract terms, or notes..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                >
                  {editingEmployee ? 'Save Changes' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
