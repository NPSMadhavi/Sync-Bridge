/**
 * Singapore Payroll Calculator — server adapter using Board-aligned CPF engine.
 */
import {
  calculateProcessPayroll,
  calculateSingaporePayrollSnapshot,
  mapEmployeeResidency,
  type ResidencyType,
  type PrYear,
  type PrRateType,
} from "@shared/singapore-payroll";

export interface PayrollCalculationInput {
  grossSalary: number;
  age?: number;
  citizenshipStatus: ResidencyType;
  prYear?: PrYear | null;
  prRateType?: PrRateType | null;
  cpfStatus?: string;
  monthlyAllowances?: Record<string, number>;
  monthlyDeductions?: Record<string, number>;
  overtimeHours?: number;
  overtimeRate?: number;
  /** Explicit Additional Wages; defaults to overtime pay */
  additionalWages?: number;
  dateOfBirth?: string | Date | null;
  contributionMonth?: number;
  contributionYear?: number;
  ordinaryWagesSubjectYtd?: number;
  additionalWagesSubjectYtd?: number;
  totalCpfPaidYtd?: number;
}

export interface PayrollCalculationResult {
  grossPay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  adjustedGrossPay: number;
  employeeCpf: number;
  employerCpf: number;
  totalCpf: number;
  cpfOrdinaryAccount: number;
  cpfSpecialAccount: number;
  cpfMediSave: number;
  monthlyTaxDeduction: number;
  annualTaxableIncome: number;
  annualTax: number;
  monthlyTax: number;
  taxRatePercent: number;
  otherDeductions: number;
  netPay: number;
  chargeableIncome: number;
  cpfApplicableSalary: number;
  employeeCpfRate: number;
  employerCpfRate: number;
  annualSalary: number;
  taxBreakdown: { slabLabel: string; ratePercent: number; taxableAmount: number; tax: number }[];
  contributionYear?: number;
  ageBand?: string;
  wageBand?: string;
  ordinaryWages?: number;
  additionalWages?: number;
  breakdown: {
    baseSalary: number;
    overtimePay: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    taxBracket: string;
  };
}

export function calculateSingaporePayroll(
  input: PayrollCalculationInput
): PayrollCalculationResult {
  const allowancesTotal = Object.values(input.monthlyAllowances ?? {}).reduce(
    (s, v) => s + Number(v),
    0
  );
  const deductionsTotal = Object.values(input.monthlyDeductions ?? {}).reduce(
    (s, v) => s + Number(v),
    0
  );

  const calc = calculateProcessPayroll({
    monthlySalary: Number(input.grossSalary),
    age: input.age,
    residencyType: input.citizenshipStatus,
    prYear: input.prYear ?? null,
    prRateType: input.prRateType ?? "GG",
    monthlyAllowances: allowancesTotal,
    monthlyDeductions: deductionsTotal,
    overtimeHours: input.overtimeHours,
    overtimeRate: input.overtimeRate,
    additionalWages: input.additionalWages,
    dateOfBirth: input.dateOfBirth,
    contributionMonth: input.contributionMonth,
    contributionYear: input.contributionYear,
    ordinaryWagesSubjectYtd: input.ordinaryWagesSubjectYtd,
    additionalWagesSubjectYtd: input.additionalWagesSubjectYtd,
    totalCpfPaidYtd: input.totalCpfPaidYtd,
  });

  const grossPay = calc.grossSalary;

  return {
    grossPay,
    allowancesTotal: calc.allowancesTotal,
    deductionsTotal: calc.deductionsTotal,
    adjustedGrossPay: grossPay,
    employeeCpf: calc.monthlyEmployeeCpf,
    employerCpf: calc.monthlyEmployerCpf,
    totalCpf: calc.monthlyTotalCpf,
    cpfOrdinaryAccount: 0,
    cpfSpecialAccount: 0,
    cpfMediSave: 0,
    monthlyTaxDeduction: calc.monthlyIncomeTax,
    annualTaxableIncome: calc.annualSalary,
    annualTax: calc.annualIncomeTax,
    monthlyTax: calc.monthlyIncomeTax,
    taxRatePercent: calc.taxRatePercent,
    otherDeductions: 0,
    netPay: calc.netSalary,
    chargeableIncome: calc.chargeableIncome,
    cpfApplicableSalary: calc.cpfApplicableSalary,
    employeeCpfRate: calc.employeeCpfRate,
    employerCpfRate: calc.employerCpfRate,
    annualSalary: calc.annualSalary,
    taxBreakdown: calc.taxBreakdown,
    contributionYear: calc.contributionYear,
    ageBand: calc.ageBand,
    wageBand: calc.wageBand,
    ordinaryWages: calc.ordinaryWages,
    additionalWages: calc.additionalWages,
    breakdown: {
      baseSalary: calc.monthlySalary,
      overtimePay: calc.overtimePay,
      allowances: input.monthlyAllowances ?? {},
      deductions: input.monthlyDeductions ?? {},
      taxBracket: `${calc.effectiveTaxRate}% effective`,
    },
  };
}

export function validatePayrollInput(input: PayrollCalculationInput): string[] {
  const errors: string[] = [];
  if (input.grossSalary < 0) errors.push("Gross salary cannot be negative");
  if (input.overtimeHours && input.overtimeHours > 72) {
    errors.push("Overtime hours exceed MOM limit of 72 hours per month");
  }
  return errors;
}

export function formatSGD(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export { mapEmployeeResidency, calculateSingaporePayrollSnapshot };
