import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { store } from '../db/store.js';
import { requirePermission } from '../middleware/auth.js';
export const employeesRouter = Router();
// GET all employees
employeesRouter.get('/', requirePermission('employees', 'view'), async (req, res) => {
    try {
        let employees = [];
        try {
            employees = await postgresAuthRepo.getEmployees();
        }
        catch (e) {
            employees = store.getEmployees();
        }
        if (!employees || employees.length === 0) {
            employees = store.getEmployees();
        }
        res.json({ success: true, employees });
    }
    catch (err) {
        res.json({ success: true, employees: store.getEmployees() });
    }
});
// GET single employee
employeesRouter.get('/:id', requirePermission('employees', 'view'), async (req, res) => {
    try {
        let emp = null;
        try {
            emp = await postgresAuthRepo.getEmployeeById(req.params.id);
        }
        catch (e) {
            emp = store.getEmployeeById(req.params.id);
        }
        if (!emp) {
            emp = store.getEmployeeById(req.params.id);
        }
        if (!emp) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        res.json({ success: true, employee: emp });
    }
    catch (err) {
        const emp = store.getEmployeeById(req.params.id);
        if (emp)
            return res.json({ success: true, employee: emp });
        res.status(500).json({ success: false, message: err.message });
    }
});
// POST Create employee record
employeesRouter.post('/', requirePermission('employees', 'create'), async (req, res) => {
    try {
        const { name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId } = req.body;
        if (!name || !designation || !department) {
            return res.status(400).json({
                success: false,
                message: 'Name, designation, and department are required.'
            });
        }
        let newEmp = null;
        try {
            newEmp = await postgresAuthRepo.createEmployee({
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
            try {
                await postgresAuthRepo.addAuditLog({
                    entityType: 'Employee',
                    entityId: newEmp.id,
                    action: 'EMPLOYEE_CREATED',
                    performedBy: req.user?.name || 'Admin',
                    source: 'Dashboard',
                    details: `Created employee record ${newEmp.name} (${newEmp.designation}, ${newEmp.department}).`,
                });
            }
            catch (e) { }
        }
        catch (pgErr) {
            newEmp = store.createEmployee({
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
        }
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
employeesRouter.put('/:id', requirePermission('employees', 'edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId } = req.body;
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
        let updatedEmp = null;
        try {
            updatedEmp = await postgresAuthRepo.updateEmployee(id, updates);
            try {
                await postgresAuthRepo.addAuditLog({
                    entityType: 'Employee',
                    entityId: updatedEmp.id,
                    action: 'EMPLOYEE_UPDATED',
                    performedBy: req.user?.name || 'Admin',
                    source: 'Dashboard',
                    details: `Updated employee record for ${updatedEmp.name}. Status: ${updatedEmp.status}. (Historical orders, expenses, and payouts preserved).`,
                });
            }
            catch (e) { }
        }
        catch (pgErr) {
            updatedEmp = store.updateEmployee(id, updates);
            store.addAuditLog({
                entityType: 'Employee',
                entityId: updatedEmp.id,
                action: 'UPDATE',
                changedBy: req.user?.name || 'Admin',
                source: 'Dashboard',
                details: `Updated employee record for ${updatedEmp.name}. Status: ${updatedEmp.status}. (Historical orders, expenses, and payouts preserved).`,
            });
        }
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
