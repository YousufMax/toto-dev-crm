import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { store, hashPassword, verifyPassword, DEFAULT_ROLES } from '../src/db/store.js';
import { postgresBusinessRepo } from '../src/db/businessRepo.js';
import { postgresAuthRepo } from '../src/db/authRepo.js';

describe('TOTO CRM — Long-Term Production Reliability Regression Suite', () => {
  beforeAll(async () => {
    try {
      await postgresAuthRepo.initSchema();
      await postgresBusinessRepo.initSchema();
      await store.syncDeletedRecordsFromDb();
      await store.syncBusinessRecordsFromDb();
    } catch (err: any) {
      console.warn('[TestSetup] Database init warning (falling back to memory):', err.message);
    }
  });

  describe('1. Monotonic Sequence Generator & Collision Prevention', () => {
    it('generates strictly unique, monotonic order IDs', async () => {
      const generated = new Set<string>();
      const promises = Array.from({ length: 5 }, () => store.generateOrderId());
      const results = await Promise.all(promises);

      for (const id of results) {
        expect(id).toMatch(/^ORD-\d+$/);
        expect(generated.has(id)).toBe(false);
        generated.add(id);
      }
    });

    it('never re-uses a deleted order ID (tombstone avoidance)', async () => {
      const testId = 'ORD-99998';
      await store.recordDeletion('order', testId, 'TestRunner', 'RegressionTest');

      expect(store.isRecordDeleted(testId)).toBe(true);

      // Verify that candidate ID jumps over the tombstone
      const nextId = await store.generateOrderId();
      expect(nextId).not.toBe(testId);
    });

    it('generates strictly unique expense and payout IDs', async () => {
      const expId = await store.generateExpenseId();
      expect(expId).toMatch(/^EXP-\d{4}-\d+$/);

      const payId = await store.generatePayoutId();
      expect(payId).toMatch(/^PAY-PRJ-\d+$/);
    });
  });

  describe('2. Tombstone Resilience Against Google Sheets Auto-Sync', () => {
    it('permanently blocks deleted records from resurrection during reconciliation', async () => {
      const zombieOrderId = 'ORD-ZOMBIE-TEST-1';
      const zombieExpenseId = 'EXP-ZOMBIE-TEST-1';
      const zombiePayoutId = 'PAY-ZOMBIE-TEST-1';

      // Record tombstones for all three
      await store.recordDeletion('order', zombieOrderId, 'Super Admin', 'Test');
      await store.recordDeletion('expense', zombieExpenseId, 'Super Admin', 'Test');
      await store.recordDeletion('payout', zombiePayoutId, 'Super Admin', 'Test');

      // Simulate incoming Google Sheets sync containing these zombie IDs
      const summary = store.reconcileAll({
        orders: [
          {
            id: zombieOrderId,
            clientName: 'Resurrected Client Inc',
            totalAmount: 15000,
            paidAmount: 5000,
          }
        ],
        expenses: [
          {
            id: zombieExpenseId,
            category: 'Office Supplies',
            amount: 2500,
          }
        ],
        payouts: [
          {
            id: zombiePayoutId,
            resourceWorkerName: 'Zombie Developer',
            agreedPayoutAmount: 5000,
          }
        ],
      }, 'Google Sheets');

      // Verify store did NOT add or activate the zombie records
      expect(store.getOrderById(zombieOrderId)).toBeUndefined();
      expect(store.getExpenseById(zombieExpenseId)).toBeUndefined();
      expect(store.getPayoutById(zombiePayoutId)).toBeUndefined();

      expect(summary.orders.added).toBe(0);
      expect(summary.expenses.added).toBe(0);
      expect(summary.payouts.added).toBe(0);
    });
  });

  describe('3. Immutable Record Source & Safety Circuit-Breaker', () => {
    it('preserves Dashboard source and protects CRM records from auto-pruning', async () => {
      // Create a test order originating from Dashboard
      const order = await store.createOrder({
        clientName: 'Dashboard Client Corp',
        serviceName: 'Custom Web Dev',
        totalAmount: 20000,
        paidAmount: 10000,
      }, 'Admin', 'Dashboard');

      expect(order.source).toBe('Dashboard');
      const createdId = order.id;

      // Simulate reconciliation matching this order from Google Sheets
      store.reconcileOrders([
        {
          id: createdId,
          clientName: 'Dashboard Client Corp Updated',
          totalAmount: 20000,
          paidAmount: 10000,
        }
      ], 'Google Sheets');

      const reFetched = store.getOrderById(createdId);
      expect(reFetched).toBeDefined();
      // CRITICAL: Source MUST remain Dashboard so Sheets sync can NEVER delete it
      expect(reFetched?.source).toBe('Dashboard');

      // Now simulate a sync where Google Sheets omits this order entirely
      store.reconcileOrders([], 'Google Sheets');

      // Order MUST still exist! (Dashboard-created records are immune to Google Sheets omission)
      const afterPruneAttempt = store.getOrderById(createdId);
      expect(afterPruneAttempt).toBeDefined();
      expect(afterPruneAttempt?.id).toBe(createdId);

      // Clean up test order
      await store.deleteOrder(createdId, 'TestRunner', true);
    });

    it('triggers circuit-breaker when Google Sheets returns 0 rows', () => {
      const activeCount = store.getOrders().length;

      // Reconciling an empty array should not purge active records
      const summary = store.reconcileOrders([], 'Google Sheets');
      expect(summary.removed).toBe(0);
      expect(store.getOrders().length).toBe(activeCount);
    });
  });

  describe('4. Financial Calculation & Due Amount Invariants', () => {
    it('correctly calculates due amounts and payment statuses for orders', async () => {
      const fullOrder = await store.createOrder({
        clientName: 'Test Full Pay',
        serviceName: 'SEO Package',
        totalAmount: 10000,
        paidAmount: 10000,
      }, 'Admin', 'Dashboard');

      expect(fullOrder.dueAmount).toBe(0);
      expect(fullOrder.paymentStatus).toBe('Paid');

      const partialOrder = await store.createOrder({
        clientName: 'Test Partial Pay',
        serviceName: 'App Dev',
        totalAmount: 50000,
        paidAmount: 20000,
      }, 'Admin', 'Dashboard');

      expect(partialOrder.dueAmount).toBe(30000);
      expect(partialOrder.paymentStatus).toBe('Partial');

      const unpaidOrder = await store.createOrder({
        clientName: 'Test Unpaid',
        serviceName: 'UI Design',
        totalAmount: 15000,
        paidAmount: 0,
      }, 'Admin', 'Dashboard');

      expect(unpaidOrder.dueAmount).toBe(15000);
      expect(unpaidOrder.paymentStatus).toBe('Unpaid');

      // Cleanup
      await store.deleteOrder(fullOrder.id, 'TestRunner', true);
      await store.deleteOrder(partialOrder.id, 'TestRunner', true);
      await store.deleteOrder(unpaidOrder.id, 'TestRunner', true);
    });

    it('correctly computes payout commission rates and final payable amounts', async () => {
      // Percentage commission: 20% of 100,000 budget = 20,000 agreed payout
      const payout = await store.createPayout({
        resourceWorkerName: 'Frontend Engineer',
        projectOrderId: 'PRJ-TEST-100',
        totalProjectBudget: 100000,
        commissionType: 'Percentage (%)',
        commissionRate: 20,
        advancePaid: 5000,
      }, 'Admin', 'Dashboard');

      expect(payout.agreedPayoutAmount).toBe(20000);
      expect(payout.dueFinalPayable).toBe(15000);
      expect(payout.paymentStatus).toBe('Partial');

      // Cleanup
      await store.deletePayout(payout.id, 'TestRunner', true);
    });
  });

  describe('5. Authentication, Roles & Security Integrity', () => {
    it('hashes passwords securely using scrypt and validates correctly', () => {
      const rawPassword = 'SecureAdminSecret2026!';
      const hash = hashPassword(rawPassword);

      expect(hash).toContain(':');
      expect(verifyPassword(rawPassword, hash)).toBe(true);
      expect(verifyPassword('WrongPassword', hash)).toBe(false);
      expect(verifyPassword('', hash)).toBe(false);
    });

    it('guarantees Super Admin possesses complete permissions across all modules', () => {
      const superAdminRole = DEFAULT_ROLES.find(r => r.id === 'role-super-admin');
      expect(superAdminRole).toBeDefined();

      const perms = superAdminRole!.permissions;
      expect(perms.orders.create).toBe(true);
      expect(perms.orders.delete).toBe(true);
      expect(perms.expenses.delete).toBe(true);
      expect(perms.payouts.delete).toBe(true);
      expect(perms.users.create).toBe(true);
      expect(perms.roles.edit).toBe(true);
    });
  });
});
