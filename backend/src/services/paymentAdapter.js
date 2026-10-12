import crypto from 'crypto';
import { env } from '../config/env.js';

export class PaymentAdapter {
  /**
   * Process a simulated payment request.
   * Supports:
   * - Configurable success/failure distribution (default 95% / 5%)
   * - Simulated network delay
   * - Explicit simulation overrides (FORCE_SUCCESS, FORCE_FAILURE, FORCE_TIMEOUT)
   */
  static async processPayment({ amount, currency = 'USD', simulationMode = null }) {
    // 1. Simulate network / processing latency
    if (env.PAYMENT_SIMULATED_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(env.PAYMENT_SIMULATED_DELAY_MS, 500)));
    }

    // 2. Check for explicit test/demo simulation overrides
    if (simulationMode === 'FORCE_TIMEOUT' || simulationMode === 'UNKNOWN') {
      return {
        status: 'UNKNOWN',
        providerReference: `txn_unresolved_${crypto.randomUUID().slice(0, 8)}`,
        failureReason: 'Payment gateway timeout / connection interrupted. Result pending reconciliation.',
      };
    }

    if (simulationMode === 'FORCE_FAILURE') {
      return {
        status: 'FAILED',
        providerReference: `txn_declined_${crypto.randomUUID().slice(0, 8)}`,
        failureReason: 'Card declined / insufficient funds (Simulated).',
      };
    }

    if (simulationMode === 'FORCE_SUCCESS') {
      return {
        status: 'SUCCEEDED',
        providerReference: `ch_sim_${crypto.randomUUID().slice(0, 16)}`,
        failureReason: null,
      };
    }

    // 3. Fallback to probabilistic distribution (default 95% success, 5% failure)
    const random = Math.random();
    if (random < env.PAYMENT_SUCCESS_RATE) {
      return {
        status: 'SUCCEEDED',
        providerReference: `ch_sim_${crypto.randomUUID().slice(0, 16)}`,
        failureReason: null,
      };
    } else {
      return {
        status: 'FAILED',
        providerReference: `txn_declined_${crypto.randomUUID().slice(0, 8)}`,
        failureReason: 'Card declined / network timeout at acquiring bank.',
      };
    }
  }

  /**
   * Reconcile an unknown transaction state with the simulated gateway.
   */
  static async reconcileTransaction(providerReference) {
    // In real life, queries the provider's GET /v1/charges/:id
    // Simulated gateway confirms charges starting with ch_sim as succeeded, others as failed
    const succeeded = providerReference.startsWith('ch_sim_') || !providerReference.includes('declined');
    return {
      status: succeeded ? 'SUCCEEDED' : 'FAILED',
      reconciledAt: new Date(),
    };
  }
}
