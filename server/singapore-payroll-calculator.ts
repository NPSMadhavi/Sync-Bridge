/**
 * Singapore Payroll Calculator
 * Implements CPF, Income Tax, and MOM regulations as of 2024/2025
 */

export interface PayrollCalculationInput {
  grossSalary: number;
  age: number;
  citizenshipStatus: 'citizen' | 'pr' | 'foreigner';
  cpfStatus: 'ordinary' | 'graduate' | 'full';
  monthlyAllowances?: Record<string, number>;
  monthlyDeductions?: Record<string, number>;
  overtimeHours?: number;
  overtimeRate?: number;
}

export interface PayrollCalculationResult {
  grossPay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  adjustedGrossPay: number;
  
  // CPF Contributions (2024 rates)
  employeeCpf: number;
  employerCpf: number;
  totalCpf: number;
  cpfOrdinaryAccount: number;
  cpfSpecialAccount: number;
  cpfMediSave: number;
  
  // Income Tax (IRAS 2024)
  monthlyTaxDeduction: number;
  annualTaxableIncome: number;
  
  // Additional deductions
  otherDeductions: number;
  
  // Final calculation
  netPay: number;
  
  // Breakdown details
  breakdown: {
    baseSalary: number;
    overtimePay: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    cpfBreakdown: {
      employeeOrdinaryRate: number;
      employeeSpecialRate: number;
      employeeMediSaveRate: number;
      employerOrdinaryRate: number;
      employerSpecialRate: number;
      employerMediSaveRate: number;
    };
    taxBracket: string;
  };
}

/**
 * CPF Contribution Rates 2024 (for citizens and PRs)
 * Source: CPF Board official rates
 */
const CPF_RATES_2024 = {
  // Employee contribution rates by age
  employee: {
    '50_below': { total: 20, ordinary: 62, special: 13, medisave: 25 }, // % of total CPF
    '50_55': { total: 20, ordinary: 62, special: 13, medisave: 25 },
    '55_60': { total: 13, ordinary: 15, special: 16.15, medisave: 68.85 },
    '60_65': { total: 7.5, ordinary: 9.33, special: 22.67, medisave: 68 },
    '65_70': { total: 5, ordinary: 10, special: 20, medisave: 70 },
    '70_above': { total: 5, ordinary: 10, special: 20, medisave: 70 }
  },
  // Employer contribution rates by age
  employer: {
    '50_below': { total: 17, ordinary: 62, special: 13, medisave: 25 },
    '50_55': { total: 17, ordinary: 62, special: 13, medisave: 25 },
    '55_60': { total: 13, ordinary: 15, special: 16.15, medisave: 68.85 },
    '60_65': { total: 9, ordinary: 9.33, special: 22.67, medisave: 68 },
    '65_70': { total: 7.5, ordinary: 10, special: 20, medisave: 70 },
    '70_above': { total: 5, ordinary: 10, special: 20, medisave: 70 }
  }
};

/**
 * Singapore Income Tax Brackets 2024/2025
 * Source: IRAS official tax rates
 */
const INCOME_TAX_BRACKETS_2024 = [
  { min: 0, max: 20000, rate: 0 },
  { min: 20000, max: 30000, rate: 2 },
  { min: 30000, max: 40000, rate: 3.5 },
  { min: 40000, max: 80000, rate: 7 },
  { min: 80000, max: 120000, rate: 11.5 },
  { min: 120000, max: 160000, rate: 15 },
  { min: 160000, max: 200000, rate: 18 },
  { min: 200000, max: 240000, rate: 19 },
  { min: 240000, max: 280000, rate: 19.5 },
  { min: 280000, max: 320000, rate: 20 },
  { min: 320000, max: Infinity, rate: 22 }
];

/**
 * CPF Ordinary Wage Ceiling (2024): S$6,000 per month
 * Additional Wage Ceiling: S$102,000 per year
 */
const CPF_ORDINARY_WAGE_CEILING_MONTHLY = 6000;
const CPF_ADDITIONAL_WAGE_CEILING_ANNUAL = 102000;

function getAgeCategory(age: number): string {
  if (age < 50) return '50_below';
  if (age < 55) return '50_55';
  if (age < 60) return '55_60';
  if (age < 65) return '60_65';
  if (age < 70) return '65_70';
  return '70_above';
}

function calculateCPFContribution(
  ordinaryWage: number, 
  age: number, 
  citizenshipStatus: string
): {
  employeeCpf: number;
  employerCpf: number;
  totalCpf: number;
  breakdown: any;
} {
  // Foreigners don't contribute to CPF
  if (citizenshipStatus === 'foreigner') {
    return {
      employeeCpf: 0,
      employerCpf: 0,
      totalCpf: 0,
      breakdown: {
        employeeOrdinaryRate: 0,
        employeeSpecialRate: 0,
        employeeMediSaveRate: 0,
        employerOrdinaryRate: 0,
        employerSpecialRate: 0,
        employerMediSaveRate: 0
      }
    };
  }

  const ageCategory = getAgeCategory(age);
  const cappedWage = Math.min(ordinaryWage, CPF_ORDINARY_WAGE_CEILING_MONTHLY);
  
  const employeeRates = CPF_RATES_2024.employee[ageCategory];
  const employerRates = CPF_RATES_2024.employer[ageCategory];
  
  const employeeCpf = (cappedWage * employeeRates.total) / 100;
  const employerCpf = (cappedWage * employerRates.total) / 100;
  
  return {
    employeeCpf,
    employerCpf,
    totalCpf: employeeCpf + employerCpf,
    breakdown: {
      employeeOrdinaryRate: employeeRates.ordinary,
      employeeSpecialRate: employeeRates.special,
      employeeMediSaveRate: employeeRates.medisave,
      employerOrdinaryRate: employerRates.ordinary,
      employerSpecialRate: employerRates.special,
      employerMediSaveRate: employerRates.medisave
    }
  };
}

function calculateIncomeTax(annualTaxableIncome: number): { 
  annualTax: number; 
  monthlyTax: number; 
  bracket: string; 
} {
  let totalTax = 0;
  let currentBracket = '';
  
  for (const bracket of INCOME_TAX_BRACKETS_2024) {
    if (annualTaxableIncome > bracket.min) {
      const taxableInThisBracket = Math.min(
        annualTaxableIncome - bracket.min,
        bracket.max - bracket.min
      );
      totalTax += (taxableInThisBracket * bracket.rate) / 100;
      
      if (annualTaxableIncome >= bracket.min && annualTaxableIncome <= bracket.max) {
        currentBracket = `${bracket.rate}% (S$${bracket.min.toLocaleString()} - S$${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString()})`;
      }
    }
  }
  
  return {
    annualTax: totalTax,
    monthlyTax: totalTax / 12,
    bracket: currentBracket
  };
}

export function calculateSingaporePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const {
    grossSalary,
    age,
    citizenshipStatus,
    monthlyAllowances = {},
    monthlyDeductions = {},
    overtimeHours = 0,
    overtimeRate = 0
  } = input;

  // Calculate overtime pay
  const overtimePay = overtimeHours * overtimeRate;
  
  // Calculate total allowances and deductions
  const allowancesTotal = Object.values(monthlyAllowances).reduce((sum, amount) => sum + amount, 0);
  const deductionsTotal = Object.values(monthlyDeductions).reduce((sum, amount) => sum + amount, 0);
  
  // Gross pay including overtime and allowances
  const grossPay = grossSalary + overtimePay + allowancesTotal;
  const adjustedGrossPay = grossPay - deductionsTotal;
  
  // CPF Calculation (on ordinary wages only, excluding overtime for CPF purposes)
  const cpfCalculation = calculateCPFContribution(
    grossSalary + allowancesTotal, // CPF calculated on basic + allowances, not overtime
    age,
    citizenshipStatus
  );
  
  // Annual taxable income (gross pay * 12 - CPF employee contributions)
  const annualTaxableIncome = (adjustedGrossPay * 12) - (cpfCalculation.employeeCpf * 12);
  
  // Income tax calculation
  const taxCalculation = calculateIncomeTax(annualTaxableIncome);
  
  // CPF allocation to different accounts
  const totalEmployeeCpf = cpfCalculation.employeeCpf;
  const cpfOrdinaryAccount = totalEmployeeCpf * (cpfCalculation.breakdown.employeeOrdinaryRate / 100);
  const cpfSpecialAccount = totalEmployeeCpf * (cpfCalculation.breakdown.employeeSpecialRate / 100);
  const cpfMediSave = totalEmployeeCpf * (cpfCalculation.breakdown.employeeMediSaveRate / 100);
  
  // Net pay calculation
  const netPay = adjustedGrossPay - cpfCalculation.employeeCpf - taxCalculation.monthlyTax;
  
  return {
    grossPay,
    allowancesTotal,
    deductionsTotal,
    adjustedGrossPay,
    
    employeeCpf: cpfCalculation.employeeCpf,
    employerCpf: cpfCalculation.employerCpf,
    totalCpf: cpfCalculation.totalCpf,
    cpfOrdinaryAccount,
    cpfSpecialAccount,
    cpfMediSave,
    
    monthlyTaxDeduction: taxCalculation.monthlyTax,
    annualTaxableIncome,
    
    otherDeductions: deductionsTotal,
    netPay,
    
    breakdown: {
      baseSalary: grossSalary,
      overtimePay,
      allowances: monthlyAllowances,
      deductions: monthlyDeductions,
      cpfBreakdown: cpfCalculation.breakdown,
      taxBracket: taxCalculation.bracket
    }
  };
}

/**
 * Utility function to format currency in SGD
 */
export function formatSGD(amount: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Validate payroll input according to Singapore regulations
 */
export function validatePayrollInput(input: PayrollCalculationInput): string[] {
  const errors: string[] = [];
  
  if (input.grossSalary < 0) {
    errors.push('Gross salary cannot be negative');
  }
  
  if (input.grossSalary < 1400) {
    errors.push('Gross salary below minimum wage (S$1,400/month as of 2024)');
  }
  
  if (input.age < 16) {
    errors.push('Employee must be at least 16 years old according to MOM regulations');
  }
  
  if (input.overtimeHours && input.overtimeHours > 72) {
    errors.push('Overtime hours exceed MOM limit of 72 hours per month');
  }
  
  return errors;
}