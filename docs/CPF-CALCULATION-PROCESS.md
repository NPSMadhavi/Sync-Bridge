# CPF Contribution Calculation — Process & Implementation

**Primary source of truth:**  
[CPF Board Contribution Calculator](https://www.cpf.gov.sg/employer/tools-and-services/calculators/cpf-contribution-calculator)

**Official rate tables:**  
[CPF contribution rates from 1 Jan 2026 (PDF)](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf)

---

## 1. What was wrong in the previous implementation

| Issue | Previous behaviour |
|-------|-------------------|
| Flat % model | `min(gross, 8000) × rate` with no OW/AW split |
| Wrong age basis | Age from calendar “today”, not contribution month/year vs birth month/year |
| Missing PR rate types | Only fixed Y1/Y2 %; no **G/G**, **F/G**, **F/F** |
| PR Y1/Y2 ignored age | Same rates for all ages |
| No low-wage tiers | Missing ≤$50 / $50–$500 / $500–$750 formulas |
| Wrong rounding | Rounded to **cents**; Board uses **nearest dollar** (total) and **floor dollar** (employee) |
| Deductions reduced CPF base | Non-CPF deductions incorrectly lowered wages subject to CPF |
| No contribution-year tables | Single hardcoded ceiling/rates (not versioned for 2025 vs 2026) |
| OA/SA/MA | Stub zeros only |
| Legacy duplicate helpers | Outdated 7%/13%/20% paths in `payroll.ts` / `payroll-utils.ts` |
| No automated CPF tests | Nothing to lock Board parity |

---

## 2. CPF rules that were missing (now implemented)

1. Employee CPF contribution  
2. Employer CPF contribution  
3. Total CPF contribution  
4. Singapore Citizen rates  
5. Singapore PR: 1st year / 2nd year / 3rd year+  
6. PR rate types: **G/G**, **F/G**, **F/F**  
7. Age from birth month/year + contribution month/year (rates change from the **month after** 55/60/65/70 birthday)  
8. Contribution month and year  
9. Contribution year override (selects rate/ceiling table)  
10. Ordinary Wages (OW)  
11. Additional Wages (AW)  
12. Total wages (TW = OW + AW)  
13. OW ceiling by year ($7,400 in 2025; $8,000 in 2026)  
14. Monthly wage thresholds (≤$50, $50–$500, $500–$750, >$750)  
15. AW ceiling: `17 × OW ceiling − OW subject YTD (incl. this month)`  
16. Optional annual CPF limit ($37,740) when YTD CPF is supplied  
17. Board rounding rules  
18. Employer = Total − Employee after rounding  
19. Age-band rates  
20. Year-keyed rate configuration (extensible for future years)

**Not yet fully productized in UI (engine supports):** YTD OW/AW tracking fields on every screen; OA/SA/MA allocation percentages; explicit PR rate-type picker (defaults to **G/G**).

---

## 3. Files changed / added

### Added
- `shared/cpf/types.ts` — CPF types (residency, PR year, G/G|F/G|F/F, age/wage bands)
- `shared/cpf/rates.ts` — Year-keyed rate tables (2025, 2026)
- `shared/cpf/calculator.ts` — Board contribution engine
- `shared/cpf/index.ts` — barrel exports
- `shared/cpf/cpf-calculator.test.ts` — regression tests vs Board formulas
- `docs/CPF-CALCULATION-PROCESS.md` — this document

### Updated
- `shared/singapore-payroll.ts` — uses Board CPF engine; OW/AW mapping; deductions no longer reduce CPF wages
- `server/singapore-payroll-calculator.ts` — passes DOB, contribution month/year, PR rate type
- `server/payroll-process-service.ts` — contribution month/year from pay period
- `server/payroll.ts` — fixed legacy create/preview paths to use residency + DOB + period
- `client/src/components/forms/ProcessPayrollForm.tsx` — sends DOB + contribution month/year
- `client/src/lib/payroll-calculations.ts` — re-exports new CPF helpers
- `package.json` — `npm run test:cpf`

---

## 4. Calculation logic implemented

### 4.1 Resolve contribution year → rate config
`getCpfYearConfig(year)` loads OW ceiling + full/PR tables. Unknown future years fall forward to the latest configured year; older years fall back to the earliest.

### 4.2 Effective age / age band
```
effectiveAge = contributionYear - birthYear - (contributionMonth <= birthMonth ? 1 : 0)
```
Bands: ≤54 → `55_and_below`; 55–59 → `above_55_to_60`; …; ≥70 → `above_70`.

### 4.3 Wage classification (payroll mapping)
| App field | CPF treatment |
|-----------|----------------|
| Base monthly salary + recurring allowances | **Ordinary Wages (OW)** |
| Overtime pay / explicit `additionalWages` | **Additional Wages (AW)** |
| Loans / other payroll deductions | **Not CPF-liable**; reduce net pay only |

### 4.4 Subject wages
- `OW_subject = min(OW, OW_ceiling)`
- `AW_ceiling = 17 × OW_ceiling − (OW_subject_YTD + OW_subject)`
- `AW_subject = min(AW, max(0, AW_ceiling − AW_subject_YTD))` when TW > $750

### 4.5 Rate selection
- Foreigner → 0  
- Citizen / PR year 3+ / PR **F/F** → full table  
- PR year 1 **G/G** / **F/G** → Table 2 / 4  
- PR year 2 **G/G** / **F/G** → Table 3 / 5  
- Default PR rate type: **G/G**

### 4.6 Amounts by wage band
- **≤ $50:** nil  
- **>$50–$500:** total = employer% × TW; employee = 0  
- **>$500–$750:** total = employerBase% × TW + coeff × (TW − 500); employee = coeff × (TW − 500)  
- **>$750:** total = total% × (OW_subject + AW_subject); employee = ee% × (OW_subject + AW_subject)

### 4.7 Board rounding
1. Total → nearest dollar  
2. Employee → floor to dollar  
3. Employer = Total − Employee  

---

## 5. How to run tests

```bash
cd Sync-Bridge
npm run test:cpf
```

---

## 6. Test cases (expected vs actual)

All cases below are asserted in `shared/cpf/cpf-calculator.test.ts`.  
**Expected = Board formula / calculator; Actual = application result (must match).**

| # | Scenario | Employee | Employer | Total |
|---|----------|----------|----------|-------|
| 1 | Citizen ≤55, OW $3,000, Mar 2026 | 600 | 510 | 1,110 |
| 2 | Citizen ≤55, OW $8,000 (ceiling) | 1,600 | 1,360 | 2,960 |
| 3 | Citizen ≤55, OW $10,000 (capped) | 1,600 | 1,360 | 2,960 |
| 4 | Citizen ≤55, OW $3,000 + AW $2,000 | 1,000 | 850 | 1,850 |
| 5 | Citizen ≤55, OW $3,333 (rounding) | 666 | 567 | 1,233 |
| 6 | Citizen Above 55–60, OW $3,000 | 540 | 480 | 1,020 |
| 7 | Citizen, TW $50 | 0 | 0 | 0 |
| 8 | Citizen, TW $400 | 0 | 68 | 68 |
| 9 | Citizen, TW $600 | 60 | 102 | 162 |
| 10 | PR Y1 G/G, OW $3,000 | 150 | 120 | 270 |
| 11 | PR Y2 G/G, OW $3,000 | 450 | 270 | 720 |
| 12 | PR Y1 F/G, OW $3,000 | 150 | 510 | 660 |
| 13 | PR Y2 F/G, OW $3,000 | 450 | 510 | 960 |
| 14 | PR Y1 F/F, OW $3,000 | 600 | 510 | 1,110 |
| 15 | PR Y3+, OW $3,000 | 600 | 510 | 1,110 |
| 16 | Foreigner, OW $5,000 | 0 | 0 | 0 |
| 17 | Citizen 2025, OW $8,000 → ceiling $7,400 | 1,480 | 1,258 | 2,738 |

### Manual Board calculator cross-check
Re-verify any row on the official calculator with matching:
- Citizenship / PR year  
- Birth month/year  
- Contribution month/year  
- G/G | F/G | F/F (for 1st/2nd year PR)  
- Ordinary + Additional wages  

If a Board result differs after a CPF Board rate update, update `shared/cpf/rates.ts` for that contribution year and extend the tests.

---

## 7. Adding a future contribution year

1. Copy the latest block in `shared/cpf/rates.ts`.  
2. Set `year`, `ordinaryWageCeiling`, and updated `fullRates` / PR tables from the new CPF Board PDF.  
3. Register in `CPF_YEAR_CONFIGS`.  
4. Add tests for the new year’s ceiling and at least one age-band row.  
5. Re-run `npm run test:cpf`.

---

## 8. Architecture (high level)

```
Pay period + Employee (DOB, nationality, prStatus)
        ↓
buildPayrollCalculationInput / ProcessPayrollForm
        ↓
calculateSingaporePayroll (server adapter)
        ↓
calculateProcessPayroll / calculateSingaporePayrollSnapshot
        ↓
calculateCpfContributions  ←── getCpfYearConfig(year)
        ↓
employeeCpf / employerCpf / totalCpf  → payroll record + payslip
```
