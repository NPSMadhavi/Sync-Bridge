/**
 * CPF contribution year configurations.
 * Source of truth: CPF Board PDF tables (Jan 2025 / Jan 2026).
 * https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf
 */
import type { AgeBandRateRow, CpfAgeBand, CpfYearConfig } from "./types";

function row(
  totalRate: number,
  employeeRate: number,
  band50to500TotalRate: number,
  band500to750EmployerBaseRate: number,
  band500to750EmployeeCoeff: number
): AgeBandRateRow {
  return {
    totalRate,
    employeeRate,
    band50to500TotalRate,
    band500to750EmployerBaseRate,
    band500to750EmployeeCoeff,
  };
}

/** Helper: copy older bands when PR table collapses "Above 65" into one band */
function withAbove65Flat(
  base: Record<CpfAgeBand, AgeBandRateRow>,
  above65: AgeBandRateRow
): Record<CpfAgeBand, AgeBandRateRow> {
  return {
    ...base,
    above_65_to_70: above65,
    above_70: above65,
  };
}

// --- Full rates (Citizen / PR 3rd year+ / PR F/F) ---

const FULL_2026: Record<CpfAgeBand, AgeBandRateRow> = {
  "55_and_below": row(0.37, 0.2, 0.17, 0.17, 0.6),
  above_55_to_60: row(0.34, 0.18, 0.16, 0.16, 0.54),
  above_60_to_65: row(0.25, 0.125, 0.125, 0.125, 0.375),
  above_65_to_70: row(0.165, 0.075, 0.09, 0.09, 0.225),
  above_70: row(0.125, 0.05, 0.075, 0.075, 0.15),
};

const FULL_2025: Record<CpfAgeBand, AgeBandRateRow> = {
  "55_and_below": row(0.37, 0.2, 0.17, 0.17, 0.6),
  above_55_to_60: row(0.325, 0.17, 0.155, 0.155, 0.51),
  above_60_to_65: row(0.235, 0.115, 0.12, 0.12, 0.345),
  above_65_to_70: row(0.165, 0.075, 0.09, 0.09, 0.225),
  above_70: row(0.125, 0.05, 0.075, 0.075, 0.15),
};

// --- PR 1st year G/G (unchanged since 2016; same for 2025/2026) ---

const PR1_GG: Record<CpfAgeBand, AgeBandRateRow> = withAbove65Flat(
  {
    "55_and_below": row(0.09, 0.05, 0.04, 0.04, 0.15),
    above_55_to_60: row(0.09, 0.05, 0.04, 0.04, 0.15),
    above_60_to_65: row(0.085, 0.05, 0.035, 0.035, 0.15),
    above_65_to_70: row(0.085, 0.05, 0.035, 0.035, 0.15),
    above_70: row(0.085, 0.05, 0.035, 0.035, 0.15),
  },
  row(0.085, 0.05, 0.035, 0.035, 0.15)
);

// --- PR 2nd year G/G ---

const PR2_GG: Record<CpfAgeBand, AgeBandRateRow> = withAbove65Flat(
  {
    "55_and_below": row(0.24, 0.15, 0.09, 0.09, 0.45),
    above_55_to_60: row(0.185, 0.125, 0.06, 0.06, 0.375),
    above_60_to_65: row(0.11, 0.075, 0.035, 0.035, 0.225),
    above_65_to_70: row(0.085, 0.05, 0.035, 0.035, 0.15),
    above_70: row(0.085, 0.05, 0.035, 0.035, 0.15),
  },
  row(0.085, 0.05, 0.035, 0.035, 0.15)
);

// --- PR 1st year F/G ---

const PR1_FG: Record<CpfAgeBand, AgeBandRateRow> = {
  "55_and_below": row(0.22, 0.05, 0.17, 0.17, 0.15),
  above_55_to_60: row(0.21, 0.05, 0.16, 0.16, 0.15),
  above_60_to_65: row(0.175, 0.05, 0.125, 0.125, 0.15),
  above_65_to_70: row(0.14, 0.05, 0.09, 0.09, 0.15),
  above_70: row(0.125, 0.05, 0.075, 0.075, 0.15),
};

// --- PR 2nd year F/G ---

const PR2_FG: Record<CpfAgeBand, AgeBandRateRow> = {
  "55_and_below": row(0.32, 0.15, 0.17, 0.17, 0.45),
  above_55_to_60: row(0.285, 0.125, 0.16, 0.16, 0.375),
  above_60_to_65: row(0.2, 0.075, 0.125, 0.125, 0.225),
  above_65_to_70: row(0.14, 0.05, 0.09, 0.09, 0.15),
  above_70: row(0.125, 0.05, 0.075, 0.075, 0.15),
};

export const CPF_YEAR_CONFIGS: Record<number, CpfYearConfig> = {
  2025: {
    year: 2025,
    ordinaryWageCeiling: 7400,
    annualWageCeilingMultiplier: 17,
    annualCpfLimit: 37740,
    fullRates: FULL_2025,
    pr1Gg: PR1_GG,
    pr2Gg: PR2_GG,
    pr1Fg: PR1_FG,
    pr2Fg: PR2_FG,
  },
  2026: {
    year: 2026,
    ordinaryWageCeiling: 8000,
    annualWageCeilingMultiplier: 17,
    annualCpfLimit: 37740,
    fullRates: FULL_2026,
    pr1Gg: PR1_GG,
    pr2Gg: PR2_GG,
    pr1Fg: PR1_FG,
    pr2Fg: PR2_FG,
  },
};

/** Latest configured contribution year (use when year is in the future / unknown). */
export const LATEST_CPF_YEAR = Math.max(
  ...Object.keys(CPF_YEAR_CONFIGS).map((y) => Number(y))
);

/**
 * Resolve rate config for a contribution year.
 * Years before the earliest table use the earliest; years after use the latest.
 */
export function getCpfYearConfig(contributionYear: number): CpfYearConfig {
  if (CPF_YEAR_CONFIGS[contributionYear]) {
    return CPF_YEAR_CONFIGS[contributionYear];
  }
  const years = Object.keys(CPF_YEAR_CONFIGS)
    .map(Number)
    .sort((a, b) => a - b);
  if (contributionYear < years[0]) return CPF_YEAR_CONFIGS[years[0]];
  return CPF_YEAR_CONFIGS[years[years.length - 1]];
}
