import { Router } from 'express';
import { postgresAuthRepo, verifyPassword } from '../db/authRepo.js';
import { store } from '../db/store.js';
import { generateToken } from '../middleware/auth.js';
export const authRouter = Router();
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute temporary cooldown
function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
}
// GET all users (safe profile info without password hashes)
authRouter.get('/users', async (req, res) => {
    try {
        const users = await postgresAuthRepo.getUsers();
        res.json({ success: true, users });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// POST Centralized User Login (Email/Username + Password)
// PostgreSQL is the single authoritative source of truth
authRouter.post('/login', async (req, res) => {
    try {
        const usernameOrEmail = req.body.usernameOrEmail || req.body.identifier || req.body.email;
        const { password } = req.body;
        const ip = getClientIp(req);
        if (!usernameOrEmail || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both username/email and password.'
            });
        }
        const cleanIdentifier = String(usernameOrEmail).trim().toLowerCase();
        const rateLimitKey = `${ip}:${cleanIdentifier}`;
        const attemptRecord = loginAttempts.get(rateLimitKey);
        const now = Date.now();
        if (attemptRecord?.lockoutUntil && attemptRecord.lockoutUntil > now) {
            const waitSec = Math.ceil((attemptRecord.lockoutUntil - now) / 1000);
            return res.status(429).json({
                success: false,
                message: `Too many failed login attempts. Please wait ${waitSec} seconds before trying again.`,
            });
        }
        // 1. Fetch user from PostgreSQL (with safe fallback to store if database is offline or uninitialized)
        let user = null;
        try {
            user = await postgresAuthRepo.getUserByEmailOrUsernameWithCredentials(cleanIdentifier);
        }
        catch (pgErr) {
            console.warn('[PostgresAuth Warning] Falling back to local store for auth:', pgErr);
            user = store.getUserByEmailOrUsername(cleanIdentifier);
            if (user) {
                user = store.getUserByIdWithCredentials(user.id);
            }
        }
        if (!user) {
            // Try local store as secondary verification if user was just seeded
            user = store.getUserByEmailOrUsername(cleanIdentifier);
            if (user) {
                user = store.getUserByIdWithCredentials(user.id);
            }
        }
        if (!user) {
            // Record failed attempt
            const attempts = (attemptRecord?.attempts || 0) + 1;
            if (attempts >= MAX_ATTEMPTS) {
                loginAttempts.set(rateLimitKey, { attempts: 0, lockoutUntil: now + LOCKOUT_DURATION_MS });
            }
            else {
                loginAttempts.set(rateLimitKey, { attempts });
            }
            try {
                await postgresAuthRepo.addAuditLog({
                    entityType: 'Auth',
                    entityId: cleanIdentifier,
                    action: 'LOGIN_FAILED',
                    performedBy: cleanIdentifier,
                    source: 'LoginAPI',
                    ipAddress: ip,
                    details: `Failed login attempt for non-existent identifier "${cleanIdentifier}".`,
                });
            }
            catch (e) {
                // Ignore audit log error
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid email/username or password.'
            });
        }
        // 2. Enforce Account Status: only Active accounts can log in
        if (user.status !== 'Active' && !user.isPrimarySuperAdmin) {
            await postgresAuthRepo.addAuditLog({
                entityType: 'Auth',
                entityId: user.id,
                action: 'LOGIN_REJECTED_DISABLED',
                performedBy: user.username,
                source: 'LoginAPI',
                ipAddress: ip,
                details: `Login rejected for ${user.status.toLowerCase()} account "${user.username}".`,
            });
            return res.status(403).json({
                success: false,
                message: `Your account is currently ${user.status.toLowerCase()}. Please contact your system administrator.`
            });
        }
        // 3. Verify Password Hash (Bcrypt / Argon2)
        const isValid = verifyPassword(password, user.passwordHash);
        if (!isValid) {
            const attempts = (attemptRecord?.attempts || 0) + 1;
            if (attempts >= MAX_ATTEMPTS) {
                loginAttempts.set(rateLimitKey, { attempts: 0, lockoutUntil: now + LOCKOUT_DURATION_MS });
            }
            else {
                loginAttempts.set(rateLimitKey, { attempts });
            }
            try {
                await postgresAuthRepo.addAuditLog({
                    entityType: 'Auth',
                    entityId: user.id,
                    action: 'LOGIN_FAILED',
                    performedBy: user.username,
                    source: 'LoginAPI',
                    ipAddress: ip,
                    details: `Invalid password entered for user "${user.username}".`,
                });
            }
            catch (e) {
                // Ignore audit log error
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid email/username or password.'
            });
        }
        // Reset attempt counter on success
        loginAttempts.delete(rateLimitKey);
        // 4. Update last_login_at in PostgreSQL
        const lastLoginAt = new Date().toISOString();
        try {
            await postgresAuthRepo.updateUser(user.id, { lastLoginAt });
        }
        catch (e) {
            // Ignore background timestamp update error if DB connection interrupted
        }
        // 5. Audit Log in PostgreSQL
        try {
            await postgresAuthRepo.addAuditLog({
                entityType: 'Auth',
                entityId: user.id,
                action: 'LOGIN_SUCCESS',
                performedBy: user.name,
                source: 'Dashboard',
                ipAddress: ip,
                details: `User ${user.name} (@${user.username}) logged in successfully with role ${user.role}.`,
            });
        }
        catch (e) {
            // Ignore audit log error if DB connection interrupted
        }
        let role = null;
        try {
            role = await postgresAuthRepo.getRoleById(user.roleId) || await postgresAuthRepo.getRoleByName(user.role);
        }
        catch (e) {
            // Fallback to store role
            role = store.getRoles().find(r => r.id === user.roleId || r.name === user.role) || store.getRoles()[0];
        }
        if (!role) {
            role = store.getRoles().find(r => r.id === user.roleId || r.name === user.role) || store.getRoles()[0];
        }
        const token = generateToken(user);
        // Remove sensitive password hash
        const { passwordHash: _, ...safeUser } = user;
        res.json({
            success: true,
            user: safeUser,
            role,
            token,
            message: `Welcome back, ${user.name}!`,
        });
    }
    catch (err) {
        console.error('[AuthLoginError]', err);
        res.status(500).json({ success: false, message: err.message || 'Login failed.' });
    }
});
// GET Get Current Authenticated User Profile & Active Permissions
authRouter.get('/me', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    try {
        const role = req.role || await postgresAuthRepo.getRoleById(req.user.roleId) || await postgresAuthRepo.getRoleByName(req.user.role);
        res.json({
            success: true,
            user: req.user,
            role,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// POST Change Own Password (Self-service)
authRouter.post('/change-password', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'New password and confirm password do not match.' });
    }
    if (newPassword.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    try {
        await postgresAuthRepo.updateUser(req.user.id, { currentPassword, password: newPassword.trim() }, req.user.id);
        await postgresAuthRepo.addAuditLog({
            entityType: 'User',
            entityId: req.user.id,
            action: 'PASSWORD_CHANGED',
            fieldChanged: 'password',
            performedBy: req.user.name,
            source: 'Dashboard',
            ipAddress: getClientIp(req),
            details: `User ${req.user.name} changed their password.`,
        });
        res.json({ success: true, message: 'Password updated successfully.' });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});
// POST Mock login / switch active user session (convenience testing)
authRouter.post('/switch-user', async (req, res) => {
    const { userId } = req.body;
    const user = await postgresAuthRepo.getUserById(userId);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found in PostgreSQL.' });
    }
    const role = await postgresAuthRepo.getRoleById(user.roleId) || await postgresAuthRepo.getRoleByName(user.role);
    const token = generateToken(user);
    res.json({
        success: true,
        user,
        role,
        token,
        message: `Logged in as ${user.name} (${user.role})`,
    });
});
// POST Logout
authRouter.post('/logout', async (req, res) => {
    if (req.user) {
        await postgresAuthRepo.addAuditLog({
            entityType: 'Auth',
            entityId: req.user.id,
            action: 'LOGOUT',
            performedBy: req.user.name,
            source: 'Dashboard',
            ipAddress: getClientIp(req),
            details: `User ${req.user.name} logged out.`,
        });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
});
