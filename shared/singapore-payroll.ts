/**
 * Singapore CPF + IRAS resident income tax calculator.
 * CPF engine: Board-aligned calculator in ./cpf (official CPF Board rules).
 * Chargeable income = annual salary − annual employee CPF (extensible for reliefs later).
 */
import { calculateSingaporeAnnualTax } from "./singapore-tax";
import {
  birthMonthYearFromDob,
  calculateCpfContributions,
  getCpfYearConfig,
  LATEST_CPF_YEAR,
  type CpfCalculationResult,
  type PrRateType,
  type PrYear,
  type ResidencyType,
} from "./cpf";

export type { ResidencyType, PrYear, PrRateType };
export { LATEST_CPF_YEAR };

/** @deprecated Prefer contribution-year OW ceiling via getCpfYearConfig */
export const CPF_WAGE_CEILING = getCpfYearConfig(LATEST_CPF_YEAR).ordinaryWageCeiling;

export interface TaxSlabBreakdownRow {
  slabLabel: string;
  ratePercent: number;
  taxableAmount: number;
  tax: number;
}

export interface SingaporePayrollSnapshot {
  monthlySalary: number;
  annualSalary: number;
  cpfApplicableSalary: number;
  ordinaryWages: number;
  additionalWages: number;
  ordinaryWagesSubject: number;
  additionalWagesSubject: number;
  employeeCpfRate: number;
  employerCpfRate: number;
  monthlyEmployeeCpf: number;
  monthlyEmployerCpf: number;
  monthlyTotalCpf: number;
  annualEmployeeCpf: number;
  annualEmployerCpf: number;
  annualTotalCpf: number;
  chargeableIncome: number;
  annualIncomeTax: number;
  monthlyIncomeTax: number;
  effectiveTaxRate: number;
  netSalary: number;
  taxBreakdown: TaxSlabBreakdownRow[];
  contributionYear: number;
  ageBand: string;
  wageBand: string;
  cpfDetail?: CpfCalculationResult;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Legacy helper — returns headline % rates for TW > $750 full-wage band.
 * Prefer calculateCpfContributions for payable amounts.
 */
export function getCpfRates(
  age: number,
  residencyType: ResidencyType,
  prYear?: PrYear | null,
  contributionYear: number = LATEST_CPF_YEAR,
  prRateType: PrRateType | null = "GG"
): { employerRate: number; employeeRate: number } {
  // Keep the displayed age in its birthday month so 54/59/64/69/70 are not
  // pushed into the next CPF band (rates change the month AFTER the birthday).
  const safeAge = Math.max(16, age);
  const result = calculateCpfContributions({
    ordinaryWages: 3000,
    additionalWages: 0,
    birthMonth: 6,
    birthYear: contributionYear - safeAge - 1,
    contributionMonth: 6,
    contributionYear,
    residencyType,
    prYear,
    prRateType,
  });
  return {
    employerRate: result.employerRatePercent / 100,
    employeeRate: result.employeeRatePercent / 100,
  };
}

const TAX_BRACKET_LIMITS: { limit: number; rate: number }[] = [
  { limit: 20000, rate: 0 },
  { limit: 30000, rate: 0.02 },
  { limit: 40000, rate: 0.035 },
  { limit: 80000, rate: 0.07 },
  { limit: 120000, rate: 0.115 },
  { limit: 160000, rate: 0.15 },
  { limit: 200000, rate: 0.18 },
  { limit: 240000, rate: 0.19 },
  { limit: 280000, rate: 0.195 },
  { limit: 320000, rate: 0.2 },
  { limit: 500000, rate: 0.22 },
  { limit: 1000000, rate: 0.23 },
  { limit: Infinity, rate: 0.24 },
];

export function calculateResidentIncomeTax(chargeableIncome: number): number {
  const income = Math.max(0, chargeableIncome);
  let tax = 0;
  let previousLimit = 0;
  for (const { limit: currentLimit, rate } of TAX_BRACKET_LIMITS) {
    if (income > previousLimit) {
      const taxableAmount = Math.min(income, currentLimit) - previousLimit;
      tax += taxableAmount * rate;
      previousLimit = currentLimit;
    } else {
      break;
    }
  }
  return round2(tax);
}

export function getIncomeTaxBreakdown(chargeableIncome: number): TaxSlabBreakdownRow[] {
  const income = Math.max(0, chargeableIncome);
  const rows: TaxSlabBreakdownRow[] = [];
  let previousLimit = 0;

  for (const { limit: currentLimit, rate } of TAX_BRACKET_LIMITS) {
    if (income <= previousLimit) break;
    const taxableAmount = Math.min(income, currentLimit) - previousLimit;
    const slabTax = round2(taxableAmount * rate);
    let slabLabel: string;
    if (previousLimit === 0) {
      slabLabel = `First ${currentLimit.toLocaleString()}`;
    } else if (currentLimit === Infinity) {
      slabLabel = `Above ${previousLimit.toLocaleString()}`;
    } else {
      slabLabel = `Next ${(currentLimit - previousLimit).toLocaleString()}`;
    }
    rows.push({
      slabLabel,
      ratePercent: round2(rate * 100),
      taxableAmount: round2(taxableAmount),
      tax: slabTax,
    });
    previousLimit = currentLimit;
  }
  return rows;
}

export function mapPrStatusToYear(prStatus?: string | null): PrYear | null {
  if (!prStatus) return null;
  if (prStatus === "year_1") return 1;
  if (prStatus === "year_2") return 2;
  if (prStatus === "year_3_plus") return 3;
  return 3;
}

/** Map legacy nationality + new residency fields */
export function mapEmployeeResidency(employee: {
  nationality?: string | null;
  residencyType?: string | null;
  prStatus?: string | null;
}): { residencyType: ResidencyType; prYear: PrYear | null } {
  const raw = (employee.residencyType || employee.nationality || "citizen").toLowerCase();
  if (raw === "foreigner") return { residencyType: "foreigner", prYear: null };
  if (raw === "pr") {
    return { residencyType: "pr", prYear: mapPrStatusToYear(employee.prStatus) ?? 3 };
  }
  if (raw === "singaporean_pr") {
    return { residencyType: "pr", prYear: mapPrStatusToYear(employee.prStatus) ?? 3 };
  }
  return { residencyType: "citizen", prYear: null };
}

/**
 * Calendar age helper (legacy). Prefer getEffectiveCpfAge via contribution month/year.
 */
export function calculateAgeFromDob(
  dateOfBirth?: string | Date | null,
  asOf: Date = new Date()
): number {
  if (!dateOfBirth) return 30;
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return 30;
  let age = asOf.getFullYear() - birth.getFullYear();
  const m = asOf.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) age--;
  return Math.max(16, age);
}

export interface CalculatePayrollParams {
  monthlySalary: number;
  /** @deprecated Prefer dateOfBirth + contributionMonth/Year for Board age */
  age?: number;
  residencyType: ResidencyType;
  prYear?: PrYear | null;
  prRateType?: PrRateType | null;
  monthlyAllowances?: number;
  /**
   * Non-CPF payroll deductions (loans, etc.).
   * Do NOT reduce CPF-liable wages — only reduce net pay after employee CPF.
   */
  monthlyDeductions?: number;
  overtimePay?: number;
  /** Explicit Additional Wages (bonus, etc.). Defaults to overtimePay. */
  additionalWages?: number;
  dateOfBirth?: string | Date | null;
  contributionMonth?: number;
  contributionYear?: number;
  ordinaryWagesSubjectYtd?: number;
  additionalWagesSubjectYtd?: number;
  totalCpfPaidYtd?: number;
}

function resolveBirthAndContribution(params: CalculatePayrollParams): {
  birthMonth: number;
  birthYear: number;
  contributionMonth: number;
  contributionYear: number;
} {
  const now = new Date();
  const contributionMonth = params.contributionMonth ?? now.getMonth() + 1;
  const contributionYear = params.contributionYear ?? now.getFullYear();

  const fromDob = birthMonthYearFromDob(params.dateOfBirth);
  if (fromDob) {
    return { ...fromDob, contributionMonth, contributionYear };
  }

  // Fall back from displayed calendar age. Treat contribution month as the
  // birthday month so the employee stays in the current band (Board: new rates
  // start the month AFTER 55/60/65/70). Using January as birth month incorrectly
  // bumped 54→55-60, 59→60-65, 64→65-70, 69→70+.
  const age = Math.max(16, params.age ?? 30);
  return {
    birthMonth: contributionMonth,
    birthYear: contributionYear - age - 1,
    contributionMonth,
    contributionYear,
  };
}

export function calculateSingaporePayrollSnapshot(
  params: CalculatePayrollParams
): SingaporePayrollSnapshot {
  const monthlySalary = round2(Math.max(0, params.monthlySalary));
  const allowances = round2(params.monthlyAllowances ?? 0);
  const deductions = round2(params.monthlyDeductions ?? 0);
  const overtimePay = round2(params.overtimePay ?? 0);

  // OW = monthly salary + recurring allowances; AW = overtime / explicit AW
  const ordinaryWages = round2(monthlySalary + allowances);
  const additionalWages = round2(
    params.additionalWages != null ? params.additionalWages : overtimePay
  );

  const annualSalary = round2(monthlySalary * 12);
  // Gross for net-pay: salary + allowances + OT − non-CPF deductions
  const grossForNet = round2(Math.max(0, monthlySalary + allowances + overtimePay - deductions));

  const { birthMonth, birthYear, contributionMonth, contributionYear } =
    resolveBirthAndContribution(params);

  const cpf = calculateCpfContributions({
    ordinaryWages,
    additionalWages,
    birthMonth,
    birthYear,
    contributionMonth,
    contributionYear,
    residencyType: params.residencyType,
    prYear: params.prYear,
    prRateType: params.prRateType ?? "GG",
    ordinaryWagesSubjectYtd: params.ordinaryWagesSubjectYtd,
    additionalWagesSubjectYtd: params.additionalWagesSubjectYtd,
    totalCpfPaidYtd: params.totalCpfPaidYtd,
  });

  const monthlyEmployeeCpf = cpf.employeeCpf;
  const monthlyEmployerCpf = cpf.employerCpf;
  const monthlyTotalCpf = cpf.totalCpf;
  const annualEmployeeCpf = round2(monthlyEmployeeCpf * 12);
  const annualEmployerCpf = round2(monthlyEmployerCpf * 12);
  const annualTotalCpf = round2(monthlyTotalCpf * 12);

  const chargeableIncome = 0;
  const annualIncomeTax = 0;
  const monthlyIncomeTax = 0;
  const taxBreakdown: TaxSlabBreakdownRow[] = [];
  const effectiveTaxRate = 0;

  const netSalary = round2(grossForNet - monthlyEmployeeCpf);
  const cpfApplicableSalary =
    cpf.wageBand === "above_750"
      ? round2(cpf.ordinaryWagesSubject + cpf.additionalWagesSubject)
      : round2(ordinaryWages + additionalWages);

  return {
    monthlySalary,
    annualSalary,
    cpfApplicableSalary,
    ordinaryWages,
    additionalWages,
    ordinaryWagesSubject: cpf.ordinaryWagesSubject,
    additionalWagesSubject: cpf.additionalWagesSubject,
    employeeCpfRate: cpf.employeeRatePercent,
    employerCpfRate: cpf.employerRatePercent,
    monthlyEmployeeCpf,
    monthlyEmployerCpf,
    monthlyTotalCpf,
    annualEmployeeCpf,
    annualEmployerCpf,
    annualTotalCpf,
    chargeableIncome,
    annualIncomeTax,
    monthlyIncomeTax,
    effectiveTaxRate,
    netSalary,
    taxBreakdown,
    contributionYear: cpf.contributionYear,
    ageBand: cpf.ageBand,
    wageBand: cpf.wageBand,
    cpfDetail: cpf,
  };
}

/** Process-payroll gross line items */
export function calculateProcessPayroll(
  params: CalculatePayrollParams & {
    overtimeHours?: number;
    overtimeRate?: number;
  }
) {
  const overtimePay =
    params.overtimePay ??
    round2((params.overtimeHours ?? 0) * (params.overtimeRate ?? 0));
  const allowances = round2(params.monthlyAllowances ?? 0);
  const deductions = round2(params.monthlyDeductions ?? 0);
  const snapshot = calculateSingaporePayrollSnapshot({
    ...params,
    overtimePay,
    monthlyAllowances: allowances,
    monthlyDeductions: deductions,
  });
  const grossSalary = round2(
    Math.max(0, snapshot.monthlySalary + allowances + overtimePay - deductions)
  );

  return {
    ...snapshot,
    grossSalary,
    allowancesTotal: allowances,
    deductionsTotal: deductions,
    overtimePay,
    taxRatePercent: snapshot.effectiveTaxRate,
    taxAmount: snapshot.monthlyIncomeTax,
    cpfEmployeeRate: snapshot.employeeCpfRate,
    cpfEmployeeAmount: snapshot.monthlyEmployeeCpf,
    cpfEmployerRate: snapshot.employerCpfRate,
    cpfEmployerAmount: snapshot.monthlyEmployerCpf,
  };
}

export function residencyLabel(nationality?: string | null, prStatus?: string | null): string {
  const { residencyType } = mapEmployeeResidency({ nationality, prStatus });
  if (residencyType === "foreigner") return "Foreigner";
  if (residencyType === "pr") {
    const labels: Record<string, string> = {
      year_1: "PR (1 Year)",
      year_2: "PR (2 Year)",
      year_3_plus: "PR (3 Year+)",
    };
    return labels[prStatus || ""] || "Permanent Resident";
  }
  return "Singapore Citizen";
}

export {
  calculateCpfContributions,
  getCpfYearConfig,
  birthMonthYearFromDob,
  getEffectiveCpfAge,
  getCpfAgeBand,
} from "./cpf";

export { calculateSingaporeAnnualTax };
