import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const usersRouter = Router();

// GET all users
usersRouter.get('/', requirePermission('users', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    let users: any[] = [];
    try {
      users = await postgresAuthRepo.getUsers();
    } catch (e) {
      users = store.getUsers();
    }
    if (!users || users.length === 0) {
      users = store.getUsers();
    }
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, users: store.getUsers() });
  }
});

// GET single user
usersRouter.get('/:id', requirePermission('users', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    let user: any = null;
    try {
      user = await postgresAuthRepo.getUserById(req.params.id);
    } catch (e) {
      user = store.getUserById(req.params.id);
    }
    if (!user) {
      user = store.getUserById(req.params.id);
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Create new user
usersRouter.post('/', requirePermission('users', 'create'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, username, email, password, roleId, phone, salesRepCode, workerName, linkedEmployeeId } = req.body;

    if (!email || !password || !roleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, and role are required.' 
      });
    }

    const creatorName = req.user?.name || 'Admin';
    let createdUser: any = null;

    try {
      createdUser = await postgresAuthRepo.createUser({
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
    } catch (pgErr: any) {
      console.warn('[PostgresAuth Warning] Falling back to store to create user:', pgErr?.message);
      // Fallback to store
      const role = store.getRoles().find(r => r.id === roleId) || store.getRoles()[0];
      createdUser = store.createUser({
        name: name || username || email.split('@')[0],
        username: username || email.split('@')[0],
        email,
        password,
        roleId,
        role: role.name,
        status: 'Active',
        phone,
        salesRepCode,
        workerName,
        linkedEmployeeId,
      });
    }

    res.status(201).json({
      success: true,
      message: `User ${createdUser.name} created successfully.`,
      user: createdUser,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT Update user
usersRouter.put('/:id', requirePermission('users', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, roleId, phone, salesRepCode, workerName, linkedEmployeeId, status } = req.body;

    const callerId = req.user?.id;
    let updatedUser: any = null;

    try {
      updatedUser = await postgresAuthRepo.updateUser(id, {
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

      try {
        await postgresAuthRepo.addAuditLog({
          entityType: 'User',
          entityId: updatedUser.id,
          action: 'USER_UPDATED',
          performedBy: req.user?.name || 'Admin',
          source: 'Dashboard',
          details: `Updated user profile for ${updatedUser.name} (${updatedUser.role}).`,
        });
      } catch (e) {}
    } catch (pgErr) {
      updatedUser = store.updateUser(id, {
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
    }

    res.json({
      success: true,
      message: `User ${updatedUser.name} updated successfully.`,
      user: updatedUser,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST Reset user password (Admin action)
usersRouter.post('/:id/reset-password', requirePermission('users', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const callerName = req.user?.name || 'Admin';
    let userName = id;
    try {
      const updated = await postgresAuthRepo.resetPassword(id, newPassword.trim(), callerName);
      userName = updated.name;
    } catch (pgErr) {
      const updated = store.updateUser(id, { password: newPassword.trim() });
      userName = updated.name;
      store.addAuditLog({
        entityType: 'User',
        entityId: id,
        action: 'UPDATE',
        changedBy: callerName,
        source: 'Dashboard',
        details: `Administrative password reset performed for ${userName}.`,
      });
    }

    res.json({
      success: true,
      message: `Password reset successfully for ${userName}.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH Toggle user status (Active / Inactive)
usersRouter.patch('/:id/status', requirePermission('users', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'Active' && status !== 'Inactive') {
      return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
    }

    const callerId = req.user?.id;
    const callerName = req.user?.name || 'Admin';
    let updated: any = null;

    try {
      updated = await postgresAuthRepo.toggleUserStatus(id, status, callerId, callerName);
    } catch (pgErr) {
      updated = store.toggleUserStatus(id, status, callerId);
      store.addAuditLog({
        entityType: 'User',
        entityId: id,
        action: 'STATUS_CHANGE',
        changedBy: callerName,
        source: 'Dashboard',
        details: `User status changed to ${status} for ${updated.name}.`,
      });
    }

    res.json({
      success: true,
      message: `User ${updated.name} is now ${status}.`,
      user: updated,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE User (Permanently removes from active user list while preserving business history)
usersRouter.delete('/:id', requirePermission('users', 'delete'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const callerId = req.user?.id;
    const callerName = req.user?.name || 'Admin';
    let userName = id;

    try {
      const userToDelete = await postgresAuthRepo.getUserById(id);
      if (userToDelete) userName = userToDelete.name;
      await postgresAuthRepo.deleteUser(id, callerId, callerName);
    } catch (pgErr) {
      const userToDelete = store.getUserById(id);
      if (userToDelete) userName = userToDelete.name;
      store.deleteUser(id, callerId);
      store.addAuditLog({
        entityType: 'User',
        entityId: id,
        action: 'DELETE',
        changedBy: callerName,
        source: 'Dashboard',
        details: `Permanently deleted user ${userName}. (Business orders/expenses preserved).`,
      });
    }

    res.json({
      success: true,
      message: `User ${userName} deleted successfully.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
