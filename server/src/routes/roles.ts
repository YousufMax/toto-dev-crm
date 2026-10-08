import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const rolesRouter = Router();

// GET all roles
rolesRouter.get('/', requirePermission('roles', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    let roles: any[] = [];
    try {
      roles = await postgresAuthRepo.getRoles();
    } catch (e) {
      roles = store.getRoles();
    }
    if (!roles || roles.length === 0) {
      roles = store.getRoles();
    }
    res.json({ success: true, roles });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, roles: store.getRoles() });
  }
});

// GET single role
rolesRouter.get('/:id', requirePermission('roles', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    let role: any = null;
    try {
      role = await postgresAuthRepo.getRoleById(req.params.id);
    } catch (e) {
      role = store.getRoles().find(r => r.id === req.params.id);
    }
    if (!role) {
      role = store.getRoles().find(r => r.id === req.params.id);
    }
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }
    res.json({ success: true, role });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Create custom role
rolesRouter.post('/', requirePermission('roles', 'create'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, recordScope, permissions } = req.body;

    if (!name || !permissions) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role name and permissions configuration are required.' 
      });
    }

    let newRole: any = null;
    try {
      newRole = await postgresAuthRepo.createRole({
        name,
        description: description || '',
        recordScope: recordScope || { orders: 'all', expenses: 'all', payouts: 'all' },
        permissions,
        isSystem: false,
      });

      try {
        await postgresAuthRepo.addAuditLog({
          entityType: 'Role',
          entityId: newRole.id,
          action: 'ROLE_CREATED',
          performedBy: req.user?.name || 'Admin',
          source: 'Dashboard',
          details: `Created new custom role "${newRole.name}".`,
        });
      } catch (e) {}
    } catch (pgErr) {
      newRole = store.createRole({
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
    }

    res.status(201).json({
      success: true,
      message: `Role "${newRole.name}" created successfully.`,
      role: newRole,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT Update role (permissions, description, recordScope)
rolesRouter.put('/:id', requirePermission('roles', 'edit'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description, recordScope, permissions } = req.body;

    let updatedRole: any = null;
    try {
      updatedRole = await postgresAuthRepo.updateRole(id, {
        name,
        description,
        recordScope,
        permissions,
      });

      try {
        await postgresAuthRepo.addAuditLog({
          entityType: 'Role',
          entityId: updatedRole.id,
          action: 'ROLE_UPDATED',
          performedBy: req.user?.name || 'Admin',
          source: 'Dashboard',
          details: `Updated permissions and scopes for role "${updatedRole.name}".`,
        });
      } catch (e) {}
    } catch (pgErr) {
      updatedRole = store.updateRole(id, {
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
    }

    res.json({
      success: true,
      message: `Role "${updatedRole.name}" updated successfully.`,
      role: updatedRole,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE Role
rolesRouter.delete('/:id', requirePermission('roles', 'delete'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    let deleted = false;
    let roleName = id;

    try {
      const roleToDelete = await postgresAuthRepo.getRoleById(id);
      if (roleToDelete) roleName = roleToDelete.name;
      await postgresAuthRepo.deleteRole(id);
      deleted = true;

      try {
        await postgresAuthRepo.addAuditLog({
          entityType: 'Role',
          entityId: id,
          action: 'ROLE_DELETED',
          performedBy: req.user?.name || 'Admin',
          source: 'Dashboard',
          details: `Deleted role "${roleName}".`,
        });
      } catch (e) {}
    } catch (pgErr) {
      const roleToDelete = store.getRoleById(id);
      if (roleToDelete) roleName = roleToDelete.name;
      deleted = store.deleteRole(id);
      if (deleted) {
        store.addAuditLog({
          entityType: 'Role',
          entityId: id,
          action: 'DELETE',
          changedBy: req.user?.name || 'Admin',
          source: 'Dashboard',
          details: `Deleted role "${roleName}".`,
        });
      }
    }

    res.json({
      success: true,
      message: `Role "${roleName}" deleted successfully.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
