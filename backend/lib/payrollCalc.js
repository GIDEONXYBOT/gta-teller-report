/**
 * Helper functions for payroll calculations.
 * centralizes the logic for how over/short/deductions/withdrawals
 * are combined into totalSalary for different periods (weekly/monthly).
 */

export function computeWeeklyShort(short = 0, shortPaymentTerms = 1) {
  const terms = Number(shortPaymentTerms) || 1;
  if (terms <= 0) return Number(short || 0);
  return Number(short || 0) / terms;
}

/**
 * Compute totalSalary using the policy:
 * - weekly: short is considered as weekly installment (short / shortPaymentTerms)
 * - monthly: short is applied in full
 */
export function computeTotalSalary({ baseSalary = 0, over = 0, short = 0, deduction = 0, withdrawal = 0, shortPaymentTerms = 1, shortIsInstallment = false }, { period = 'monthly' } = {}) {
  const b = Number(baseSalary || 0);
  const o = Number(over || 0);
  const s = Number(short || 0);
  const d = Number(deduction || 0);
  const w = Number(withdrawal || 0);

  if (period === 'weekly') {
    // If caller already passed a weekly installment amount in `short` (shortIsInstallment===true)
    // we should not divide it again by `shortPaymentTerms`.
    const weeklyShort = shortIsInstallment ? s : computeWeeklyShort(s, shortPaymentTerms);
    return b + o - weeklyShort - d - w;
  }

  // default: monthly (short applied in full)
  return b + o - s - d - w;
}

export default { computeWeeklyShort, computeTotalSalary };
