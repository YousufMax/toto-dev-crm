import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { requirePermission } from '../middleware/auth.js';
export const usersRouter = Router();
// GET all users
usersRouter.get('/', requirePermission('users', 'view'), async (req, res) => {
    try {
        const users = await postgresAuthRepo.getUsers();
        res.json({ success: true, users });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET single user
usersRouter.get('/:id', requirePermission('users', 'view'), async (req, res) => {
    try {
        const user = await postgresAuthRepo.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found in PostgreSQL.' });
        }
        res.json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// POST Create new user
usersRouter.post('/', requirePermission('users', 'create'), async (req, res) => {
    try {
        const { name, username, email, password, roleId, phone, salesRepCode, workerName, linkedEmployeeId } = req.body;
        if (!email || !password || !roleId) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and role are required.'
            });
        }
        const creatorName = req.user?.name || 'Admin';
        const createdUser = await postgresAuthRepo.createUser({
            name: name || username || email.split('@')[0],
            username: username || email.split('@')[0],
            email,
            password,
            roleId,
            role: '',
            status: 'Active',
            phone,
            salesRepCode,
            workerName,
            linkedEmployeeId,
        }, creatorName);
        res.status(201).json({
            success: true,
            message: `User ${createdUser.name} created successfully in PostgreSQL.`,
            user: createdUser,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// PUT Update user
usersRouter.put('/:id', requirePermission('users', 'edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, email, roleId, phone, salesRepCode, workerName, linkedEmployeeId, status } = req.body;
        const callerId = req.user?.id;
        const previous = await postgresAuthRepo.getUserById(id);
        if (!previous) {
            return res.status(404).json({ success: false, message: 'User not found in PostgreSQL.' });
        }
        const updatedUser = await postgresAuthRepo.updateUser(id, {
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
        await postgresAuthRepo.addAuditLog({
            entityType: 'User',
            entityId: updatedUser.id,
            action: 'USER_UPDATED',
            performedBy: req.user?.name || 'Admin',
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
// POST Reset user password (Admin action)
usersRouter.post('/:id/reset-password', requirePermission('users', 'edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword || newPassword.trim().length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }
        const callerName = req.user?.name || 'Admin';
        const updated = await postgresAuthRepo.resetPassword(id, newPassword.trim(), callerName);
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
usersRouter.patch('/:id/status', requirePermission('users', 'edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (status !== 'Active' && status !== 'Inactive') {
            return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
        }
        const callerId = req.user?.id;
        const callerName = req.user?.name || 'Admin';
        const updated = await postgresAuthRepo.toggleUserStatus(id, status, callerId, callerName);
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
// DELETE User (Permanently removes from active user list while preserving business history)
usersRouter.delete('/:id', requirePermission('users', 'delete'), async (req, res) => {
    try {
        const { id } = req.params;
        const callerId = req.user?.id;
        const callerName = req.user?.name || 'Admin';
        const userToDelete = await postgresAuthRepo.getUserById(id);
        if (!userToDelete) {
            return res.status(404).json({ success: false, message: 'User not found in PostgreSQL.' });
        }
        await postgresAuthRepo.deleteUser(id, callerId, callerName);
        res.json({
            success: true,
            message: `User ${userToDelete.name} deleted successfully.`,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
