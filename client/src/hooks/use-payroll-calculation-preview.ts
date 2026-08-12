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

function isValidPreviewInput(input: PayrollCalculationPreviewInput | null): input is PayrollCalculationPreviewInput {
  if (!input) return false;
  if (!input.grossSalary || input.grossSalary <= 0) return false;
  if (!input.citizenshipStatus) return false;
  if (input.dateOfBirth) return true;
  if (!input.age || input.age < 16) return false;
  return true;
}

export function usePayrollCalculationPreview(
  input: PayrollCalculationPreviewInput | null,
  debounceMs = 300
) {
  const [calculation, setCalculation] = useState<PayrollCalculationPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const inputKey = useMemo(
    () => (isValidPreviewInput(input) ? JSON.stringify(input) : ""),
    [input]
  );

  useEffect(() => {
    if (!inputKey || !isValidPreviewInput(input)) {
      setCalculation(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/payroll/calculate", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (requestId !== requestIdRef.current) return;

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Calculation failed");
        }

        const data = (await res.json()) as PayrollCalculationPreviewResult;
        setCalculation(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setCalculation(null);
        setError(err instanceof Error ? err.message : "Calculation failed");
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inputKey, input, debounceMs]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { calculation, isLoading, error };
}
