import { Router } from 'express';
import { store } from '../db/store.js';
import { requirePermission } from '../middleware/auth.js';
export const usersRouter = Router();
// GET all users
usersRouter.get('/', requirePermission('users', 'view'), (req, res) => {
    try {
        const users = store.getUsers();
        res.json({ success: true, users });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET single user
usersRouter.get('/:id', requirePermission('users', 'view'), (req, res) => {
    const user = store.getUserById(req.params.id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
});
// POST Create new user
usersRouter.post('/', requirePermission('users', 'create'), (req, res) => {
    try {
        const { name, username, email, password, roleId, phone, salesRepCode, workerName, linkedEmployeeId } = req.body;
        if (!name || !email || !password || !roleId) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, password, and role are required.'
            });
        }
        const createdUser = store.createUser({
            name,
            username: username || email.split('@')[0],
            email,
            password,
            roleId,
            role: '', // Resolved inside store
            status: 'Active',
            phone,
            salesRepCode,
            workerName,
            linkedEmployeeId,
        });
        store.addAuditLog({
            entityType: 'User',
            entityId: createdUser.id,
            action: 'CREATE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Created new user ${createdUser.name} (${createdUser.email}) with role ${createdUser.role}.`,
        });
        res.status(201).json({
            success: true,
            message: `User ${createdUser.name} created successfully.`,
            user: createdUser,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// PUT Update user
usersRouter.put('/:id', requirePermission('users', 'edit'), (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, email, roleId, phone, salesRepCode, workerName, linkedEmployeeId, status } = req.body;
        const callerId = req.user?.id;
        const previous = store.getUserById(id);
        if (!previous) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const updatedUser = store.updateUser(id, {
            name,
            username,
            email,
            roleId,
            phone,
            salesRepCode,
            workerName,
            linkedEmployeeId,
            status,
        }, callerId);
        store.addAuditLog({
            entityType: 'User',
            entityId: updatedUser.id,
            action: 'UPDATE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Updated user profile for ${updatedUser.name} (${updatedUser.role}).`,
        });
        res.json({
            success: true,
            message: `User ${updatedUser.name} updated successfully.`,
            user: updatedUser,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// POST Reset user password
usersRouter.post('/:id/reset-password', requirePermission('users', 'edit'), (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword || newPassword.trim().length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }
        const callerId = req.user?.id;
        const updated = store.updateUser(id, { password: newPassword.trim() }, callerId);
        store.addAuditLog({
            entityType: 'User',
            entityId: updated.id,
            action: 'UPDATE',
            fieldChanged: 'password',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Password reset for user ${updated.name}.`,
        });
        res.json({
            success: true,
            message: `Password reset successfully for ${updated.name}.`,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// PATCH Toggle user status (Active / Inactive)
usersRouter.patch('/:id/status', requirePermission('users', 'edit'), (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (status !== 'Active' && status !== 'Inactive') {
            return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
        }
        const callerId = req.user?.id;
        const updated = store.toggleUserStatus(id, status, callerId);
        store.addAuditLog({
            entityType: 'User',
            entityId: updated.id,
            action: 'STATUS_CHANGE',
            fieldChanged: 'status',
            newValue: status,
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `User ${updated.name} status changed to ${status}.`,
        });
        res.json({
            success: true,
            message: `User ${updated.name} is now ${status}.`,
            user: updated,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// DELETE User (Strictly prevents deleting Primary Super Admin)
usersRouter.delete('/:id', requirePermission('users', 'delete'), (req, res) => {
    try {
        const { id } = req.params;
        const callerId = req.user?.id;
        const userToDelete = store.getUserById(id);
        if (!userToDelete) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        store.deleteUser(id, callerId);
        store.addAuditLog({
            entityType: 'User',
            entityId: id,
            action: 'DELETE',
            changedBy: req.user?.name || 'Admin',
            source: 'Dashboard',
            details: `Deleted user ${userToDelete.name} (${userToDelete.email}).`,
        });
        res.json({
            success: true,
            message: `User ${userToDelete.name} deleted successfully.`,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
