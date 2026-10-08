import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const employeesRouter = Router();

// GET all employees
employeesRouter.get('/', requirePermission('employees', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const employees = await postgresAuthRepo.getEmployees();
    res.json({ success: true, employees });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single employee
employeesRouter.get('/:id', requirePermission('employees', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const emp = await postgresAuthRepo.getEmployeeById(req.params.id);
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found in PostgreSQL.' });
    }
    res.json({ success: true, employee: emp });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Create employee record
employeesRouter.post('/', requirePermission('employees', 'create'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId } = req.body;

    if (!name || !designation || !department) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, designation, and department are required.' 
      });
    }

    const newEmp = await postgresAuthRepo.createEmployee({
      name,
      designation,
      department,
      email,
      phone,
      status: status || 'Active',
      joinedDate: joinedDate || new Date().toISOString().slice(0, 10),
      baseSalary: baseSalary ? Number(baseSalary) : undefined,
      notes,
      linkedUserId,
    });

    await postgresAuthRepo.addAuditLog({
      entityType: 'Employee',
      entityId: newEmp.id,
      action: 'EMPLOYEE_CREATED',
      performedBy: req.user?.name || 'Admin',
      source: 'Dashboard',
      details: `Created employee record ${newEmp.name} (${newEmp.designation}, ${newEmp.department}).`,
    });

    res.status(201).json({
      success: true,
      message: `Employee ${newEmp.name} created successfully.`,
      employee: newEmp,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT Update employee record
employeesRouter.put('/:id', requirePermission('employees', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId } = req.body;

    const previousEmp = await postgresAuthRepo.getEmployeeById(id);
    if (!previousEmp) {
      return res.status(404).json({ success: false, message: 'Employee not found in PostgreSQL.' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (designation !== undefined) updates.designation = designation;
    if (department !== undefined) updates.department = department;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.status = status;
    if (joinedDate !== undefined) updates.joinedDate = joinedDate;
    if (baseSalary !== undefined) updates.baseSalary = Number(baseSalary);
    if (notes !== undefined) updates.notes = notes;
    if (linkedUserId !== undefined) updates.linkedUserId = linkedUserId;

    const updatedEmp = await postgresAuthRepo.updateEmployee(id, updates);

    await postgresAuthRepo.addAuditLog({
      entityType: 'Employee',
      entityId: updatedEmp.id,
      action: 'EMPLOYEE_UPDATED',
      performedBy: req.user?.name || 'Admin',
      source: 'Dashboard',
      details: `Updated employee record for ${updatedEmp.name}. Status: ${updatedEmp.status}. (Historical orders, expenses, and payouts preserved).`,
    });

    res.json({
      success: true,
      message: `Employee ${updatedEmp.name} updated successfully.`,
      employee: updatedEmp,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
