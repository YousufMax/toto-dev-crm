import { Router } from 'express';
import { store } from '../db/store.js';
import { requirePermission } from '../middleware/auth.js';
export const employeesRouter = Router();
// GET all employees
employeesRouter.get('/', requirePermission('employees', 'view'), (req, res) => {
    try {
        const employees = store.getEmployees();
        res.json({ success: true, employees });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET single employee
employeesRouter.get('/:id', requirePermission('employees', 'view'), (req, res) => {
    const emp = store.getEmployeeById(req.params.id);
    if (!emp) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, employee: emp });
});
// POST Create employee record
employeesRouter.post('/', requirePermission('employees', 'create'), (req, res) => {
    try {
        const { name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId } = req.body;
        if (!name || !designation || !department) {
            return res.status(400).json({
                success: false,
                message: 'Name, designation, and department are required.'
            });
        }
        const newEmp = store.createEmployee({
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
        store.addAuditLog({
            entityType: 'Employee',
            entityId: newEmp.id,
            action: 'CREATE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Created employee record ${newEmp.name} (${newEmp.designation}, ${newEmp.department}).`,
        });
        res.status(201).json({
            success: true,
            message: `Employee ${newEmp.name} created successfully.`,
            employee: newEmp,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// PUT Update employee record
employeesRouter.put('/:id', requirePermission('employees', 'edit'), (req, res) => {
    try {
        const { id } = req.params;
        const { name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId } = req.body;
        const previousEmp = store.getEmployeeById(id);
        if (!previousEmp) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (designation !== undefined)
            updates.designation = designation;
        if (department !== undefined)
            updates.department = department;
        if (email !== undefined)
            updates.email = email;
        if (phone !== undefined)
            updates.phone = phone;
        if (status !== undefined)
            updates.status = status;
        if (joinedDate !== undefined)
            updates.joinedDate = joinedDate;
        if (baseSalary !== undefined)
            updates.baseSalary = Number(baseSalary);
        if (notes !== undefined)
            updates.notes = notes;
        if (linkedUserId !== undefined)
            updates.linkedUserId = linkedUserId;
        const updatedEmp = store.updateEmployee(id, updates);
        store.addAuditLog({
            entityType: 'Employee',
            entityId: updatedEmp.id,
            action: 'UPDATE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Updated employee record for ${updatedEmp.name}. Status: ${updatedEmp.status}. (Historical orders and payouts preserved).`,
        });
        res.json({
            success: true,
            message: `Employee ${updatedEmp.name} updated successfully.`,
            employee: updatedEmp,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
