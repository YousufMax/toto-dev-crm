import { query } from './postgres.js';
export class PostgresBusinessRepository {
    initialized = false;
    async initSchema() {
        if (this.initialized)
            return;
        try {
            await query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(100) PRIMARY KEY,
          booking_date VARCHAR(100),
          target_deadline VARCHAR(100),
          client_name VARCHAR(255) NOT NULL,
          client_contact VARCHAR(100),
          sales_rep VARCHAR(100),
          service_name VARCHAR(255) NOT NULL,
          quantity_unit VARCHAR(100) DEFAULT '1 Unit',
          total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          payment_method VARCHAR(100) DEFAULT 'bKash',
          payment_status VARCHAR(100) DEFAULT 'Unpaid',
          delivery_status VARCHAR(100) DEFAULT 'Pending',
          remarks TEXT,
          source VARCHAR(100) DEFAULT 'Dashboard',
          is_archived BOOLEAN DEFAULT false,
          sheet_row_index INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          updated_by VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id VARCHAR(100) PRIMARY KEY,
          date_time VARCHAR(100),
          category VARCHAR(150) NOT NULL DEFAULT 'Other',
          sub_category_purpose TEXT,
          vendor_receiver_name VARCHAR(255),
          amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          payment_method VARCHAR(100) DEFAULT 'Bank Transfer',
          paid_from_account VARCHAR(150),
          transaction_ref_id VARCHAR(150),
          receipt_invoice_link TEXT,
          approved_by VARCHAR(255),
          approval_status VARCHAR(100) DEFAULT 'Pending Approval',
          remarks TEXT,
          source VARCHAR(100) DEFAULT 'Dashboard',
          is_archived BOOLEAN DEFAULT false,
          sheet_row_index INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          updated_by VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS payouts (
          id VARCHAR(100) PRIMARY KEY,
          project_order_id VARCHAR(100),
          service_name VARCHAR(255),
          client_name VARCHAR(255),
          resource_worker_name VARCHAR(255),
          total_project_budget NUMERIC(12, 2) DEFAULT 0,
          commission_type VARCHAR(100) DEFAULT 'Fixed Commission',
          commission_rate NUMERIC(8, 2),
          agreed_payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          advance_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
          due_final_payable NUMERIC(12, 2) NOT NULL DEFAULT 0,
          delivery_status VARCHAR(100) DEFAULT 'Pending',
          payment_status VARCHAR(100) DEFAULT 'Unpaid',
          approval_status VARCHAR(100) DEFAULT 'Pending Approval',
          payment_method VARCHAR(100) DEFAULT 'bKash',
          transaction_ref_id VARCHAR(150),
          remarks TEXT,
          source VARCHAR(100) DEFAULT 'Dashboard',
          is_archived BOOLEAN DEFAULT false,
          sheet_row_index INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          updated_by VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS record_sequences (
          sequence_name VARCHAR(50) PRIMARY KEY,
          current_val INTEGER NOT NULL DEFAULT 1000
        );

        CREATE INDEX IF NOT EXISTS idx_orders_client_name ON orders (client_name);
        CREATE INDEX IF NOT EXISTS idx_orders_sales_rep ON orders (sales_rep);
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);
        CREATE INDEX IF NOT EXISTS idx_payouts_project_order ON payouts (project_order_id);
      `);
            this.initialized = true;
            console.log('[PostgresBusinessRepository] PostgreSQL business schema verified.');
        }
        catch (err) {
            console.error('[PostgresBusinessRepository] Schema initialization error:', err.message);
        }
    }
    // --- Monotonic Sequence Generation ---
    async getNextSequence(sequenceName, startingNumber) {
        try {
            await this.initSchema();
            const res = await query(`INSERT INTO record_sequences (sequence_name, current_val)
         VALUES ($1, $2)
         ON CONFLICT (sequence_name)
         DO UPDATE SET current_val = GREATEST(record_sequences.current_val, EXCLUDED.current_val) + 1
         RETURNING current_val`, [sequenceName, startingNumber]);
            return parseInt(res.rows[0].current_val, 10);
        }
        catch (err) {
            console.warn(`[PostgresBusinessRepository] Could not get sequence for ${sequenceName}:`, err.message);
            return startingNumber + 1;
        }
    }
    // --- Orders ---
    async saveOrder(order) {
        try {
            await this.initSchema();
            await query(`INSERT INTO orders (
          id, booking_date, target_deadline, client_name, client_contact,
          sales_rep, service_name, quantity_unit, total_amount, paid_amount,
          due_amount, payment_method, payment_status, delivery_status, remarks,
          source, is_archived, sheet_row_index, created_at, updated_at, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (id) DO UPDATE SET
          booking_date = EXCLUDED.booking_date,
          target_deadline = EXCLUDED.target_deadline,
          client_name = EXCLUDED.client_name,
          client_contact = EXCLUDED.client_contact,
          sales_rep = EXCLUDED.sales_rep,
          service_name = EXCLUDED.service_name,
          quantity_unit = EXCLUDED.quantity_unit,
          total_amount = EXCLUDED.total_amount,
          paid_amount = EXCLUDED.paid_amount,
          due_amount = EXCLUDED.due_amount,
          payment_method = EXCLUDED.payment_method,
          payment_status = EXCLUDED.payment_status,
          delivery_status = EXCLUDED.delivery_status,
          remarks = EXCLUDED.remarks,
          source = EXCLUDED.source,
          is_archived = EXCLUDED.is_archived,
          sheet_row_index = EXCLUDED.sheet_row_index,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by`, [
                order.id,
                order.bookingDate,
                order.targetDeadline,
                order.clientName,
                order.clientContact || '',
                order.salesRep || '',
                order.serviceName,
                order.quantityUnit || '1 Unit',
                order.totalAmount || 0,
                order.paidAmount || 0,
                order.dueAmount || 0,
                order.paymentMethod || 'bKash',
                order.paymentStatus || 'Unpaid',
                order.deliveryStatus || 'Pending',
                order.remarks || '',
                order.source || 'Dashboard',
                Boolean(order.isArchived),
                order.sheetRowIndex || null,
                order.createdAt || new Date().toISOString(),
                order.updatedAt || new Date().toISOString(),
                order.updatedBy || 'System'
            ]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to save order ${order.id}:`, err.message);
            return false;
        }
    }
    async getOrders() {
        try {
            await this.initSchema();
            const res = await query(`SELECT * FROM orders WHERE is_archived = false ORDER BY created_at DESC`);
            return res.rows.map(this.mapOrderRow);
        }
        catch (err) {
            console.error('[PostgresBusinessRepository] Failed to get orders:', err.message);
            return [];
        }
    }
    async getOrderById(id) {
        try {
            await this.initSchema();
            const res = await query(`SELECT * FROM orders WHERE LOWER(id) = LOWER($1) LIMIT 1`, [id]);
            if (res.rows.length === 0)
                return undefined;
            return this.mapOrderRow(res.rows[0]);
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to get order ${id}:`, err.message);
            return undefined;
        }
    }
    async deleteOrder(id) {
        try {
            await this.initSchema();
            await query(`DELETE FROM orders WHERE LOWER(id) = LOWER($1)`, [id]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to delete order ${id}:`, err.message);
            return false;
        }
    }
    // --- Expenses ---
    async saveExpense(expense) {
        try {
            await this.initSchema();
            await query(`INSERT INTO expenses (
          id, date_time, category, sub_category_purpose, vendor_receiver_name,
          amount, payment_method, paid_from_account, transaction_ref_id, receipt_invoice_link,
          approved_by, approval_status, remarks, source, is_archived,
          sheet_row_index, created_at, updated_at, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19
        )
        ON CONFLICT (id) DO UPDATE SET
          date_time = EXCLUDED.date_time,
          category = EXCLUDED.category,
          sub_category_purpose = EXCLUDED.sub_category_purpose,
          vendor_receiver_name = EXCLUDED.vendor_receiver_name,
          amount = EXCLUDED.amount,
          payment_method = EXCLUDED.payment_method,
          paid_from_account = EXCLUDED.paid_from_account,
          transaction_ref_id = EXCLUDED.transaction_ref_id,
          receipt_invoice_link = EXCLUDED.receipt_invoice_link,
          approved_by = EXCLUDED.approved_by,
          approval_status = EXCLUDED.approval_status,
          remarks = EXCLUDED.remarks,
          source = EXCLUDED.source,
          is_archived = EXCLUDED.is_archived,
          sheet_row_index = EXCLUDED.sheet_row_index,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by`, [
                expense.id,
                expense.dateTime,
                expense.category || 'Other',
                expense.subCategoryPurpose || '',
                expense.vendorReceiverName || '',
                expense.amount || 0,
                expense.paymentMethod || 'Bank Transfer',
                expense.paidFromAccount || 'Company Account',
                expense.transactionRefId || '',
                expense.receiptInvoiceLink || '',
                expense.approvedBy || '',
                expense.approvalStatus || 'Pending Approval',
                expense.remarks || '',
                expense.source || 'Dashboard',
                Boolean(expense.isArchived),
                expense.sheetRowIndex || null,
                expense.createdAt || new Date().toISOString(),
                expense.updatedAt || new Date().toISOString(),
                expense.updatedBy || 'System'
            ]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to save expense ${expense.id}:`, err.message);
            return false;
        }
    }
    async getExpenses() {
        try {
            await this.initSchema();
            const res = await query(`SELECT * FROM expenses WHERE is_archived = false ORDER BY created_at DESC`);
            return res.rows.map(this.mapExpenseRow);
        }
        catch (err) {
            console.error('[PostgresBusinessRepository] Failed to get expenses:', err.message);
            return [];
        }
    }
    async getExpenseById(id) {
        try {
            await this.initSchema();
            const res = await query(`SELECT * FROM expenses WHERE LOWER(id) = LOWER($1) LIMIT 1`, [id]);
            if (res.rows.length === 0)
                return undefined;
            return this.mapExpenseRow(res.rows[0]);
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to get expense ${id}:`, err.message);
            return undefined;
        }
    }
    async deleteExpense(id) {
        try {
            await this.initSchema();
            await query(`DELETE FROM expenses WHERE LOWER(id) = LOWER($1)`, [id]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to delete expense ${id}:`, err.message);
            return false;
        }
    }
    // --- Payouts ---
    async savePayout(payout) {
        try {
            await this.initSchema();
            await query(`INSERT INTO payouts (
          id, project_order_id, service_name, client_name, resource_worker_name,
          total_project_budget, commission_type, commission_rate, agreed_payout_amount,
          advance_paid, due_final_payable, delivery_status, payment_status,
          approval_status, payment_method, transaction_ref_id, remarks,
          source, is_archived, sheet_row_index, created_at, updated_at, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23
        )
        ON CONFLICT (id) DO UPDATE SET
          project_order_id = EXCLUDED.project_order_id,
          service_name = EXCLUDED.service_name,
          client_name = EXCLUDED.client_name,
          resource_worker_name = EXCLUDED.resource_worker_name,
          total_project_budget = EXCLUDED.total_project_budget,
          commission_type = EXCLUDED.commission_type,
          commission_rate = EXCLUDED.commission_rate,
          agreed_payout_amount = EXCLUDED.agreed_payout_amount,
          advance_paid = EXCLUDED.advance_paid,
          due_final_payable = EXCLUDED.due_final_payable,
          delivery_status = EXCLUDED.delivery_status,
          payment_status = EXCLUDED.payment_status,
          approval_status = EXCLUDED.approval_status,
          payment_method = EXCLUDED.payment_method,
          transaction_ref_id = EXCLUDED.transaction_ref_id,
          remarks = EXCLUDED.remarks,
          source = EXCLUDED.source,
          is_archived = EXCLUDED.is_archived,
          sheet_row_index = EXCLUDED.sheet_row_index,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by`, [
                payout.id,
                payout.projectOrderId || '',
                payout.serviceName || '',
                payout.clientName || '',
                payout.resourceWorkerName || '',
                payout.totalProjectBudget || 0,
                payout.commissionType || 'Fixed Commission',
                payout.commissionRate || null,
                payout.agreedPayoutAmount || 0,
                payout.advancePaid || 0,
                payout.dueFinalPayable || 0,
                payout.deliveryStatus || 'Pending',
                payout.paymentStatus || 'Unpaid',
                payout.approvalStatus || 'Pending Approval',
                payout.paymentMethod || 'bKash',
                payout.transactionRefId || '',
                payout.remarks || '',
                payout.source || 'Dashboard',
                Boolean(payout.isArchived),
                payout.sheetRowIndex || null,
                payout.createdAt || new Date().toISOString(),
                payout.updatedAt || new Date().toISOString(),
                payout.updatedBy || 'System'
            ]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to save payout ${payout.id}:`, err.message);
            return false;
        }
    }
    async getPayouts() {
        try {
            await this.initSchema();
            const res = await query(`SELECT * FROM payouts WHERE is_archived = false ORDER BY created_at DESC`);
            return res.rows.map(this.mapPayoutRow);
        }
        catch (err) {
            console.error('[PostgresBusinessRepository] Failed to get payouts:', err.message);
            return [];
        }
    }
    async getPayoutById(id) {
        try {
            await this.initSchema();
            const res = await query(`SELECT * FROM payouts WHERE LOWER(id) = LOWER($1) LIMIT 1`, [id]);
            if (res.rows.length === 0)
                return undefined;
            return this.mapPayoutRow(res.rows[0]);
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to get payout ${id}:`, err.message);
            return undefined;
        }
    }
    async deletePayout(id) {
        try {
            await this.initSchema();
            await query(`DELETE FROM payouts WHERE LOWER(id) = LOWER($1)`, [id]);
            return true;
        }
        catch (err) {
            console.error(`[PostgresBusinessRepository] Failed to delete payout ${id}:`, err.message);
            return false;
        }
    }
    // --- Row mappers ---
    mapOrderRow(row) {
        return {
            id: row.id,
            bookingDate: row.booking_date || '',
            targetDeadline: row.target_deadline || '',
            clientName: row.client_name,
            clientContact: row.client_contact || '',
            salesRep: row.sales_rep || '',
            serviceName: row.service_name,
            quantityUnit: row.quantity_unit || '1 Unit',
            totalAmount: parseFloat(row.total_amount) || 0,
            paidAmount: parseFloat(row.paid_amount) || 0,
            dueAmount: parseFloat(row.due_amount) || 0,
            paymentMethod: row.payment_method || 'bKash',
            paymentStatus: row.payment_status || 'Unpaid',
            deliveryStatus: row.delivery_status || 'Pending',
            remarks: row.remarks || '',
            source: row.source || 'Dashboard',
            isArchived: Boolean(row.is_archived),
            sheetRowIndex: row.sheet_row_index ? parseInt(row.sheet_row_index, 10) : undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
            updatedBy: row.updated_by || undefined,
        };
    }
    mapExpenseRow(row) {
        return {
            id: row.id,
            dateTime: row.date_time || '',
            category: row.category || 'Other',
            subCategoryPurpose: row.sub_category_purpose || '',
            vendorReceiverName: row.vendor_receiver_name || '',
            amount: parseFloat(row.amount) || 0,
            paymentMethod: row.payment_method || 'Bank Transfer',
            paidFromAccount: row.paid_from_account || '',
            transactionRefId: row.transaction_ref_id || '',
            receiptInvoiceLink: row.receipt_invoice_link || '',
            approvedBy: row.approved_by || '',
            approvalStatus: row.approval_status || 'Pending Approval',
            remarks: row.remarks || '',
            source: row.source || 'Dashboard',
            isArchived: Boolean(row.is_archived),
            sheetRowIndex: row.sheet_row_index ? parseInt(row.sheet_row_index, 10) : undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
            updatedBy: row.updated_by || undefined,
        };
    }
    mapPayoutRow(row) {
        return {
            id: row.id,
            projectOrderId: row.project_order_id || '',
            serviceName: row.service_name || '',
            clientName: row.client_name || '',
            resourceWorkerName: row.resource_worker_name || '',
            totalProjectBudget: parseFloat(row.total_project_budget) || 0,
            commissionType: row.commission_type || 'Fixed Commission',
            commissionRate: row.commission_rate ? parseFloat(row.commission_rate) : undefined,
            agreedPayoutAmount: parseFloat(row.agreed_payout_amount) || 0,
            advancePaid: parseFloat(row.advance_paid) || 0,
            dueFinalPayable: parseFloat(row.due_final_payable) || 0,
            deliveryStatus: row.delivery_status || 'Pending',
            paymentStatus: row.payment_status || 'Unpaid',
            approvalStatus: row.approval_status || 'Pending Approval',
            paymentMethod: row.payment_method || 'bKash',
            transactionRefId: row.transaction_ref_id || '',
            remarks: row.remarks || '',
            source: row.source || 'Dashboard',
            isArchived: Boolean(row.is_archived),
            sheetRowIndex: row.sheet_row_index ? parseInt(row.sheet_row_index, 10) : undefined,
            createdAt: row.created_at?.toISOString?.() || row.created_at,
            updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
            updatedBy: row.updated_by || undefined,
        };
    }
}
export const postgresBusinessRepo = new PostgresBusinessRepository();
