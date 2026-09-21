import { useEffect, useMemo, useRef, useState } from "react";
import type { ResidencyType, PrYear } from "@shared/singapore-payroll";

export interface PayrollCalculationPreviewInput {
  grossSalary: number;
  age?: number;
  citizenshipStatus: ResidencyType;
  prYear?: PrYear | null;
  prRateType?: "GG" | "FG" | "FF" | null;
  monthlyAllowances?: Record<string, number>;
  monthlyDeductions?: Record<string, number>;
  overtimeHours?: number;
  overtimeRate?: number;
  dateOfBirth?: string | Date | null;
  contributionMonth?: number;
  contributionYear?: number;
  additionalWages?: number;
}

export interface PayrollCalculationPreviewResult {
  grossPay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  employeeCpf: number;
  employerCpf: number;
  totalCpf: number;
  cpfApplicableSalary: number;
  netPay: number;
  employeeCpfRate: number;
  employerCpfRate: number;
  annualSalary: number;
  chargeableIncome: number;
  contributionYear?: number;
  ageBand?: string;
  wageBand?: string;
  breakdown?: {
    baseSalary: number;
    overtimePay: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
  };
}

export function toFiniteNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? num : 0;
}

export function normalizeInput(input: PayrollCalculationPreviewInput | null): PayrollCalculationPreviewInput | null {
  if (!input) return null;
  const grossSalary = toFiniteNumber(input.grossSalary);
  if (grossSalary <= 0 || !input.citizenshipStatus) return null;

  const normalizeRecord = (rec?: Record<string, unknown>): Record<string, number> => {
    if (!rec || typeof rec !== "object") return {};
    const res: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec)) {
      res[k] = toFiniteNumber(v);
    }
    return res;
  };

  return {
    ...input,
    grossSalary,
    age: input.age != null && Number.isFinite(Number(input.age)) ? Number(input.age) : undefined,
    overtimeHours: toFiniteNumber(input.overtimeHours),
    overtimeRate: toFiniteNumber(input.overtimeRate),
    monthlyAllowances: normalizeRecord(input.monthlyAllowances),
    monthlyDeductions: normalizeRecord(input.monthlyDeductions),
  };
}

export function usePayrollCalculationPreview(
  input: PayrollCalculationPreviewInput | null,
  debounceMs = 300
) {
  const [calculation, setCalculation] = useState<PayrollCalculationPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const hasCalculationRef = useRef(false);
  const lastProcessedKeyRef = useRef<string>("");

  const normalizedInput = useMemo(() => normalizeInput(input), [input]);

  const inputKey = useMemo(
    () => (normalizedInput ? JSON.stringify(normalizedInput) : ""),
    [normalizedInput]
  );

  useEffect(() => {
    if (!inputKey || !normalizedInput) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      lastProcessedKeyRef.current = "";
      setCalculation(null);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      hasCalculationRef.current = false;
      return;
    }

    if (inputKey === lastProcessedKeyRef.current) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const currentRequestId = ++requestIdRef.current;

    if (hasCalculationRef.current) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    const delay = hasCalculationRef.current ? debounceMs : 0;

    timerRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/payroll/calculate", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalizedInput),
        });

        if (currentRequestId !== requestIdRef.current) return;

        if (!res.ok) {
          let errorMsg = "Calculation failed";
          try {
            const text = await res.text();
            const parsed = JSON.parse(text);
            errorMsg = parsed?.message || parsed?.error || text || errorMsg;
          } catch {
            // plain text
          }
          throw new Error(errorMsg);
        }

        const data = (await res.json()) as PayrollCalculationPreviewResult;

        if (currentRequestId !== requestIdRef.current) return;

        setCalculation(data);
        hasCalculationRef.current = true;
        lastProcessedKeyRef.current = inputKey;
        setError(null);
      } catch (err: any) {
        if (controller.signal.aborted || currentRequestId !== requestIdRef.current) return;
        if (!hasCalculationRef.current) {
          setCalculation(null);
        }
        setError(err?.message || "Calculation failed");
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [inputKey, normalizedInput, debounceMs]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { calculation, isLoading, isRefreshing, error };
}
