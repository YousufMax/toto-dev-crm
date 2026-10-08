import { Router } from 'express';
import { postgresAuthRepo } from '../db/authRepo.js';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.js';

export const rolesRouter = Router();

// GET all roles
rolesRouter.get('/', requirePermission('roles', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const roles = await postgresAuthRepo.getRoles();
    res.json({ success: true, roles });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single role
rolesRouter.get('/:id', requirePermission('roles', 'view'), async (req: AuthenticatedRequest, res) => {
  try {
    const role = await postgresAuthRepo.getRoleById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found in PostgreSQL.' });
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

    const newRole = await postgresAuthRepo.createRole({
      name,
      description: description || '',
      recordScope: recordScope || { orders: 'all', expenses: 'all', payouts: 'all' },
      permissions,
      isSystem: false,
    });

    await postgresAuthRepo.addAuditLog({
      entityType: 'Role',
      entityId: newRole.id,
      action: 'ROLE_CREATED',
      performedBy: req.user?.name || 'Admin',
      source: 'Dashboard',
      details: `Created new custom role "${newRole.name}".`,
    });

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

    const previousRole = await postgresAuthRepo.getRoleById(id);
    if (!previousRole) {
      return res.status(404).json({ success: false, message: 'Role not found in PostgreSQL.' });
    }

    const updatedRole = await postgresAuthRepo.updateRole(id, {
      name,
      description,
      recordScope,
      permissions,
    });

    await postgresAuthRepo.addAuditLog({
      entityType: 'Role',
      entityId: updatedRole.id,
      action: 'ROLE_UPDATED',
      performedBy: req.user?.name || 'Admin',
      source: 'Dashboard',
      details: `Updated permissions and scopes for role "${updatedRole.name}".`,
    });

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
    const roleToDelete = await postgresAuthRepo.getRoleById(id);
    if (!roleToDelete) {
      return res.status(404).json({ success: false, message: 'Role not found in PostgreSQL.' });
    }

    await postgresAuthRepo.deleteRole(id);

    await postgresAuthRepo.addAuditLog({
      entityType: 'Role',
      entityId: id,
      action: 'ROLE_DELETED',
      performedBy: req.user?.name || 'Admin',
      source: 'Dashboard',
      details: `Deleted role "${roleToDelete.name}".`,
    });

    res.json({
      success: true,
      message: `Role "${roleToDelete.name}" deleted successfully.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});
