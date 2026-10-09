import { query } from './postgres.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
// --- Secure One-Way Password Hashing & Verification (Bcrypt + Legacy Scrypt Compatibility) ---
export function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}
export function verifyPassword(password, combinedHash) {
    if (!combinedHash)
        return false;
    // Bcrypt format check: $2a$, $2b$, $2y$
    if (combinedHash.startsWith('$2')) {
        try {
            return bcrypt.compareSync(password, combinedHash);
        }
        catch (e) {
            return false;
        }
    }
    // Legacy Scrypt backward compatibility (salt:derivedKey)
    if (combinedHash.includes(':')) {
        try {
            const [salt, key] = combinedHash.split(':');
            const keyBuffer = Buffer.from(key, 'hex');
            const derivedKey = crypto.scryptSync(password, salt, 64);
            return crypto.timingSafeEqual(keyBuffer, derivedKey);
        }
        catch (err) {
            return false;
        }
    }
    return false;
}
export class PostgresAuthRepository {
    initialized = false;
    async initSchema() {
        if (this.initialized)
            return;
        await query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT DEFAULT '',
        is_system BOOLEAN DEFAULT false,
        record_scope JSONB NOT NULL DEFAULT '{"orders":"all","expenses":"all","payouts":"all"}'::jsonb,
        permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        designation VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        joined_date DATE,
        base_salary NUMERIC(12, 2),
        notes TEXT,
        linked_user_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id VARCHAR(100) REFERENCES employees(id) ON DELETE SET NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role_id VARCHAR(100) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        is_primary_super_admin BOOLEAN NOT NULL DEFAULT false,
        phone VARCHAR(100),
        sales_rep_code VARCHAR(100),
        worker_name VARCHAR(150),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        password_changed_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        user_id UUID,
        performed_by VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        field_changed VARCHAR(100),
        previous_value TEXT,
        new_value TEXT,
        details TEXT,
        ip_address VARCHAR(100),
        source VARCHAR(100) DEFAULT 'Dashboard',
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        ip_address VARCHAR(100),
        user_agent TEXT
      );

      CREATE TABLE IF NOT EXISTS deleted_records (
        id VARCHAR(100) PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        deleted_by VARCHAR(255) NOT NULL,
        deleted_at TIMESTAMPTZ DEFAULT NOW(),
        source VARCHAR(100) DEFAULT 'Dashboard'
      );
      CREATE INDEX IF NOT EXISTS idx_deleted_records_type ON deleted_records(entity_type);
    `);
        this.initialized = true;
        console.log('[PostgresAuthRepository] PostgreSQL auth schema initialized and verified.');
    }
    // --- Seed / Migration from JSON Store (Only migrates once or when table is empty) ---
    async migrateInitialData(defaultRoles, defaultEmployees, defaultUsers, existingJsonUsers = []) {
        await this.initSchema();
        // 1. Migrate Roles if empty
        const rolesCountRes = await query('SELECT COUNT(*) as count FROM roles');
        if (parseInt(rolesCountRes.rows[0].count, 10) === 0) {
            console.log('[PostgresAuthRepository] Migrating roles to PostgreSQL...');
            for (const role of defaultRoles) {
                await query(`INSERT INTO roles (id, name, description, is_system, record_scope, permissions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`, [
                    role.id,
                    role.name,
                    role.description || '',
                    Boolean(role.isSystem),
                    JSON.stringify(role.recordScope),
                    JSON.stringify(role.permissions),
                ]);
            }
        }
        // 2. Migrate Employees if empty
        const empCountRes = await query('SELECT COUNT(*) as count FROM employees');
        if (parseInt(empCountRes.rows[0].count, 10) === 0) {
            console.log('[PostgresAuthRepository] Migrating employees to PostgreSQL...');
            for (const emp of defaultEmployees) {
                await query(`INSERT INTO employees (id, name, designation, department, email, phone, status, joined_date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`, [
                    emp.id,
                    emp.name,
                    emp.designation,
                    emp.department,
                    emp.email || null,
                    emp.phone || null,
                    emp.status || 'Active',
                    emp.joinedDate || null,
                ]);
            }
        }
        // 3. Migrate Users if empty
        // NOTE: Strictly avoid recreating deleted users!
        // We check if users table is completely empty (fresh setup).
        const usersCountRes = await query('SELECT COUNT(*) as count FROM users');
        if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
            console.log('[PostgresAuthRepository] Migrating initial user accounts to PostgreSQL...');
            const sourceUsers = existingJsonUsers.length > 0 ? existingJsonUsers : defaultUsers;
            for (const user of sourceUsers) {
                const username = (user.username || user.email.split('@')[0]).trim().toLowerCase();
                const email = user.email.trim().toLowerCase();
                const roleId = user.roleId || 'role-super-admin';
                const isPrimary = Boolean(user.isPrimarySuperAdmin || email === 'admin@totodev.com' || username === 'admin');
                const passwordHash = user.passwordHash || hashPassword('admin123');
                await query(`INSERT INTO users (
            employee_id, username, email, password_hash, role_id, status, 
            is_primary_super_admin, phone, sales_rep_code, worker_name, 
            created_at, updated_at, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), 'SystemMigration')
          ON CONFLICT (email) DO NOTHING`, [
                    user.linkedEmployeeId || null,
                    username,
                    email,
                    passwordHash,
                    roleId,
                    user.status || 'Active',
                    isPrimary,
                    user.phone || null,
                    user.salesRepCode || null,
                    user.workerName || null,
                ]);
            }
        }
    }
    // --- Roles ---
    async getRoles() {
        await this.initSchema();
        const res = await query('SELECT * FROM roles ORDER BY is_system DESC, name ASC');
        return res.rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description || '',
            isSystem: row.is_system,
            recordScope: row.record_scope,
            permissions: row.permissions,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        }));
    }
    async getRoleById(id) {
        await this.initSchema();
        const res = await query('SELECT * FROM roles WHERE id = $1', [id]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            isSystem: row.is_system,
            recordScope: row.record_scope,
            permissions: row.permissions,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    async getRoleByName(name) {
        await this.initSchema();
        const clean = name.trim().toLowerCase();
        const res = await query('SELECT * FROM roles WHERE LOWER(name) = $1 LIMIT 1', [clean]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            isSystem: row.is_system,
            recordScope: row.record_scope,
            permissions: row.permissions,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    async createRole(roleData) {
        await this.initSchema();
        const existing = await this.getRoleByName(roleData.name);
        if (existing) {
            throw new Error(`A role named "${roleData.name}" already exists.`);
        }
        const slug = roleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newId = `role-custom-${slug}-${Date.now().toString(36)}`;
        const res = await query(`INSERT INTO roles (id, name, description, is_system, record_scope, permissions, created_at, updated_at)
       VALUES ($1, $2, $3, false, $4, $5, NOW(), NOW())
       RETURNING *`, [
            newId,
            roleData.name.trim(),
            roleData.description || '',
            JSON.stringify(roleData.recordScope),
            JSON.stringify(roleData.permissions),
        ]);
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            isSystem: row.is_system,
            recordScope: row.record_scope,
            permissions: row.permissions,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    async updateRole(id, updates) {
        await this.initSchema();
        const current = await this.getRoleById(id);
        if (!current) {
            throw new Error(`Role with ID ${id} not found.`);
        }
        if (current.isSystem && updates.name && updates.name !== current.name) {
            throw new Error(`System core role "${current.name}" cannot be renamed.`);
        }
        const name = updates.name !== undefined ? updates.name.trim() : current.name;
        const description = updates.description !== undefined ? updates.description : current.description;
        const recordScope = updates.recordScope !== undefined ? updates.recordScope : current.recordScope;
        const permissions = updates.permissions !== undefined ? updates.permissions : current.permissions;
        const res = await query(`UPDATE roles
       SET name = $1, description = $2, record_scope = $3, permissions = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`, [
            name,
            description,
            JSON.stringify(recordScope),
            JSON.stringify(permissions),
            id,
        ]);
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            isSystem: row.is_system,
            recordScope: row.record_scope,
            permissions: row.permissions,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    async deleteRole(id) {
        await this.initSchema();
        const current = await this.getRoleById(id);
        if (!current)
            return false;
        if (current.isSystem) {
            throw new Error(`System role "${current.name}" is essential to security and cannot be deleted.`);
        }
        const assignedCountRes = await query('SELECT COUNT(*) as count FROM users WHERE role_id = $1 AND deleted_at IS NULL', [id]);
        const assignedCount = parseInt(assignedCountRes.rows[0].count, 10);
        if (assignedCount > 0) {
            throw new Error(`Cannot delete role "${current.name}" because it is currently assigned to ${assignedCount} user(s). Reassign them first.`);
        }
        await query('DELETE FROM roles WHERE id = $1', [id]);
        return true;
    }
    // --- Employees ---
    async getEmployees() {
        await this.initSchema();
        const res = await query('SELECT * FROM employees ORDER BY created_at ASC');
        return res.rows.map(row => ({
            id: row.id,
            name: row.name,
            designation: row.designation,
            department: row.department,
            email: row.email || undefined,
            phone: row.phone || undefined,
            status: row.status,
            joinedDate: row.joined_date ? new Date(row.joined_date).toISOString().slice(0, 10) : undefined,
            baseSalary: row.base_salary ? parseFloat(row.base_salary) : undefined,
            notes: row.notes || undefined,
            linkedUserId: row.linked_user_id || undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        }));
    }
    async getEmployeeById(id) {
        await this.initSchema();
        const res = await query('SELECT * FROM employees WHERE id = $1', [id]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            designation: row.designation,
            department: row.department,
            email: row.email || undefined,
            phone: row.phone || undefined,
            status: row.status,
            joinedDate: row.joined_date ? new Date(row.joined_date).toISOString().slice(0, 10) : undefined,
            baseSalary: row.base_salary ? parseFloat(row.base_salary) : undefined,
            notes: row.notes || undefined,
            linkedUserId: row.linked_user_id || undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    async createEmployee(empData) {
        await this.initSchema();
        const countRes = await query('SELECT COUNT(*) as count FROM employees');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
        const newId = `EMP-${String(nextNum).padStart(2, '0')}`;
        const res = await query(`INSERT INTO employees (
        id, name, designation, department, email, phone, status, joined_date, base_salary, notes, linked_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`, [
            newId,
            empData.name.trim(),
            empData.designation.trim(),
            empData.department.trim(),
            empData.email ? empData.email.trim() : null,
            empData.phone ? empData.phone.trim() : null,
            empData.status || 'Active',
            empData.joinedDate || null,
            empData.baseSalary || null,
            empData.notes || null,
            empData.linkedUserId || null,
        ]);
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            designation: row.designation,
            department: row.department,
            email: row.email || undefined,
            phone: row.phone || undefined,
            status: row.status,
            joinedDate: row.joined_date ? new Date(row.joined_date).toISOString().slice(0, 10) : undefined,
            baseSalary: row.base_salary ? parseFloat(row.base_salary) : undefined,
            notes: row.notes || undefined,
            linkedUserId: row.linked_user_id || undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    async updateEmployee(id, updates) {
        await this.initSchema();
        const current = await this.getEmployeeById(id);
        if (!current) {
            throw new Error(`Employee with ID ${id} not found.`);
        }
        const name = updates.name !== undefined ? updates.name.trim() : current.name;
        const designation = updates.designation !== undefined ? updates.designation.trim() : current.designation;
        const department = updates.department !== undefined ? updates.department.trim() : current.department;
        const email = updates.email !== undefined ? (updates.email ? updates.email.trim() : null) : (current.email || null);
        const phone = updates.phone !== undefined ? (updates.phone ? updates.phone.trim() : null) : (current.phone || null);
        const status = updates.status !== undefined ? updates.status : current.status;
        const joinedDate = updates.joinedDate !== undefined ? updates.joinedDate : (current.joinedDate || null);
        const baseSalary = updates.baseSalary !== undefined ? updates.baseSalary : (current.baseSalary || null);
        const notes = updates.notes !== undefined ? updates.notes : (current.notes || null);
        const linkedUserId = updates.linkedUserId !== undefined ? updates.linkedUserId : (current.linkedUserId || null);
        const res = await query(`UPDATE employees
       SET name = $1, designation = $2, department = $3, email = $4, phone = $5,
           status = $6, joined_date = $7, base_salary = $8, notes = $9, linked_user_id = $10,
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`, [
            name, designation, department, email, phone, status, joinedDate, baseSalary, notes, linkedUserId, id
        ]);
        // If employee status changed to Inactive, cascade disable linked user account (without deleting historical business data)
        if (updates.status === 'Inactive' && current.linkedUserId) {
            await query(`UPDATE users 
         SET status = 'Inactive', updated_at = NOW() 
         WHERE (id = $1 OR employee_id = $2) AND is_primary_super_admin = false`, [current.linkedUserId, id]);
        }
        else if (updates.status === 'Active' && current.linkedUserId) {
            await query(`UPDATE users 
         SET status = 'Active', updated_at = NOW() 
         WHERE (id = $1 OR employee_id = $2)`, [current.linkedUserId, id]);
        }
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            designation: row.designation,
            department: row.department,
            email: row.email || undefined,
            phone: row.phone || undefined,
            status: row.status,
            joinedDate: row.joined_date ? new Date(row.joined_date).toISOString().slice(0, 10) : undefined,
            baseSalary: row.base_salary ? parseFloat(row.base_salary) : undefined,
            notes: row.notes || undefined,
            linkedUserId: row.linked_user_id || undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
        };
    }
    // --- Users & Authentication (Permanent PostgreSQL Source of Truth) ---
    async getUsers() {
        await this.initSchema();
        const res = await query(`
      SELECT u.*, r.name as role_name, e.name as employee_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.is_primary_super_admin DESC, u.created_at ASC
    `);
        return res.rows.map(row => this.mapUserRow(row, false));
    }
    async getUserById(id) {
        await this.initSchema();
        const res = await query(`
      SELECT u.*, r.name as role_name, e.name as employee_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE (u.id::text = $1 OR u.username = $1) AND u.deleted_at IS NULL
      LIMIT 1
    `, [id]);
        if (res.rows.length === 0)
            return undefined;
        return this.mapUserRow(res.rows[0], false);
    }
    async getUserByIdWithCredentials(id) {
        await this.initSchema();
        const res = await query(`
      SELECT u.*, r.name as role_name, e.name as employee_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE (u.id::text = $1 OR u.username = $1) AND u.deleted_at IS NULL
      LIMIT 1
    `, [id]);
        if (res.rows.length === 0)
            return undefined;
        return this.mapUserRow(res.rows[0], true);
    }
    async getUserByEmailOrUsername(identifier) {
        if (!identifier)
            return undefined;
        await this.initSchema();
        const clean = identifier.trim().toLowerCase();
        const res = await query(`
      SELECT u.*, r.name as role_name, e.name as employee_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE (LOWER(u.username) = $1 OR LOWER(u.email) = $1) AND u.deleted_at IS NULL
      LIMIT 1
    `, [clean]);
        if (res.rows.length === 0)
            return undefined;
        return this.mapUserRow(res.rows[0], false);
    }
    async getUserByEmailOrUsernameWithCredentials(identifier) {
        if (!identifier)
            return undefined;
        await this.initSchema();
        const clean = identifier.trim().toLowerCase();
        const res = await query(`
      SELECT u.*, r.name as role_name, e.name as employee_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE (LOWER(u.username) = $1 OR LOWER(u.email) = $1) AND u.deleted_at IS NULL
      LIMIT 1
    `, [clean]);
        if (res.rows.length === 0)
            return undefined;
        return this.mapUserRow(res.rows[0], true);
    }
    async createUser(userData, creator = 'Admin') {
        await this.initSchema();
        const cleanUsername = (userData.username || userData.email.split('@')[0]).trim().toLowerCase();
        const cleanEmail = userData.email.trim().toLowerCase();
        // Check duplicate username (case-insensitive)
        const dupUsernameRes = await query('SELECT id FROM users WHERE LOWER(username) = $1 AND deleted_at IS NULL', [cleanUsername]);
        if (dupUsernameRes.rows.length > 0) {
            throw new Error(`Username "${cleanUsername}" is already taken. Please choose another username.`);
        }
        // Check duplicate email
        const dupEmailRes = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL', [cleanEmail]);
        if (dupEmailRes.rows.length > 0) {
            throw new Error(`Email "${cleanEmail}" is already registered. Please choose another email.`);
        }
        // Role resolution
        const role = await this.getRoleById(userData.roleId) || await this.getRoleByName(userData.role);
        const roleId = role ? role.id : 'role-employee';
        // Password validation & hashing
        const rawPassword = userData.password ? userData.password.trim() : 'TestPassword123';
        if (rawPassword.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }
        const passwordHash = hashPassword(rawPassword);
        // Transactional creation
        const res = await query(`INSERT INTO users (
        employee_id, username, email, password_hash, role_id, status,
        is_primary_super_admin, phone, sales_rep_code, worker_name,
        created_at, updated_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, NOW(), NOW(), $10)
      RETURNING *`, [
            userData.linkedEmployeeId || null,
            cleanUsername,
            cleanEmail,
            passwordHash,
            roleId,
            userData.status || 'Active',
            userData.phone || null,
            userData.salesRepCode || null,
            userData.workerName || null,
            creator,
        ]);
        const newUserRow = res.rows[0];
        // Link employee to user if applicable
        if (userData.linkedEmployeeId) {
            await query('UPDATE employees SET linked_user_id = $1, updated_at = NOW() WHERE id = $2', [newUserRow.id, userData.linkedEmployeeId]);
        }
        // Audit log
        await this.addAuditLog({
            entityType: 'User',
            entityId: newUserRow.id,
            action: 'USER_CREATED',
            performedBy: creator,
            source: 'Dashboard',
            details: `Created new user account "${cleanUsername}" (${cleanEmail}) with role ${role?.name || roleId}.`,
        });
        const user = this.mapUserRow({ ...newUserRow, role_name: role?.name }, false);
        return user;
    }
    async updateUser(id, updates, callerId) {
        await this.initSchema();
        const current = await this.getUserByIdWithCredentials(id);
        if (!current) {
            throw new Error(`User with ID ${id} not found.`);
        }
        // Primary Super Admin Protection
        if (current.isPrimarySuperAdmin) {
            if (updates.isPrimarySuperAdmin === false) {
                throw new Error('Primary Super Admin status cannot be revoked.');
            }
            if (updates.status === 'Inactive') {
                throw new Error('Primary Super Admin / Owner account cannot be deactivated.');
            }
            if (updates.roleId && updates.roleId !== 'role-super-admin') {
                throw new Error('Primary Super Admin / Owner role cannot be changed.');
            }
            if (callerId && callerId !== current.id) {
                throw new Error('Additional Super Admins cannot modify the Primary Super Admin account.');
            }
        }
        // Check unique username if updated
        let newUsername = current.username;
        if (updates.username && updates.username.trim().toLowerCase() !== current.username.toLowerCase()) {
            newUsername = updates.username.trim().toLowerCase();
            const dup = await query('SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 AND deleted_at IS NULL', [newUsername, current.id]);
            if (dup.rows.length > 0) {
                throw new Error(`Username "${newUsername}" is already taken.`);
            }
        }
        // Check unique email if updated
        let newEmail = current.email;
        if (updates.email && updates.email.trim().toLowerCase() !== current.email.toLowerCase()) {
            newEmail = updates.email.trim().toLowerCase();
            const dup = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2 AND deleted_at IS NULL', [newEmail, current.id]);
            if (dup.rows.length > 0) {
                throw new Error(`Email "${newEmail}" is already registered.`);
            }
        }
        let passwordHash = current.passwordHash;
        let passwordChangedAt = current.passwordChangedAt;
        // Handle password update
        if (updates.password && updates.password.trim().length > 0) {
            const cleanPass = updates.password.trim();
            if (cleanPass.length < 6) {
                throw new Error('Password must be at least 6 characters.');
            }
            // If user changing their own password, verify current password
            if (updates.currentPassword) {
                const isCurrentValid = verifyPassword(updates.currentPassword, current.passwordHash);
                if (!isCurrentValid) {
                    throw new Error('Current password does not match.');
                }
            }
            passwordHash = hashPassword(cleanPass);
            passwordChangedAt = new Date().toISOString();
        }
        const roleId = updates.roleId || current.roleId;
        const status = updates.status || current.status;
        const phone = updates.phone !== undefined ? updates.phone : (current.phone || null);
        const salesRepCode = updates.salesRepCode !== undefined ? updates.salesRepCode : (current.salesRepCode || null);
        const workerName = updates.workerName !== undefined ? updates.workerName : (current.workerName || null);
        const employeeId = updates.linkedEmployeeId !== undefined ? updates.linkedEmployeeId : (current.linkedEmployeeId || null);
        const lastLoginAt = updates.lastLoginAt !== undefined ? updates.lastLoginAt : (current.lastLoginAt || null);
        const res = await query(`UPDATE users
       SET username = $1, email = $2, password_hash = $3, role_id = $4, status = $5,
           phone = $6, sales_rep_code = $7, worker_name = $8, employee_id = $9,
           last_login_at = $10, password_changed_at = $11, updated_at = NOW(),
           updated_by = $12
       WHERE id = $13
       RETURNING *`, [
            newUsername, newEmail, passwordHash, roleId, status, phone,
            salesRepCode, workerName, employeeId, lastLoginAt, passwordChangedAt,
            callerId || 'Admin', current.id
        ]);
        // Update employee linked user if changed
        if (employeeId && employeeId !== current.linkedEmployeeId) {
            await query('UPDATE employees SET linked_user_id = $1 WHERE id = $2', [current.id, employeeId]);
        }
        const updatedUser = this.mapUserRow(res.rows[0], false);
        return updatedUser;
    }
    async deleteUser(id, callerId, callerName = 'Admin') {
        await this.initSchema();
        const current = await this.getUserById(id);
        if (!current)
            return false;
        // Strict Primary Super Admin protection
        if (current.isPrimarySuperAdmin) {
            throw new Error('Primary Super Admin / Owner account is permanently protected and cannot be deleted.');
        }
        if (callerId && callerId === current.id) {
            throw new Error('You cannot delete your own active administrator account.');
        }
        // Soft delete with permanent deletion from active user lists
        // deleted_at timestamp marks it permanently deleted
        await query(`UPDATE users 
       SET deleted_at = NOW(), status = 'Deleted', updated_at = NOW(), updated_by = $1 
       WHERE id = $2`, [callerName, current.id]);
        // Unlink from employee without deleting the employee or historical business data
        if (current.linkedEmployeeId) {
            await query('UPDATE employees SET linked_user_id = NULL, updated_at = NOW() WHERE id = $1', [current.linkedEmployeeId]);
        }
        // Audit log
        await this.addAuditLog({
            entityType: 'User',
            entityId: current.id,
            action: 'USER_DELETED',
            performedBy: callerName,
            source: 'Dashboard',
            details: `Permanently deleted user account "${current.username}" (${current.email}). Historical business records preserved intact.`,
        });
        return true;
    }
    async toggleUserStatus(id, status, callerId, callerName = 'Admin') {
        await this.initSchema();
        const current = await this.getUserById(id);
        if (!current)
            throw new Error(`User with ID ${id} not found.`);
        if (current.isPrimarySuperAdmin && status === 'Inactive') {
            throw new Error('Primary Super Admin / Owner account cannot be deactivated.');
        }
        if (callerId && current.isPrimarySuperAdmin && callerId !== current.id) {
            throw new Error('Additional administrators cannot alter the Primary Super Admin account status.');
        }
        const res = await query(`UPDATE users SET status = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3 RETURNING *`, [status, callerName, current.id]);
        await this.addAuditLog({
            entityType: 'User',
            entityId: current.id,
            action: status === 'Active' ? 'USER_ENABLED' : 'USER_DISABLED',
            fieldChanged: 'status',
            newValue: status,
            previousValue: current.status,
            performedBy: callerName,
            source: 'Dashboard',
            details: `User "${current.username}" account status changed to ${status}.`,
        });
        return this.mapUserRow(res.rows[0], false);
    }
    async resetPassword(id, newPassword, adminName = 'Admin') {
        await this.initSchema();
        if (!newPassword || newPassword.trim().length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }
        const current = await this.getUserById(id);
        if (!current)
            throw new Error(`User with ID ${id} not found.`);
        const newHash = hashPassword(newPassword.trim());
        const res = await query(`UPDATE users
       SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW(), updated_by = $2
       WHERE id = $3
       RETURNING *`, [newHash, adminName, current.id]);
        await this.addAuditLog({
            entityType: 'User',
            entityId: current.id,
            action: 'PASSWORD_RESET',
            fieldChanged: 'password',
            performedBy: adminName,
            source: 'Dashboard',
            details: `Administrator ${adminName} performed a password reset for user "${current.username}".`,
        });
        return this.mapUserRow(res.rows[0], false);
    }
    // --- Audit Logs (Persistent in PostgreSQL) ---
    async getAuditLogs(limit = 100) {
        await this.initSchema();
        const res = await query(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1
    `, [limit]);
        return res.rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp ? new Date(row.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Dhaka', hour12: false }) : '',
            entityType: row.entity_type,
            entityId: row.entity_id,
            action: row.action,
            fieldChanged: row.field_changed || undefined,
            previousValue: row.previous_value || undefined,
            newValue: row.new_value || undefined,
            changedBy: row.performed_by,
            source: (row.source || 'Dashboard'),
            details: row.details || '',
            ipAddress: row.ip_address || undefined,
        }));
    }
    async addAuditLog(entry) {
        await this.initSchema();
        const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await query(`INSERT INTO audit_logs (
        id, performed_by, action, entity_type, entity_id, field_changed,
        previous_value, new_value, details, ip_address, source, timestamp, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)`, [
            id,
            entry.performedBy,
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.fieldChanged || null,
            entry.previousValue || null,
            entry.newValue || null,
            entry.details || null,
            entry.ipAddress || null,
            entry.source || 'Dashboard',
            JSON.stringify(entry.metadata || {}),
        ]);
    }
    // --- Persistent Tombstone Registry (Prevents resurrection of deleted records) ---
    async addDeletedRecord(id, entityType, deletedBy, source = 'CRM') {
        try {
            await this.initSchema();
            await query(`INSERT INTO deleted_records (id, entity_type, deleted_by, deleted_at, source)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (id) DO UPDATE SET 
           deleted_by = EXCLUDED.deleted_by,
           deleted_at = NOW(),
           source = EXCLUDED.source`, [id, entityType, deletedBy, source]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresAuthRepository] Failed to add deleted record tombstone for ${id}:`, err.message);
            return false;
        }
    }
    async getDeletedRecords() {
        try {
            await this.initSchema();
            const res = await query(`SELECT id, entity_type, deleted_by, deleted_at, source FROM deleted_records ORDER BY deleted_at DESC`);
            return res.rows.map(r => ({
                id: r.id,
                entityType: r.entity_type,
                deletedBy: r.deleted_by,
                deletedAt: r.deleted_at?.toISOString?.() || r.deleted_at,
                source: r.source || 'CRM',
            }));
        }
        catch (err) {
            console.error('[PostgresAuthRepository] Failed to fetch deleted records:', err.message);
            return [];
        }
    }
    async isRecordDeleted(id) {
        try {
            await this.initSchema();
            const res = await query(`SELECT 1 FROM deleted_records WHERE LOWER(id) = LOWER($1) LIMIT 1`, [id]);
            return (res.rowCount || 0) > 0;
        }
        catch (err) {
            console.error(`[PostgresAuthRepository] Failed to check if record ${id} is deleted:`, err.message);
            return false;
        }
    }
    // Helper row mapping
    mapUserRow(row, includeHash = false) {
        const user = {
            id: row.id,
            username: row.username,
            name: row.employee_name || row.username.toUpperCase(),
            email: row.email,
            roleId: row.role_id,
            role: row.role_name || 'Employee',
            status: row.status,
            isPrimarySuperAdmin: Boolean(row.is_primary_super_admin),
            phone: row.phone || undefined,
            salesRepCode: row.sales_rep_code || undefined,
            workerName: row.worker_name || undefined,
            linkedEmployeeId: row.employee_id || undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
            lastLoginAt: row.last_login_at?.toISOString?.() || row.last_login_at || undefined,
            passwordChangedAt: row.password_changed_at?.toISOString?.() || row.password_changed_at || undefined,
            deletedAt: row.deleted_at?.toISOString?.() || row.deleted_at || undefined,
        };
        if (includeHash) {
            user.passwordHash = row.password_hash;
        }
        return user;
    }
}
export const postgresAuthRepo = new PostgresAuthRepository();
