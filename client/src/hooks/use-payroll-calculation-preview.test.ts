import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toFiniteNumber, normalizeInput } from "./use-payroll-calculation-preview.ts";

describe("Payroll Calculation Preview Hook Utilities", () => {
  it("normalizes empty, undefined, NaN, and invalid numeric inputs to 0", () => {
    assert.equal(toFiniteNumber(undefined), 0);
    assert.equal(toFiniteNumber(null), 0);
    assert.equal(toFiniteNumber(""), 0);
    assert.equal(toFiniteNumber("abc"), 0);
    assert.equal(toFiniteNumber(NaN), 0);
    assert.equal(toFiniteNumber(1000), 1000);
    assert.equal(toFiniteNumber("1000"), 1000);
    assert.equal(toFiniteNumber("1000.50"), 1000.5);
  });

  it("normalizes full calculation preview input correctly", () => {
    const rawInput: any = {
      grossSalary: "1500",
      citizenshipStatus: "citizen",
      monthlyAllowances: {
        transport: "1000",
        meal: "",
        phone: undefined,
        others: "invalid",
      },
      monthlyDeductions: {
        medical: "1000",
        advance: null,
      },
    };

    const normalized = normalizeInput(rawInput);
    assert.notEqual(normalized, null);
    assert.equal(normalized?.grossSalary, 1500);
    assert.equal(normalized?.citizenshipStatus, "citizen");
    assert.equal(normalized?.monthlyAllowances?.transport, 1000);
    assert.equal(normalized?.monthlyAllowances?.meal, 0);
    assert.equal(normalized?.monthlyAllowances?.phone, 0);
    assert.equal(normalized?.monthlyAllowances?.others, 0);
    assert.equal(normalized?.monthlyDeductions?.medical, 1000);
    assert.equal(normalized?.monthlyDeductions?.advance, 0);
  });

  it("returns null for invalid or <= 0 grossSalary or missing citizenshipStatus", () => {
    assert.equal(normalizeInput(null), null);
    assert.equal(normalizeInput({ grossSalary: 0, citizenshipStatus: "citizen" } as any), null);
    assert.equal(normalizeInput({ grossSalary: -500, citizenshipStatus: "citizen" } as any), null);
    assert.equal(normalizeInput({ grossSalary: 1500, citizenshipStatus: "" as any } as any), null);
  });

  it("produces stable JSON inputKey for identical normalized inputs", () => {
    const input1: any = {
      grossSalary: 1500,
      citizenshipStatus: "citizen",
      monthlyAllowances: { transport: 1000, meal: 0 },
      monthlyDeductions: { medical: 1000 },
    };
    const input2: any = {
      grossSalary: "1500",
      citizenshipStatus: "citizen",
      monthlyAllowances: { transport: "1000", meal: "" },
      monthlyDeductions: { medical: "1000" },
    };

    const norm1 = normalizeInput(input1);
    const norm2 = normalizeInput(input2);

    assert.equal(JSON.stringify(norm1), JSON.stringify(norm2));
  });
});
