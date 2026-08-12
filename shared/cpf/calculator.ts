/**
 * Official CPF Board contribution calculator (private-sector / non-pensionable).
 *
 * Primary source of truth:
 * https://www.cpf.gov.sg/employer/tools-and-services/calculators/cpf-contribution-calculator
 * Rate tables PDF (1 Jan 2026) and prior-year tables.
 *
 * Rounding (Board notes):
 * 1) Total CPF → nearest dollar (<50¢ down, ≥50¢ up)
 * 2) Employee share → round down to nearest dollar
 * 3) Employer share = Total − Employee
 */
import { getCpfYearConfig } from "./rates";
import type {
  AgeBandRateRow,
  CpfAgeBand,
  CpfCalculationInput,
  CpfCalculationResult,
  CpfYearConfig,
  PrRateType,
  PrYear,
  ResidencyType,
  WageBand,
} from "./types";

export function roundToNearestDollar(amount: number): number {
  return Math.round(amount);
}

export function roundDownToDollar(amount: number): number {
  return Math.floor(amount + 1e-9);
}

/**
 * Effective age for CPF rate bands.
 * New rates apply from the 1st day of the month AFTER the 55th/60th/65th/70th birthday.
 * Board calculator uses birth month/year only.
 */
export function getEffectiveCpfAge(
  birthMonth: number,
  birthYear: number,
  contributionMonth: number,
  contributionYear: number
): number {
  const bm = clampMonth(birthMonth);
  const cm = clampMonth(contributionMonth);
  let age = contributionYear - birthYear;
  if (cm <= bm) age -= 1;
  return Math.max(0, age);
}

export function getCpfAgeBand(effectiveAge: number): CpfAgeBand {
  if (effectiveAge < 55) return "55_and_below";
  if (effectiveAge < 60) return "above_55_to_60";
  if (effectiveAge < 65) return "above_60_to_65";
  if (effectiveAge < 70) return "above_65_to_70";
  return "above_70";
}

export function getWageBand(totalWages: number): WageBand {
  if (totalWages <= 50) return "nil";
  if (totalWages <= 500) return "50_to_500";
  if (totalWages <= 750) return "500_to_750";
  return "above_750";
}

function clampMonth(m: number): number {
  if (!Number.isFinite(m)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(m)));
}

function selectRateTable(
  config: CpfYearConfig,
  residencyType: ResidencyType,
  prYear: PrYear | null | undefined,
  prRateType: PrRateType | null | undefined
): Record<CpfAgeBand, AgeBandRateRow> | null {
  if (residencyType === "foreigner") return null;

  const rateType: PrRateType = prRateType ?? "GG";

  if (residencyType === "citizen" || prYear === 3 || prYear == null) {
    return config.fullRates;
  }

  if (prYear === 1) {
    if (rateType === "FF") return config.fullRates;
    if (rateType === "FG") return config.pr1Fg;
    return config.pr1Gg;
  }

  if (prYear === 2) {
    if (rateType === "FF") return config.fullRates;
    if (rateType === "FG") return config.pr2Fg;
    return config.pr2Gg;
  }

  return config.fullRates;
}

/**
 * AW ceiling for the month:
 * Additional Wage Ceiling = (17 × OW Ceiling) − Total OW subject to CPF for the year
 * (including this month's OW subject).
 */
export function computeAdditionalWageCeiling(
  ordinaryWageCeiling: number,
  ordinaryWagesSubjectThisMonth: number,
  ordinaryWagesSubjectYtd: number,
  multiplier = 17
): number {
  const annualOwBudget = multiplier * ordinaryWageCeiling;
  const owUsed = Math.max(0, ordinaryWagesSubjectYtd) + Math.max(0, ordinaryWagesSubjectThisMonth);
  return Math.max(0, annualOwBudget - owUsed);
}

function computeRawForBand(
  rates: AgeBandRateRow,
  wageBand: WageBand,
  tw: number,
  owSubject: number,
  awSubject: number
): { totalRaw: number; employeeRaw: number } {
  if (wageBand === "nil") {
    return { totalRaw: 0, employeeRaw: 0 };
  }

  if (wageBand === "50_to_500") {
    const totalRaw = rates.band50to500TotalRate * tw;
    return { totalRaw, employeeRaw: 0 };
  }

  if (wageBand === "500_to_750") {
    const employeeRaw = rates.band500to750EmployeeCoeff * (tw - 500);
    const totalRaw = rates.band500to750EmployerBaseRate * tw + employeeRaw;
    return { totalRaw, employeeRaw };
  }

  // above $750 — OW and AW at full rates
  const totalRaw = rates.totalRate * owSubject + rates.totalRate * awSubject;
  const employeeRaw = rates.employeeRate * owSubject + rates.employeeRate * awSubject;
  return { totalRaw, employeeRaw };
}

export function calculateCpfContributions(
  input: CpfCalculationInput
): CpfCalculationResult {
  const ordinaryWages = Math.max(0, Number(input.ordinaryWages) || 0);
  const additionalWages = Math.max(0, Number(input.additionalWages) || 0);
  const totalWages = ordinaryWages + additionalWages;

  const contributionYear = Math.trunc(input.contributionYear);
  const config = getCpfYearConfig(contributionYear);

  const effectiveAge = getEffectiveCpfAge(
    input.birthMonth,
    input.birthYear,
    input.contributionMonth,
    contributionYear
  );
  const ageBand = getCpfAgeBand(effectiveAge);
  const wageBand = getWageBand(totalWages);

  const rateTable = selectRateTable(
    config,
    input.residencyType,
    input.prYear,
    input.prRateType
  );

  if (!rateTable || input.residencyType === "foreigner") {
    return emptyResult({
      contributionYear: config.year,
      ageBand,
      effectiveAge,
      wageBand,
      ordinaryWages,
      additionalWages,
      totalWages,
      ordinaryWageCeiling: config.ordinaryWageCeiling,
    });
  }

  const rates = rateTable[ageBand];
  const ordinaryWagesSubject = Math.min(ordinaryWages, config.ordinaryWageCeiling);
  const awCeiling = computeAdditionalWageCeiling(
    config.ordinaryWageCeiling,
    ordinaryWagesSubject,
    input.ordinaryWagesSubjectYtd ?? 0,
    config.annualWageCeilingMultiplier
  );
  // Remaining AW room after YTD AW already subject
  const awRemaining = Math.max(0, awCeiling - Math.max(0, input.additionalWagesSubjectYtd ?? 0));
  const additionalWagesSubject =
    wageBand === "above_750" ? Math.min(additionalWages, awRemaining) : 0;

  // For low-wage bands, Board formulas use TW (not split OW/AW)
  const { totalRaw, employeeRaw } = computeRawForBand(
    rates,
    wageBand,
    totalWages,
    ordinaryWagesSubject,
    additionalWagesSubject
  );

  let totalCpf = roundToNearestDollar(totalRaw);
  let employeeCpf = Math.min(totalCpf, roundDownToDollar(employeeRaw));
  let employerCpf = totalCpf - employeeCpf;

  // Cap by remaining annual CPF limit when YTD is provided
  const ytdPaid = Math.max(0, input.totalCpfPaidYtd ?? 0);
  const remainingAnnual = Math.max(0, config.annualCpfLimit - ytdPaid);
  if (totalCpf > remainingAnnual) {
    // Scale down preserving Board split intent as far as possible
    const scale = remainingAnnual / totalCpf;
    totalCpf = remainingAnnual;
    employeeCpf = Math.min(totalCpf, roundDownToDollar(employeeRaw * scale));
    employerCpf = totalCpf - employeeCpf;
  }

  const employerRate =
    rates.totalRate > 0 ? Math.max(0, rates.totalRate - rates.employeeRate) : 0;

  return {
    contributionYear: config.year,
    ageBand,
    effectiveAge,
    wageBand,
    ordinaryWages,
    additionalWages,
    totalWages,
    ordinaryWagesSubject: wageBand === "above_750" ? ordinaryWagesSubject : 0,
    additionalWagesSubject,
    ordinaryWageCeiling: config.ordinaryWageCeiling,
    additionalWageCeiling: awCeiling,
    totalRatePercent: round2(rates.totalRate * 100),
    employeeRatePercent: round2(rates.employeeRate * 100),
    employerRatePercent: round2(employerRate * 100),
    totalCpfRaw: round2(totalRaw),
    employeeCpfRaw: round2(employeeRaw),
    totalCpf,
    employeeCpf,
    employerCpf,
  };
}

function emptyResult(partial: {
  contributionYear: number;
  ageBand: CpfAgeBand;
  effectiveAge: number;
  wageBand: WageBand;
  ordinaryWages: number;
  additionalWages: number;
  totalWages: number;
  ordinaryWageCeiling: number;
}): CpfCalculationResult {
  return {
    ...partial,
    ordinaryWagesSubject: 0,
    additionalWagesSubject: 0,
    additionalWageCeiling: 0,
    totalRatePercent: 0,
    employeeRatePercent: 0,
    employerRatePercent: 0,
    totalCpfRaw: 0,
    employeeCpfRaw: 0,
    totalCpf: 0,
    employeeCpf: 0,
    employerCpf: 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse DOB into birth month/year for Board-style age. */
export function birthMonthYearFromDob(
  dateOfBirth?: string | Date | null
): { birthMonth: number; birthYear: number } | null {
  if (!dateOfBirth) return null;
  const d = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (isNaN(d.getTime())) return null;
  return { birthMonth: d.getMonth() + 1, birthYear: d.getFullYear() };
}
