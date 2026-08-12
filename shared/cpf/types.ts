/**
 * CPF Board–aligned types.
 * Primary source: https://www.cpf.gov.sg/employer/tools-and-services/calculators/cpf-contribution-calculator
 * Rate tables: CPFcontributionratesfrom1Jan2026.pdf
 */

export type ResidencyType = "citizen" | "pr" | "foreigner";

/** 1 = 1st year PR, 2 = 2nd year, 3 = 3rd year and above */
export type PrYear = 1 | 2 | 3;

/**
 * PR contribution rate arrangement (Board calculator):
 * - G/G: Graduated employer + graduated employee (default for 1st/2nd year PR)
 * - F/G: Full employer + graduated employee (joint application)
 * - F/F: Full employer + full employee (uses citizen / 3rd-year+ table)
 */
export type PrRateType = "GG" | "FG" | "FF";

export type CpfAgeBand =
  | "55_and_below"
  | "above_55_to_60"
  | "above_60_to_65"
  | "above_65_to_70"
  | "above_70";

export type WageBand = "nil" | "50_to_500" | "500_to_750" | "above_750";

/** Rates for TW > $750 (decimals, e.g. 0.37 = 37%) */
export interface FullWageRates {
  totalRate: number;
  employeeRate: number;
}

/**
 * Low-wage band formulas from CPF Board tables.
 * >$50–$500: total = totalRateOnTw * TW, employee = 0
 * >$500–$750: total = employerBaseOnTw * TW + employeeCoeff * (TW - 500),
 *              employee = employeeCoeff * (TW - 500)
 */
export interface LowWageRates {
  /** Total rate on TW for >$50 to $500 (employer only) */
  band50to500TotalRate: number;
  /** Employer base rate on TW for >$500 to $750 */
  band500to750EmployerBaseRate: number;
  /** Employee coefficient on (TW - 500) for >$500 to $750 */
  band500to750EmployeeCoeff: number;
}

export interface AgeBandRateRow extends FullWageRates, LowWageRates {}

export interface CpfYearConfig {
  /** Contribution year this table applies from (inclusive) */
  year: number;
  ordinaryWageCeiling: number;
  /** Annual total wage ceiling used in AW ceiling formula (17 × OW ceiling) */
  annualWageCeilingMultiplier: number;
  /** Optional mandatory CPF annual limit (e.g. 37740) */
  annualCpfLimit: number;
  /** Citizen / PR 3rd year+ / PR F/F */
  fullRates: Record<CpfAgeBand, AgeBandRateRow>;
  /** PR 1st year G/G */
  pr1Gg: Record<CpfAgeBand, AgeBandRateRow>;
  /** PR 2nd year G/G */
  pr2Gg: Record<CpfAgeBand, AgeBandRateRow>;
  /** PR 1st year F/G */
  pr1Fg: Record<CpfAgeBand, AgeBandRateRow>;
  /** PR 2nd year F/G */
  pr2Fg: Record<CpfAgeBand, AgeBandRateRow>;
}

export interface CpfCalculationInput {
  ordinaryWages: number;
  additionalWages?: number;
  /** Birth month 1–12 */
  birthMonth: number;
  /** Birth year e.g. 1990 */
  birthYear: number;
  /** Contribution month 1–12 */
  contributionMonth: number;
  /** Contribution year e.g. 2026 (or override) */
  contributionYear: number;
  residencyType: ResidencyType;
  prYear?: PrYear | null;
  /** Defaults to GG for 1st/2nd year PR */
  prRateType?: PrRateType | null;
  /**
   * Ordinary wages already subject to CPF earlier in the same calendar year
   * (before this month). Used for AW ceiling.
   */
  ordinaryWagesSubjectYtd?: number;
  /** Additional wages already subject to CPF earlier in the same calendar year */
  additionalWagesSubjectYtd?: number;
  /** Total CPF already paid YTD (employee + employer), for annual limit */
  totalCpfPaidYtd?: number;
}

export interface CpfCalculationResult {
  contributionYear: number;
  ageBand: CpfAgeBand;
  effectiveAge: number;
  wageBand: WageBand;
  ordinaryWages: number;
  additionalWages: number;
  totalWages: number;
  ordinaryWagesSubject: number;
  additionalWagesSubject: number;
  ordinaryWageCeiling: number;
  additionalWageCeiling: number;
  totalRatePercent: number;
  employeeRatePercent: number;
  employerRatePercent: number;
  /** Before Board rounding */
  totalCpfRaw: number;
  employeeCpfRaw: number;
  /** After Board rounding (dollars) */
  totalCpf: number;
  employeeCpf: number;
  employerCpf: number;
}
