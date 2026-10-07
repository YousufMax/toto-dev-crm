import { Router } from 'express';
import { store } from '../db/store.js';
import { requirePermission } from '../middleware/auth.js';
export const rolesRouter = Router();
// GET all roles
rolesRouter.get('/', requirePermission('roles', 'view'), (req, res) => {
    try {
        const roles = store.getRoles();
        res.json({ success: true, roles });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET single role
rolesRouter.get('/:id', requirePermission('roles', 'view'), (req, res) => {
    const role = store.getRoleById(req.params.id);
    if (!role) {
        return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.json({ success: true, role });
});
// POST Create custom role
rolesRouter.post('/', requirePermission('roles', 'create'), (req, res) => {
    try {
        const { name, description, recordScope, permissions } = req.body;
        if (!name || !permissions) {
            return res.status(400).json({
                success: false,
                message: 'Role name and permissions configuration are required.'
            });
        }
        const newRole = store.createRole({
            name,
            description: description || '',
            recordScope: recordScope || { orders: 'all', expenses: 'all', payouts: 'all' },
            permissions,
            isSystem: false,
        });
        store.addAuditLog({
            entityType: 'Role',
            entityId: newRole.id,
            action: 'CREATE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Created new custom role "${newRole.name}".`,
        });
        res.status(201).json({
            success: true,
            message: `Role "${newRole.name}" created successfully.`,
            role: newRole,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// PUT Update role (permissions, description, recordScope)
rolesRouter.put('/:id', requirePermission('roles', 'edit'), (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, recordScope, permissions } = req.body;
        const previousRole = store.getRoleById(id);
        if (!previousRole) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }
        const updatedRole = store.updateRole(id, {
            name,
            description,
            recordScope,
            permissions,
        });
        store.addAuditLog({
            entityType: 'Role',
            entityId: updatedRole.id,
            action: 'UPDATE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Updated permissions and scopes for role "${updatedRole.name}".`,
        });
        res.json({
            success: true,
            message: `Role "${updatedRole.name}" updated successfully.`,
            role: updatedRole,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// DELETE Custom role (Strictly rejects system roles or roles with assigned users)
rolesRouter.delete('/:id', requirePermission('roles', 'delete'), (req, res) => {
    try {
        const { id } = req.params;
        const roleToDelete = store.getRoleById(id);
        if (!roleToDelete) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }
        store.deleteRole(id);
        store.addAuditLog({
            entityType: 'Role',
            entityId: id,
            action: 'DELETE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Deleted custom role "${roleToDelete.name}".`,
        });
        res.json({
            success: true,
            message: `Role "${roleToDelete.name}" deleted successfully.`,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
