/**
 * Client payroll calculations — re-exports shared Singapore payroll / CPF engine.
 */
export {
  calculateSingaporePayrollSnapshot,
  calculateProcessPayroll,
  calculateResidentIncomeTax,
  getIncomeTaxBreakdown,
  getCpfRates,
  calculateAgeFromDob,
  mapEmployeeResidency,
  mapPrStatusToYear,
  residencyLabel,
  CPF_WAGE_CEILING,
  calculateCpfContributions,
  getCpfYearConfig,
  LATEST_CPF_YEAR,
} from "@shared/singapore-payroll";

import { calculateResidentIncomeTax as calcTax } from "@shared/singapore-payroll";

export function calculateSingaporeTax(annualIncome: number) {
  return calcTax(annualIncome);
}
