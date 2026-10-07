import { Router } from 'express';
import { store, verifyPassword } from '../db/store.js';
import { generateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// GET all users (safe profile info without passwords)
authRouter.get('/users', (req, res) => {
  res.json({ success: true, users: store.getUsers() });
});

// POST Centralized User Login (Email/Username + Password)
authRouter.post('/login', (req, res) => {
  const usernameOrEmail = req.body.usernameOrEmail || req.body.identifier || req.body.email;
  const { password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide both username/email and password.' 
    });
  }

  const user = store.getUserByEmailOrUsername(usernameOrEmail);
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid email/username or password.' 
    });
  }

  // Check account active status
  if (user.status === 'Inactive' && !user.isPrimarySuperAdmin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Your account is deactivated. Please contact your system administrator.' 
    });
  }

  // Retrieve user with password hash for verification
  const fullUser = store.getUserByIdWithCredentials(user.id);
  const isValid = verifyPassword(password, fullUser?.passwordHash);

  if (!isValid) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid email/username or password.' 
    });
  }

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  store.updateUser(user.id, { lastLoginAt: user.lastLoginAt });

  // Record audit log
  store.addAuditLog({
    entityType: 'Auth',
    entityId: user.id,
    action: 'LOGIN',
    changedBy: user.name,
    source: 'Dashboard',
    details: `User ${user.name} (${user.role}) logged in successfully.`,
  });

  const role = store.getRoleById(user.roleId) || store.getRoleByName(user.role);
  const token = generateToken(user);

  res.json({
    success: true,
    user,
    role,
    token,
    message: `Welcome back, ${user.name}!`,
  });
});

// GET Get Current Authenticated User Profile & Active Permissions
authRouter.get('/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const role = req.role || store.getRoleById(req.user.roleId) || store.getRoleByName(req.user.role);
  res.json({
    success: true,
    user: req.user,
    role,
  });
});

// POST Mock login / switch active user session (quick testing)
authRouter.post('/switch-user', (req, res) => {
  const { userId } = req.body;
  const user = store.getUserById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const role = store.getRoleById(user.roleId) || store.getRoleByName(user.role);
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
authRouter.post('/logout', (req: AuthenticatedRequest, res) => {
  if (req.user) {
    store.addAuditLog({
      entityType: 'Auth',
      entityId: req.user.id,
      action: 'LOGOUT',
      changedBy: req.user.name,
      source: 'Dashboard',
      details: `User ${req.user.name} logged out.`,
    });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});
