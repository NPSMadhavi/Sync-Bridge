/**
 * Singapore Payroll Utilities
 * Contains utility functions for Singapore-specific payroll calculations
 */

// Check if employee is eligible for CPF (Citizens and PRs only)
export function isEmployeeCpfEligible(nationality?: string): boolean {
  if (!nationality) return false;
  const lowerNationality = nationality.toLowerCase();
  
  // Only Singapore Citizens and PRs are eligible for CPF
  return lowerNationality === 'singaporean' ||
         lowerNationality === 'singaporean_pr' ||
         lowerNationality === 'singapore citizen' ||
         lowerNationality === 'citizen' ||
         lowerNationality === 'pr' ||
         lowerNationality === 'permanent resident';
}

// Calculate Singapore income tax for all residents (Citizens and PRs)
// Note: Foreign workers may have different tax arrangements
export function calculateIncomeTax(baseSalary: number, taxRate: number, nationality?: string): number {
  // Tax applies to all Singapore residents (Citizens and PRs)
  // Foreign workers may have different tax arrangements
  const taxAmount = baseSalary * (taxRate / 100);
  
  return Math.round(taxAmount * 100) / 100; // Round to 2 decimal places
}

// Get CPF rate based on citizenship and PR years
export function getEmployeeCpfRate(nationality?: string, joinDate?: Date | string, pr2ndYearRate: number = 13): number {
  if (!nationality) return 0;
  if (nationality.toLowerCase() === 'singaporean' || nationality.toLowerCase() === 'singapore citizen') {
    return 20;
  }
  if (nationality.toLowerCase() === 'pr' || nationality.toLowerCase() === 'permanent resident') {
    if (!joinDate) return pr2ndYearRate;
    const years = new Date().getFullYear() - new Date(joinDate).getFullYear();
    if (years < 1) return 7;
    if (years < 2) return pr2ndYearRate;
    return 20;
  }
  // Foreigner
  return 0;
}

// Format tax rate display
export function formatTaxRate(taxRate: string | number, nationality?: string): string {
  // Tax applies to all Singapore residents
  const rate = typeof taxRate === 'string' ? parseFloat(taxRate) : taxRate;
  return `${rate.toFixed(2)}%`;
}

// Format CPF rate display
export function formatCpfRate(cpfRate: string | number, nationality?: string): string {
  if (!nationality) {
    const rate = typeof cpfRate === 'string' ? parseFloat(cpfRate) : cpfRate;
    return `${rate.toFixed(2)}%`;
  }
  
  const lowerNationality = nationality.toLowerCase();
  
  // Foreign workers don't contribute to CPF
  if (lowerNationality === 'foreigner' || 
      lowerNationality.includes('foreign') ||
      lowerNationality.includes('ep') ||
      lowerNationality.includes('s pass') ||
      lowerNationality.includes('work permit')) {
    return "-";
  }
  
  const rate = typeof cpfRate === 'string' ? parseFloat(cpfRate) : cpfRate;
  return `${rate.toFixed(2)}%`;
}

// Calculate net pay with Singapore rules
export function calculateNetPay(
  grossPay: number,
  taxRate: number,
  nationality?: string,
  deductions: Record<string, number> = {}
): {
  taxDeduction: number;
  cpfDeduction: number;
  netPay: number;
} {
  const taxDeduction = calculateIncomeTax(grossPay, taxRate, nationality);
  const cpfRate = getEmployeeCpfRate(nationality);
  const cpfDeduction = (grossPay * cpfRate) / 100;
  const otherDeductions = Object.values(deductions).reduce((sum, amount) => sum + amount, 0);
  const netPay = grossPay - taxDeduction - cpfDeduction - otherDeductions;
  
  return {
    taxDeduction: Math.round(taxDeduction * 100) / 100,
    cpfDeduction: Math.round(cpfDeduction * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
  };
} 