/**
 * CPF Board contribution calculator tests.
 * Expected values follow official CPF Board formulas / calculator rules
 * (nearest-dollar total, floor employee, employer = total − employee).
 *
 * Run: npx tsx --test shared/cpf/cpf-calculator.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCpfContributions,
  getEffectiveCpfAge,
  getCpfAgeBand,
  roundToNearestDollar,
  roundDownToDollar,
} from "./calculator";
import { getCpfYearConfig } from "./rates";

describe("CPF rounding rules", () => {
  it("rounds total to nearest dollar", () => {
    assert.equal(roundToNearestDollar(1233.21), 1233);
    assert.equal(roundToNearestDollar(1233.5), 1234);
    assert.equal(roundToNearestDollar(1233.49), 1233);
  });

  it("rounds employee share down to the dollar", () => {
    assert.equal(roundDownToDollar(666.6), 666);
    assert.equal(roundDownToDollar(666.99), 666);
  });
});

describe("CPF effective age (month after birthday)", () => {
  it("keeps prior band in birthday month", () => {
    // Turns 55 in Jan 2026 → still ≤55 in Jan
    assert.equal(getEffectiveCpfAge(1, 1971, 1, 2026), 54);
    assert.equal(getCpfAgeBand(54), "55_and_below");
  });

  it("moves to next band the month after birthday", () => {
    assert.equal(getEffectiveCpfAge(1, 1971, 2, 2026), 55);
    assert.equal(getCpfAgeBand(55), "above_55_to_60");
  });

  it("age 64 in Aug (birthday Nov) stays Above 60 to 65", () => {
    assert.equal(getEffectiveCpfAge(11, 1961, 8, 2026), 64);
    assert.equal(getCpfAgeBand(64), "above_60_to_65");
  });

  it("age 69 in Aug (birthday Apr) is Above 65 to 70", () => {
    assert.equal(getEffectiveCpfAge(4, 1957, 8, 2026), 69);
    assert.equal(getCpfAgeBand(69), "above_65_to_70");
  });

  it("age 70 in birthday month stays Above 65 to 70", () => {
    assert.equal(getEffectiveCpfAge(8, 1956, 8, 2026), 69);
    assert.equal(getCpfAgeBand(69), "above_65_to_70");
  });

  it("age 70 the month after birthday is Above 70", () => {
    assert.equal(getEffectiveCpfAge(8, 1956, 9, 2026), 70);
    assert.equal(getCpfAgeBand(70), "above_70");
  });
});

describe("2026 citizen / PR3+ full rates (TW > $750)", () => {
  const base = {
    birthMonth: 6,
    birthYear: 1990,
    contributionMonth: 3,
    contributionYear: 2026,
    residencyType: "citizen" as const,
  };

  it("OW $3,000 — employee 600, employer 510, total 1,110", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 3000 });
    assert.equal(r.employeeCpf, 600);
    assert.equal(r.employerCpf, 510);
    assert.equal(r.totalCpf, 1110);
    assert.equal(r.ordinaryWagesSubject, 3000);
  });

  it("OW $8,000 at ceiling — employee 1,600, employer 1,360, total 2,960", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 8000 });
    assert.equal(r.employeeCpf, 1600);
    assert.equal(r.employerCpf, 1360);
    assert.equal(r.totalCpf, 2960);
  });

  it("OW $10,000 capped at $8,000 ceiling", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 10000 });
    assert.equal(r.ordinaryWagesSubject, 8000);
    assert.equal(r.employeeCpf, 1600);
    assert.equal(r.totalCpf, 2960);
  });

  it("OW $3,000 + AW $2,000", () => {
    const r = calculateCpfContributions({
      ...base,
      ordinaryWages: 3000,
      additionalWages: 2000,
    });
    // 37% / 20% of 5000
    assert.equal(r.totalCpf, 1850);
    assert.equal(r.employeeCpf, 1000);
    assert.equal(r.employerCpf, 850);
  });

  it("applies Board rounding on fractional cents", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 3333 });
    // total 1233.21 → 1233; employee 666.6 → 666; employer 567
    assert.equal(r.totalCpf, 1233);
    assert.equal(r.employeeCpf, 666);
    assert.equal(r.employerCpf, 567);
  });

  it("Above 55–60 rates (16% / 18%)", () => {
    const r = calculateCpfContributions({
      ordinaryWages: 3000,
      birthMonth: 1,
      birthYear: 1970,
      contributionMonth: 6,
      contributionYear: 2026,
      residencyType: "citizen",
    });
    assert.equal(r.ageBand, "above_55_to_60");
    assert.equal(r.totalCpf, 1020); // 34%
    assert.equal(r.employeeCpf, 540); // 18%
    assert.equal(r.employerCpf, 480);
  });
});

describe("2026 low-wage bands (citizen ≤55)", () => {
  const base = {
    birthMonth: 6,
    birthYear: 1990,
    contributionMonth: 3,
    contributionYear: 2026,
    residencyType: "citizen" as const,
  };

  it("TW ≤ $50 → nil", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 50 });
    assert.equal(r.totalCpf, 0);
    assert.equal(r.employeeCpf, 0);
    assert.equal(r.employerCpf, 0);
  });

  it("TW $400 (>50–500) — employer only 17%", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 400 });
    assert.equal(r.totalCpf, 68);
    assert.equal(r.employeeCpf, 0);
    assert.equal(r.employerCpf, 68);
  });

  it("TW $600 (>500–750) — phased employee share", () => {
    const r = calculateCpfContributions({ ...base, ordinaryWages: 600 });
    // total = 0.17*600 + 0.6*100 = 102+60 = 162; ee = 60
    assert.equal(r.totalCpf, 162);
    assert.equal(r.employeeCpf, 60);
    assert.equal(r.employerCpf, 102);
  });
});

describe("2026 PR graduated rates", () => {
  const young = {
    birthMonth: 6,
    birthYear: 1990,
    contributionMonth: 3,
    contributionYear: 2026,
    ordinaryWages: 3000,
  };

  it("PR 1st year G/G — 4% / 5%", () => {
    const r = calculateCpfContributions({
      ...young,
      residencyType: "pr",
      prYear: 1,
      prRateType: "GG",
    });
    assert.equal(r.totalCpf, 270);
    assert.equal(r.employeeCpf, 150);
    assert.equal(r.employerCpf, 120);
  });

  it("PR 2nd year G/G — 9% / 15%", () => {
    const r = calculateCpfContributions({
      ...young,
      residencyType: "pr",
      prYear: 2,
      prRateType: "GG",
    });
    assert.equal(r.totalCpf, 720);
    assert.equal(r.employeeCpf, 450);
    assert.equal(r.employerCpf, 270);
  });

  it("PR 1st year F/G — 17% er / 5% ee headline (22% total)", () => {
    const r = calculateCpfContributions({
      ...young,
      residencyType: "pr",
      prYear: 1,
      prRateType: "FG",
    });
    assert.equal(r.totalCpf, 660);
    assert.equal(r.employeeCpf, 150);
    assert.equal(r.employerCpf, 510);
  });

  it("PR 2nd year F/G — 32% total / 15% employee", () => {
    const r = calculateCpfContributions({
      ...young,
      residencyType: "pr",
      prYear: 2,
      prRateType: "FG",
    });
    assert.equal(r.totalCpf, 960);
    assert.equal(r.employeeCpf, 450);
    assert.equal(r.employerCpf, 510);
  });

  it("PR 1st year F/F uses full citizen rates", () => {
    const r = calculateCpfContributions({
      ...young,
      residencyType: "pr",
      prYear: 1,
      prRateType: "FF",
    });
    assert.equal(r.totalCpf, 1110);
    assert.equal(r.employeeCpf, 600);
    assert.equal(r.employerCpf, 510);
  });

  it("PR 3rd year+ uses full rates", () => {
    const r = calculateCpfContributions({
      ...young,
      residencyType: "pr",
      prYear: 3,
    });
    assert.equal(r.totalCpf, 1110);
    assert.equal(r.employeeCpf, 600);
  });
});

describe("Foreigner and contribution year", () => {
  it("foreigner pays 0 CPF", () => {
    const r = calculateCpfContributions({
      ordinaryWages: 5000,
      birthMonth: 1,
      birthYear: 1990,
      contributionMonth: 1,
      contributionYear: 2026,
      residencyType: "foreigner",
    });
    assert.equal(r.totalCpf, 0);
    assert.equal(r.employeeCpf, 0);
    assert.equal(r.employerCpf, 0);
  });

  it("2025 uses $7,400 OW ceiling", () => {
    assert.equal(getCpfYearConfig(2025).ordinaryWageCeiling, 7400);
    const r = calculateCpfContributions({
      ordinaryWages: 8000,
      birthMonth: 6,
      birthYear: 1990,
      contributionMonth: 6,
      contributionYear: 2025,
      residencyType: "citizen",
    });
    assert.equal(r.ordinaryWagesSubject, 7400);
    // 37% of 7400 = 2738; 20% = 1480
    assert.equal(r.totalCpf, 2738);
    assert.equal(r.employeeCpf, 1480);
    assert.equal(r.employerCpf, 1258);
  });

  it("2026 uses $8,000 OW ceiling", () => {
    assert.equal(getCpfYearConfig(2026).ordinaryWageCeiling, 8000);
  });
});

describe("Board calculator parity — $1,600 citizen (Aug 2026)", () => {
  const wage = 1600;
  const contrib = { contributionMonth: 8, contributionYear: 2026, residencyType: "citizen" as const, ordinaryWages: wage };

  it("age 54 — 20% / 17% (55 & below)", () => {
    const r = calculateCpfContributions({ ...contrib, birthMonth: 10, birthYear: 1971 });
    assert.equal(r.ageBand, "55_and_below");
    assert.equal(r.employeeCpf, 320);
    assert.equal(r.employerCpf, 272);
    assert.equal(r.totalCpf, 592);
  });

  it("age 59 — 18% / 16% (Above 55 to 60)", () => {
    const r = calculateCpfContributions({ ...contrib, birthMonth: 10, birthYear: 1966 });
    assert.equal(r.ageBand, "above_55_to_60");
    assert.equal(r.employeeCpf, 288);
    assert.equal(r.employerCpf, 256);
    assert.equal(r.totalCpf, 544);
  });

  it("age 64 DOB Nov 1961 — 12.5% / 12.5% (Above 60 to 65)", () => {
    const r = calculateCpfContributions({ ...contrib, birthMonth: 11, birthYear: 1961 });
    assert.equal(r.ageBand, "above_60_to_65");
    assert.equal(r.employeeCpf, 200);
    assert.equal(r.employerCpf, 200);
    assert.equal(r.totalCpf, 400);
  });

  it("age 69 DOB Apr 1957 — 7.5% / 9% (Above 65 to 70)", () => {
    const r = calculateCpfContributions({ ...contrib, birthMonth: 4, birthYear: 1957 });
    assert.equal(r.ageBand, "above_65_to_70");
    assert.equal(r.employeeCpf, 120);
    assert.equal(r.employerCpf, 144);
    assert.equal(r.totalCpf, 264);
  });

  it("age 70 in birthday month Aug 1956 — still 7.5% / 9%", () => {
    const r = calculateCpfContributions({ ...contrib, birthMonth: 8, birthYear: 1956 });
    assert.equal(r.ageBand, "above_65_to_70");
    assert.equal(r.employeeCpf, 120);
    assert.equal(r.employerCpf, 144);
    assert.equal(r.totalCpf, 264);
  });
});
