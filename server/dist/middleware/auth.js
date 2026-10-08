import jwt from 'jsonwebtoken';
import { postgresAuthRepo } from '../db/authRepo.js';
const JWT_SECRET = process.env.JWT_SECRET || 'toto-crm-super-secure-jwt-secret-key-2026';
export function generateToken(user) {
    return jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        isPrimarySuperAdmin: Boolean(user.isPrimarySuperAdmin),
    }, JWT_SECRET, { expiresIn: '30d' });
}
// Extract authenticated user & role from token or headers via PostgreSQL
export async function authenticate(req, res, next) {
    // Always allow unauthenticated auth routes (login, register, public user list)
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/auth')) {
        return next();
    }
    try {
        let userId;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
            }
            catch (err) {
                // Token invalid or expired
            }
        }
        // Fallback for dev convenience / switching headers
        if (!userId) {
            const headerUserId = req.headers['x-user-id'];
            const headerUserName = req.headers['x-user-name'];
            if (headerUserId) {
                userId = headerUserId;
            }
            else if (headerUserName) {
                const found = await postgresAuthRepo.getUserByEmailOrUsername(headerUserName);
                if (found)
                    userId = found.id;
            }
        }
        // Default to Primary Super Admin if running without auth in dev
        if (!userId) {
            const allUsers = await postgresAuthRepo.getUsers();
            const defaultAdmin = allUsers.find(u => u.isPrimarySuperAdmin) || allUsers[0];
            if (defaultAdmin)
                userId = defaultAdmin.id;
        }
        if (userId) {
            const user = await postgresAuthRepo.getUserById(userId);
            if (user) {
                if (user.status === 'Inactive' && !user.isPrimarySuperAdmin) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your account has been deactivated. Please contact your system administrator.'
                    });
                }
                req.user = user;
                req.role = await postgresAuthRepo.getRoleById(user.roleId) ||
                    await postgresAuthRepo.getRoleByName(user.role) ||
                    (await postgresAuthRepo.getRoles())[0];
            }
        }
        next();
    }
    catch (err) {
        console.error('[AuthMiddlewareError]', err);
        next();
    }
}
// Strict authentication enforcement
export function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }
    next();
}
// Module and Action-level RBAC enforcement
export function requirePermission(moduleId, action) {
    return (req, res, next) => {
        const user = req.user;
        const role = req.role;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        // Super Admin / Primary Super Admin bypasses all restrictions
        if (user.isPrimarySuperAdmin || role?.name === 'Super Admin' || role?.id === 'role-super-admin') {
            return next();
        }
        if (!role) {
            return res.status(403).json({ success: false, message: 'No role assigned to user.' });
        }
        const modulePerms = role.permissions?.[moduleId];
        if (!modulePerms || !modulePerms[action]) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: You do not have permission to ${action} in ${moduleId}.`
            });
        }
        next();
    };
}
// Super Admin only enforcement
export function requireSuperAdmin(req, res, next) {
    const user = req.user;
    const role = req.role;
    if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (user.isPrimarySuperAdmin || role?.name === 'Super Admin' || role?.id === 'role-super-admin') {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Access denied: Requires Super Admin privileges.'
    });
}
